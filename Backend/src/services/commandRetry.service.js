import prisma from "../config/prisma.js";
import { publishMessage } from "../mqtt/mqttPublisher.js";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;

export const processCommandRetries = async () => {
  const now = new Date();

  const pendingCommands = await prisma.command.findMany({
    where: {
        status: { in: ["PENDING", "SENT"] },
        OR: [
        { nextRetryAt: { lte: now } },
        { nextRetryAt: null },
        ],
    },
    });

  for (const command of pendingCommands) {
    if (command.attemptCount >= MAX_ATTEMPTS) {
      const timeoutResult = await prisma.command.updateMany({
        where: {
          id: command.id,
          status: command.status,
          attemptCount: command.attemptCount,
          nextRetryAt: command.nextRetryAt,
        },
        data: {
          status: "TIMED_OUT",
          nextRetryAt: null,
          lastError: "Maximum command attempts reached",
        },
      });

      if (timeoutResult.count === 1) {
        console.log(
          `Command ${command.id} timed out after ${command.attemptCount} attempts`
        );
      }

      continue;
    }

    const claimed = await prisma.command.updateMany({
      where: {
        id: command.id,
        status: command.status,
        attemptCount: command.attemptCount,
        nextRetryAt: command.nextRetryAt,
      },
      data: {
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        nextRetryAt: new Date(Date.now() + RETRY_DELAY_MS),
      },
    });

    if (claimed.count !== 1) {
      continue;
    }

    try {
      await publishMessage("robot/1/command", {
        commandId: command.id,
        type: command.type,
        missionId: command.missionId,
        payload: command.payload,
      });

      await prisma.command.updateMany({
        where: {
          id: command.id,
          status: { in: ["PENDING", "SENT"] },
        },
        data: {
          status: "SENT",
          sentAt: new Date(),
          lastError: null,
        },
      });

      console.log(
        `Command ${command.id} retry published. Attempt ${command.attemptCount + 1}/${MAX_ATTEMPTS}`
      );
    } catch (error) {
      await prisma.command.updateMany({
        where: {
          id: command.id,
          status: { in: ["PENDING", "SENT"] },
        },
        data: {
          lastError: error.message,
        },
      });

      console.error(
        `Command ${command.id} retry failed:`,
        error.message
      );
    }
  }
};