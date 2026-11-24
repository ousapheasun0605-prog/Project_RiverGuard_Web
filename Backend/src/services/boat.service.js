import prisma from "../config/prisma.js";
import { publishMessage } from "../mqtt/mqttPublisher.js";
import { broadcast } from "../realtime/ws.js";
import {
  BOAT_COMMAND_TOPIC,
  BOAT_ONLINE_TIMEOUT_MS,
  DRIVE_LIMIT,
} from "../config/boat.js";

const ROBOT_ID = 1;

// Firmware modes that mean "an A -> B -> A trip is running".
const TRIP_MODES = ["GO_TO_B", "WAIT_AT_B", "RETURN_HOME"];
// Start command must turn into a trip mode within this time, or it failed.
const START_CONFIRM_MS = Number(process.env.START_CONFIRM_MS || 30000);

// Latest boat state, kept in memory for the dashboard.
const state = {
  telemetry: null,
  lastSeenAt: null,
  lastMsg: null,
};

const recentLog = [];
const MAX_LOG = 100;

const pushLog = (entry) => {
  const item = { id: Date.now() + Math.random(), at: new Date().toISOString(), ...entry };
  recentLog.unshift(item);
  if (recentLog.length > MAX_LOG) recentLog.pop();
  broadcast("log", item);
  return item;
};

export const isBoatOnline = () =>
  Boolean(state.lastSeenAt) &&
  Date.now() - state.lastSeenAt.getTime() < BOAT_ONLINE_TIMEOUT_MS;

export const getBoatState = () => ({
  online: isBoatOnline(),
  lastSeenAt: state.lastSeenAt,
  telemetry: state.telemetry,
  commandTopic: BOAT_COMMAND_TOPIC,
});

export const getRecentLog = () => recentLog;

const num = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

// ---------------------------------------------------------------- telemetry
export const handleFirmwareTelemetry = async (raw) => {
  const t = typeof raw === "object" && raw !== null ? raw : {};
  const now = new Date();
  const wasOnline = isBoatOnline();

  state.telemetry = t;
  state.lastSeenAt = now;

  broadcast("telemetry", { ...t, receivedAt: now.toISOString() });
  if (!wasOnline) {
    broadcast("status", { online: true });
    pushLog({ kind: "status", text: "Boat online" });
  }

  if (t.msg && t.msg !== state.lastMsg) {
    state.lastMsg = t.msg;
    pushLog({ kind: "boat", text: String(t.msg).slice(0, 200) });
  }

  await prisma.robot.upsert({
    where: { id: ROBOT_ID },
    update: { status: "ONLINE", lastSeenAt: now },
    create: { id: ROBOT_ID, name: "RiverGuard-01", status: "ONLINE", lastSeenAt: now },
  });

  const mission = await syncMissionWithMode(String(t.mode || ""));

  const hasFix = t.fix === true;
  const lat = num(t.lat);
  const lon = num(t.lon);
  const spdKmh = num(t.spd);
  const hdg = num(t.hdg);
  const batP = num(t.batP);

  await prisma.telemetry.create({
    data: {
      missionId: mission?.id ?? null,
      latitude: hasFix && lat !== null && Math.abs(lat) <= 90 ? lat : null,
      longitude: hasFix && lon !== null && Math.abs(lon) <= 180 ? lon : null,
      speed: spdKmh !== null && spdKmh >= 0 ? spdKmh / 3.6 : null, // stored in m/s
      heading: hdg !== null ? ((hdg % 360) + 360) % 360 : null,
      batteryLevel:
        t.ina === true && batP !== null && batP >= 0 && batP <= 100 ? batP : null,
    },
  });
};

export const checkBoatTimeout = async () => {
  if (state.lastSeenAt && !isBoatOnline() && !state.reportedOffline) {
    state.reportedOffline = true;
    broadcast("status", { online: false });
    pushLog({ kind: "status", text: "Boat offline (no telemetry)" });
    await prisma.robot.updateMany({
      where: { id: ROBOT_ID, status: { not: "OFFLINE" } },
      data: { status: "OFFLINE" },
    });
  }
  if (isBoatOnline()) state.reportedOffline = false;
};

// ---------------------------------------------------------------- missions
// The firmware has no acknowledgements, so the backend watches the boat's
// mode in telemetry to confirm what really happened.
const syncMissionWithMode = async (mode) => {
  const active = await prisma.mission.findFirst({
    where: { robotId: ROBOT_ID, status: "ACTIVE" },
  });

  if (active) {
    if (mode === "HOLD") {
      return finishMission(active, "COMPLETED", "Trip finished, boat holding at home");
    }
    if (mode === "IDLE" || mode === "MANUAL") {
      return finishMission(active, "STOPPED", `Trip ended (boat mode ${mode})`);
    }
    return active;
  }

  // A START sent recently and the boat is now on a trip -> mission ACTIVE.
  const pendingStart = await prisma.command.findFirst({
    where: {
      type: "START_MISSION",
      status: "SENT",
      mission: { status: "PLANNED", robotId: ROBOT_ID },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!pendingStart) return null;

  if (TRIP_MODES.includes(mode)) {
    await prisma.command.update({
      where: { id: pendingStart.id },
      data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date(), nextRetryAt: null },
    });
    const mission = await prisma.mission.update({
      where: { id: pendingStart.missionId },
      data: { status: "ACTIVE", startedAt: new Date() },
    });
    pushLog({ kind: "mission", text: `${mission.missionCode} started (boat ${mode})` });
    broadcast("mission", mission);
    return mission;
  }

  if (Date.now() - pendingStart.createdAt.getTime() > START_CONFIRM_MS) {
    await failStart(pendingStart, state.lastMsg || "Boat did not start the trip");
  }

  return null;
};

const failStart = async (command, reason) => {
  await prisma.command.update({
    where: { id: command.id },
    data: { status: "FAILED", lastError: reason, nextRetryAt: null },
  });
  pushLog({ kind: "mission", text: `Mission start failed: ${reason}` });
  broadcast("mission", { id: command.missionId, startFailed: reason });
};

// Called by the timer too, so a start fails even when telemetry stops.
export const expireStartCommands = async () => {
  const stale = await prisma.command.findMany({
    where: {
      type: "START_MISSION",
      status: "SENT",
      createdAt: { lt: new Date(Date.now() - START_CONFIRM_MS) },
      mission: { status: "PLANNED" },
    },
  });
  for (const command of stale) {
    await failStart(command, isBoatOnline() ? state.lastMsg || "Boat did not start the trip" : "Boat offline");
  }
};

const finishMission = async (mission, status, text) => {
  const result = await prisma.mission.updateMany({
    where: { id: mission.id, status: "ACTIVE" },
    data: { status, endedAt: new Date() },
  });
  if (result.count === 1) {
    await prisma.command.updateMany({
      where: { missionId: mission.id, type: "STOP_MISSION", status: "SENT" },
      data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date(), nextRetryAt: null },
    });
    pushLog({ kind: "mission", text: `${mission.missionCode} ${status.toLowerCase()}: ${text}` });
    broadcast("mission", { ...mission, status });
  }
  return null;
};

// ---------------------------------------------------------------- control
const fmt = (n, digits) => Number(n).toFixed(digits);

// Turn a website request into one firmware text command. Throws on bad input.
export const buildCommandText = (command, args = {}) => {
  const c = String(command || "").toLowerCase();
  const isNum = (v) => typeof v === "number" && Number.isFinite(v);

  switch (c) {
    case "stop":
    case "home":
    case "go":
    case "rth":
    case "calh":
    case "cals":
      return c;
    case "drive": {
      const { l, r } = args;
      if (!isNum(l) || !isNum(r)) throw new Error("drive needs numbers l and r");
      const clamp = (v) => Math.round(Math.max(-DRIVE_LIMIT, Math.min(DRIVE_LIMIT, v)));
      return `drive ${clamp(l)} ${clamp(r)}`;
    }
    case "target": {
      const { lat, lon } = args;
      if (!isNum(lat) || !isNum(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        throw new Error("target needs valid lat and lon");
      }
      return `target ${fmt(lat, 7)} ${fmt(lon, 7)}`;
    }
    case "speed": {
      const { value } = args;
      if (!isNum(value)) throw new Error("speed needs a number");
      return `speed ${Math.round(Math.max(10, Math.min(100, value)))}`;
    }
    case "wait": {
      const { value } = args;
      if (!isNum(value)) throw new Error("wait needs minutes");
      return `wait ${Math.round(Math.max(0, Math.min(30, value)))}`;
    }
    default:
      throw new Error(`Unknown command: ${command}`);
  }
};

export const sendBoatText = async (text, { qos = 1 } = {}) => {
  await publishMessage(BOAT_COMMAND_TOPIC, text, { qos });
};

// One control command from a user (REST or WebSocket).
export const sendControl = async (user, command, args = {}, { log = true } = {}) => {
  const text = buildCommandText(command, args);
  const isDrive = text.startsWith("drive");

  // Drive goes out fast (QoS 0) and often; everything else QoS 1.
  await sendBoatText(text, { qos: isDrive ? 0 : 1 });

  if (log && !isDrive) {
    await prisma.controlLog.create({
      data: { userId: user?.id ?? null, command: text },
    });
    pushLog({ kind: "command", text, user: user?.name ?? "system" });
  }

  return text;
};

export const getControlHistory = async (limit = 50) =>
  prisma.controlLog.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(Number(limit) || 50, 1), 500),
    include: { user: { select: { id: true, name: true } } },
  });
