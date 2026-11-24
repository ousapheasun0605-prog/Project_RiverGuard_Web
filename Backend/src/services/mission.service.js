import { randomUUID } from "node:crypto";
import prisma from "../config/prisma.js";
import { createAndPublishCommand } from "./command.service.js";
import { isFirmwareProtocol } from "../config/boat.js";
import { isBoatOnline, sendBoatText, buildCommandText } from "./boat.service.js";

const ROBOT_ID = 1;

export const createMission = async (initiatedByUserId) => {
  if (!Number.isInteger(initiatedByUserId) || initiatedByUserId <= 0) {
    throw new Error("Invalid initiating user ID");
  }

  const user = await prisma.user.findFirst({
    where: { id: initiatedByUserId, isActive: true },
  });

  if (!user) throw new Error("User not found or inactive");

  const robot = await prisma.robot.findUnique({
    where: { id: ROBOT_ID },
  });

  if (!robot) throw new Error("RiverGuard robot not found");

  return prisma.$transaction(async (tx) => {
    const temporaryMission = await tx.mission.create({
      data: {
        missionCode: `TEMP-${randomUUID()}`,
        name: "Temporary mission",
        status: "PLANNED",
        initiatedByUserId,
        robotId: ROBOT_ID,
      },
    });

    const missionNumber = String(temporaryMission.id).padStart(3, "0");

    return tx.mission.update({
      where: { id: temporaryMission.id },
      data: {
        missionCode: `RG-M${missionNumber}`,
        name: `RiverGuard Mission #${missionNumber}`,
      },
      include: {
        initiatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        robot: true,
      },
    });
  });
};

export const getAllMissions = async () => {
  return prisma.mission.findMany({
    include: {
      initiatedBy: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      robot: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const getMissionById = async (missionId) => {
  if (!Number.isInteger(missionId) || missionId <= 0) {
    throw new Error("Invalid mission ID");
  }

  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    include: {
      initiatedBy: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      robot: true,
      commands: { orderBy: { createdAt: "asc" } },
      telemetry: {
        orderBy: { recordedAt: "asc" },
        take: 5000,
      },
      images: true,
    },
  });

  if (!mission) throw new Error("Mission not found");

  return mission;
};

const startMissionJson = async (missionId, initiatedByUserId) => {
  if (!Number.isInteger(missionId) || missionId <= 0) {
    throw new Error("Invalid mission ID");
  }

  if (!Number.isInteger(initiatedByUserId) || initiatedByUserId <= 0) {
    throw new Error("Invalid initiating user ID");
  }

  return prisma.$transaction(
    async (tx) => {
      const initialMission = await tx.mission.findUnique({
        where: { id: missionId },
      });

      if (!initialMission) {
        throw new Error("Mission not found");
      }

      await tx.$queryRaw`
        SELECT "id"
        FROM "Robot"
        WHERE "id" = ${initialMission.robotId}
        FOR UPDATE
      `;

      const mission = await tx.mission.findUnique({
        where: { id: missionId },
      });

      if (mission.status !== "PLANNED") {
        throw new Error("Only planned missions can be started");
      }

      const robot = await tx.robot.findUnique({
        where: { id: mission.robotId },
      });

      if (!robot || robot.status !== "ONLINE") {
        throw new Error("Robot is offline. Cannot start mission");
      }

      const activeMission = await tx.mission.findFirst({
        where: {
          robotId: mission.robotId,
          status: "ACTIVE",
        },
      });

      if (activeMission) {
        throw new Error("Another mission is already active");
      }

      const pendingStartCommand = await tx.command.findFirst({
        where: {
            type: "START_MISSION",
            status: {
            in: ["PENDING", "SENT", "ACKNOWLEDGED"],
            },
            mission: {
            robotId: mission.robotId,
            status: "PLANNED",
            },
        },
        });

      if (pendingStartCommand) {
        throw new Error(
          "Another mission start command is awaiting robot confirmation"
        );
      }

      const command = await createAndPublishCommand({
        type: "START_MISSION",
        issuedByUserId: initiatedByUserId,
        missionId,
        payload: {
          missionCode: mission.missionCode,
        },
      });

      return {
        message: "Mission start command submitted",
        mission,
        command,
      };
    },
    {
      maxWait: 10000,
      timeout: 15000,
    }
  );
};

const stopMissionJson = async (missionId, issuedByUserId) => {
  if (!Number.isInteger(missionId) || missionId <= 0) {
    throw new Error("Invalid mission ID");
  }

  if (!Number.isInteger(issuedByUserId) || issuedByUserId <= 0) {
    throw new Error("Invalid issuing user ID");
  }

  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
  });

  if (!mission) throw new Error("Mission not found");

  if (mission.status !== "ACTIVE") {
    throw new Error("Only active missions can be stopped");
  }

  const robot = await prisma.robot.findUnique({
    where: { id: mission.robotId },
  });

  if (!robot || robot.status !== "ONLINE") {
    throw new Error("Robot is offline. Cannot send stop command");
  }

  const existingStopCommand = await prisma.command.findFirst({
    where: {
      missionId,
      type: "STOP_MISSION",
      status: { in: ["PENDING", "SENT"] },
    },
  });

  if (existingStopCommand) {
    throw new Error("A stop command is already pending for this mission");
  }

  const command = await createAndPublishCommand({
    type: "STOP_MISSION",
    issuedByUserId,
    missionId,
    payload: { missionCode: mission.missionCode },
  });

  return {
    message: "Mission stop command submitted",
    mission,
    command,
  };
};

export const processMissionStatusUpdate = async (message) => {
  const { missionId, status } = message;

  if (!Number.isInteger(missionId) || missionId <= 0) {
    throw new Error("Invalid mission ID");
  }

  const allowedStatuses = ["ACTIVE", "STOPPED", "COMPLETED", "FAILED"];

  if (!allowedStatuses.includes(status)) {
    throw new Error("Invalid mission status update");
  }

  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
  });

  if (!mission) throw new Error("Mission not found");

  if (mission.robotId !== ROBOT_ID) {
    throw new Error("Mission does not belong to RiverGuard robot");
  }

  if (mission.status === status) {
    console.log(`Mission ${missionId} is already ${status}`);
    return mission;
  }

  if (status === "ACTIVE") {
    if (mission.status !== "PLANNED") {
      throw new Error(
        `Mission cannot become ACTIVE from status ${mission.status}`
      );
    }

    const acknowledgedCommand = await prisma.command.findFirst({
      where: {
        missionId,
        type: "START_MISSION",
        status: "ACKNOWLEDGED",
      },
    });

    if (!acknowledgedCommand) {
      throw new Error("No acknowledged START_MISSION command found");
    }
  } else {
    if (mission.status !== "ACTIVE") {
      throw new Error(
        `Mission cannot become ${status} from status ${mission.status}`
      );
    }

    if (status === "STOPPED") {
      const acknowledgedCommand = await prisma.command.findFirst({
        where: {
          missionId,
          type: "STOP_MISSION",
          status: "ACKNOWLEDGED",
        },
      });

      if (!acknowledgedCommand) {
        throw new Error("No acknowledged STOP_MISSION command found");
      }
    }
  }

  const expectedStatus = status === "ACTIVE" ? "PLANNED" : "ACTIVE";

  const updateData =
    status === "ACTIVE"
      ? { status: "ACTIVE", startedAt: new Date() }
      : { status, endedAt: new Date() };

  const result = await prisma.mission.updateMany({
    where: {
      id: missionId,
      status: expectedStatus,
    },
    data: updateData,
  });

  if (result.count !== 1) {
    throw new Error("Mission status changed before update");
  }

  const updatedMission = await prisma.mission.findUnique({
    where: { id: missionId },
  });

  console.log(`Mission ${missionId} confirmed ${status}`);

  return updatedMission;
};
// ------------------------------------------------------------------
// Real boat firmware: no acknowledgements. The backend sends the text
// commands and boat.service confirms the mission from the boat's mode.

const startMissionFirmware = async (missionId, userId, options = {}) => {
  if (!Number.isInteger(missionId) || missionId <= 0) {
    throw new Error("Invalid mission ID");
  }

  const mission = await prisma.mission.findUnique({ where: { id: missionId } });
  if (!mission) throw new Error("Mission not found");
  if (mission.status !== "PLANNED") {
    throw new Error("Only planned missions can be started");
  }
  if (!isBoatOnline()) throw new Error("Robot is offline. Cannot start mission");

  const active = await prisma.mission.findFirst({
    where: { robotId: mission.robotId, status: "ACTIVE" },
  });
  if (active) throw new Error("Another mission is already active");

  const pending = await prisma.command.findFirst({
    where: { type: "START_MISSION", status: "SENT", mission: { status: "PLANNED" } },
  });
  if (pending) {
    throw new Error("Another mission start command is awaiting robot confirmation");
  }

  const lines = [];
  if (options.target) lines.push(buildCommandText("target", options.target));
  if (options.waitMin !== undefined && options.waitMin !== null) {
    lines.push(buildCommandText("wait", { value: Number(options.waitMin) }));
  }
  if (options.speed !== undefined && options.speed !== null) {
    lines.push(buildCommandText("speed", { value: Number(options.speed) }));
  }
  lines.push("go");

  const command = await prisma.command.create({
    data: {
      type: "START_MISSION",
      status: "PENDING",
      issuedByUserId: userId,
      missionId,
      payload: { missionCode: mission.missionCode, lines, ...options },
      attemptCount: 1,
      lastAttemptAt: new Date(),
    },
  });

  try {
    for (const line of lines) {
      await sendBoatText(line);
      // Give the 4G module a moment between commands.
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  } catch (error) {
    await prisma.command.update({
      where: { id: command.id },
      data: { status: "FAILED", lastError: error.message },
    });
    throw new Error(`Command publishing failed: ${error.message}`);
  }

  const sent = await prisma.command.update({
    where: { id: command.id },
    data: { status: "SENT", sentAt: new Date() },
  });

  return {
    message: "Mission start sent. Waiting for the boat to begin the trip.",
    mission,
    command: sent,
  };
};

const stopMissionFirmware = async (missionId, userId, options = {}) => {
  if (!Number.isInteger(missionId) || missionId <= 0) {
    throw new Error("Invalid mission ID");
  }

  const mission = await prisma.mission.findUnique({ where: { id: missionId } });
  if (!mission) throw new Error("Mission not found");

  // Cancel a mission that was never confirmed.
  if (mission.status === "PLANNED") {
    await prisma.command.updateMany({
      where: { missionId, type: "START_MISSION", status: { in: ["PENDING", "SENT"] } },
      data: { status: "FAILED", lastError: "Cancelled by operator" },
    });
    try { await sendBoatText("stop"); } catch { /* boat may be offline */ }
    const updated = await prisma.mission.update({
      where: { id: missionId },
      data: { status: "STOPPED", endedAt: new Date() },
    });
    return { message: "Mission cancelled", mission: updated };
  }

  if (mission.status !== "ACTIVE") {
    throw new Error("Only active missions can be stopped");
  }

  const text = options.returnHome ? "rth" : "stop";

  const command = await prisma.command.create({
    data: {
      type: options.returnHome ? "RETURN_HOME" : "STOP_MISSION",
      status: "PENDING",
      issuedByUserId: userId,
      missionId,
      payload: { missionCode: mission.missionCode, text },
      attemptCount: 1,
      lastAttemptAt: new Date(),
    },
  });

  await sendBoatText(text);

  await prisma.command.update({
    where: { id: command.id },
    data: { status: "SENT", sentAt: new Date() },
  });

  // Offline boat can't confirm, so close the mission now.
  if (!options.returnHome && !isBoatOnline()) {
    const updated = await prisma.mission.update({
      where: { id: missionId },
      data: { status: "STOPPED", endedAt: new Date() },
    });
    return { message: "Stop sent (boat offline, mission closed)", mission: updated, command };
  }

  return {
    message: options.returnHome
      ? "Return home sent. Mission completes when the boat holds at home."
      : "Stop sent. Waiting for the boat to confirm.",
    mission,
    command,
  };
};

export const startMission = (missionId, userId, options) =>
  isFirmwareProtocol()
    ? startMissionFirmware(missionId, userId, options)
    : startMissionJson(missionId, userId);

export const stopMission = (missionId, userId, options) =>
  isFirmwareProtocol()
    ? stopMissionFirmware(missionId, userId, options)
    : stopMissionJson(missionId, userId);
