import prisma from "../config/prisma.js";

export const getRobot = async () => {
  const robot = await prisma.robot.findUnique({
    where: {
      id: 1,
    },
  });

  if (!robot) {
    throw new Error("Robot not found");
  }

  return robot;
};

export const updateRobotStatus = async (status) => {
  const allowedStatuses = ["ONLINE", "OFFLINE", "UNKNOWN"];

  if (!allowedStatuses.includes(status)) {
    throw new Error("Invalid robot status");
  }

  const robot = await prisma.robot.update({
    where: { id: 1 },
    data: {
      status,
      ...(status === "ONLINE"
        ? { lastSeenAt: new Date() }
        : {}),
    },
  });

  return robot;
};

export const checkRobotHeartbeat = async () => {
  const HEARTBEAT_TIMEOUT_MS = Number(
    process.env.MQTT_HEARTBEAT_TIMEOUT_MS || 30000
  );

  const robot = await prisma.robot.findUnique({
    where: { id: 1 },
  });

  if (!robot || !robot.lastSeenAt) {
    return robot;
  }

  const elapsedTime = Date.now() - robot.lastSeenAt.getTime();

  if (
    elapsedTime > HEARTBEAT_TIMEOUT_MS &&
    robot.status !== "OFFLINE"
  ) {
    const updatedRobot = await prisma.robot.update({
      where: { id: 1 },
      data: {
        status: "OFFLINE",
      },
    });

    console.log("Robot heartbeat timeout. Robot marked OFFLINE.");

    return updatedRobot;
  }

  return robot;
};