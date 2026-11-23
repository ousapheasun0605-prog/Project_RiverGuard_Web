import prisma from "../config/prisma.js";
import { publishMessage } from "../mqtt/mqttPublisher.js";

export const processCommandAcknowledgement = async (message) => {
  const { commandId, status } = message;

  if (!Number.isInteger(commandId) || commandId <= 0) {
    throw new Error("Invalid command ID");
  }

  const allowedStatuses = ["ACKNOWLEDGED", "FAILED"];

  if (!allowedStatuses.includes(status)) {
    throw new Error("Invalid command acknowledgement status");
  }

  const command = await prisma.command.findUnique({
    where: { id: commandId },
  });

  if (!command) {
    throw new Error(`Command ${commandId} not found`);
  }

  const terminalStatuses = [
    "ACKNOWLEDGED",
    "FAILED",
    "TIMED_OUT",
  ];

  if (terminalStatuses.includes(command.status)) {
    console.log(
      `Ignoring duplicate or late acknowledgement for command ${commandId}`
    );

    return command;
  }

  if (!["PENDING", "SENT"].includes(command.status)) {
    throw new Error(
      `Command ${commandId} cannot be acknowledged in status ${command.status}`
    );
  }

  const updatedCommand = await prisma.command.update({
    where: { id: commandId },
    data: {
      status,
      response: message,
      acknowledgedAt: new Date(),
      nextRetryAt: null,
      lastError: status === "FAILED"
        ? message.message || "Robot reported command failure"
        : null,
    },
  });

  return updatedCommand;
};

export const createAndPublishCommand = async ({
  type,
  issuedByUserId,
  missionId = null,
  payload = null,
}) => {
  const allowedTypes = [
    "START_MISSION",
    "STOP_MISSION",
    "RETURN_HOME",
    "EMERGENCY_STOP",
  ];

  if (!allowedTypes.includes(type)) {
    throw new Error("Invalid command type");
  }

  if (!Number.isInteger(issuedByUserId) || issuedByUserId <= 0) {
    throw new Error("Invalid issuing user ID");
  }

  const command = await prisma.command.create({
    data: {
      type,
      status: "PENDING",
      issuedByUserId,
      missionId,
      payload,
    },
  });

  await prisma.command.update({
    where: { id: command.id },
    data: {
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
    },
  });

  try {
    await publishMessage("robot/1/command", {
      commandId: command.id,
      type: command.type,
      missionId: command.missionId,
      payload: command.payload,
    });
  } catch (error) {
    await prisma.command.updateMany({
      where: {
        id: command.id,
        status: "PENDING",
      },
      data: {
        lastError: error.message,
        nextRetryAt: new Date(Date.now() + 5000),
      },
    });

    throw new Error(
      `Command publishing failed: ${error.message}`
    );
  }

  await prisma.command.updateMany({
    where: {
      id: command.id,
      status: "PENDING",
    },
    data: {
      status: "SENT",
      sentAt: new Date(),
      nextRetryAt: new Date(Date.now() + 5000),
      lastError: null,
    },
  });

  const updatedCommand = await prisma.command.findUnique({
    where: { id: command.id },
  });

  return updatedCommand;
};