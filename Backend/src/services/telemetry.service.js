import prisma from "../config/prisma.js";

export const saveTelemetry = async (data) => {
  const {
    latitude,
    longitude,
    speed,
    batteryLevel,
    heading,
  } = data;

  const numericFields = {
    latitude,
    longitude,
    speed,
    batteryLevel,
    heading,
  };

  for (const [field, value] of Object.entries(numericFields)) {
    if (
      value !== undefined &&
      value !== null &&
      (typeof value !== "number" || !Number.isFinite(value))
    ) {
      throw new Error(`Invalid telemetry field: ${field}`);
    }
  }

  if (latitude != null && (latitude < -90 || latitude > 90)) {
    throw new Error("Latitude must be between -90 and 90");
  }

  if (longitude != null && (longitude < -180 || longitude > 180)) {
    throw new Error("Longitude must be between -180 and 180");
  }

  if (speed != null && speed < 0) {
    throw new Error("Speed cannot be negative");
  }

  if (batteryLevel != null && (batteryLevel < 0 || batteryLevel > 100)) {
    throw new Error("Battery level must be between 0 and 100");
  }

  if (heading != null && (heading < 0 || heading > 360)) {
    throw new Error("Heading must be between 0 and 360");
  }

  const activeMission = await prisma.mission.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
  });

  const [telemetry] = await prisma.$transaction([
    prisma.telemetry.create({
      data: {
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        speed: speed ?? null,
        batteryLevel: batteryLevel ?? null,
        heading: heading ?? null,
        missionId: activeMission?.id ?? null,
      },
    }),

    prisma.robot.update({
      where: { id: 1 },
      data: {
        status: "ONLINE",
        lastSeenAt: new Date(),
      },
    }),
  ]);

  return telemetry;
};