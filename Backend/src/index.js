import http from "node:http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const { connectMQTT } = await import("./mqtt/mqttClient.js");
const { subscribeToRobotTopics } = await import("./mqtt/mqttSubscriber.js");
const { checkRobotHeartbeat } = await import("./services/robot.service.js");
const { processCommandRetries } = await import(
  "./services/commandRetry.service.js"
);
const { attachWebSocket, onClientMessage, sendTo } = await import(
  "./realtime/ws.js"
);
const boat = await import("./services/boat.service.js");
const { isFirmwareProtocol, BOAT_PROTOCOL, BOAT_TOPIC_PREFIX } = await import(
  "./config/boat.js"
);

const { default: healthRouter } = await import("./routes/health.routes.js");
const { default: authRouter } = await import("./routes/auth.routes.js");
const { default: userRouter } = await import("./routes/user.routes.js");
const { default: robotRouter } = await import("./routes/robot.routes.js");
const { default: commandRouter } = await import("./routes/command.routes.js");
const { default: missionRouter } = await import("./routes/mission.routes.js");
const { default: controlRouter } = await import("./routes/control.routes.js");
const { default: telemetryRouter } = await import("./routes/telemetry.routes.js");
const { default: statsRouter } = await import("./routes/stats.routes.js");

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not set. Copy .env.example to .env first.");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: (process.env.FRONTEND_URL || "http://localhost:5173").split(","),
  })
);

app.use(express.json({ limit: "100kb" }));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/robots", robotRouter);
app.use("/api/commands", commandRouter);
app.use("/api/missions", missionRouter);
app.use("/api/control", controlRouter);
app.use("/api/telemetry", telemetryRouter);
app.use("/api/stats", statsRouter);

// Small public settings for the website.
app.get("/api/config", (req, res) => {
  res.json({ cameraUrl: process.env.CAMERA_URL || "" });
});

app.get("/", (req, res) => {
  res.json({
    message: "RiverGuard API is running",
  });
});

const server = http.createServer(app);

// Live data + remote control for the browser.
attachWebSocket(server, {
  onConnect: async (socket) => {
    sendTo(socket, "hello", {
      user: socket.user,
      ...boat.getBoatState(),
      log: boat.getRecentLog().slice(0, 50),
    });
  },
});

// Joystick drive commands arrive several times a second, so cap the rate.
const DRIVE_MIN_INTERVAL_MS = 150;

onClientMessage(async (socket, message) => {
  if (message.type !== "control") return;

  const { command, ...args } = message;
  const isDrive = String(command).toLowerCase() === "drive";

  if (isDrive) {
    const now = Date.now();
    if (socket.lastDrive && now - socket.lastDrive < DRIVE_MIN_INTERVAL_MS) return;
    socket.lastDrive = now;
  }

  const text = await boat.sendControl(socket.user, command, args);
  if (!isDrive) sendTo(socket, "control-sent", { text });
});

server.listen(PORT, () => {
  console.log(`RiverGuard API running at http://localhost:${PORT}`);
  console.log(
    `Boat protocol: ${BOAT_PROTOCOL}` +
      (isFirmwareProtocol() ? ` (topics ${BOAT_TOPIC_PREFIX}/telemetry and /cmd)` : "")
  );

  const mqttClient = connectMQTT();

  mqttClient.on("connect", () => {
    console.log("MQTT connection established. Subscribing to robot topics...");

    try {
      subscribeToRobotTopics();
    } catch (error) {
      console.error("Failed to subscribe to robot topics:", error.message);
    }
  });

  setInterval(async () => {
    try {
      if (isFirmwareProtocol()) {
        await boat.checkBoatTimeout();
        await boat.expireStartCommands();
      } else {
        await checkRobotHeartbeat();
      }
    } catch (error) {
      console.error("Robot heartbeat check failed:", error.message);
    }
  }, 5000);

  if (!isFirmwareProtocol()) {
    let isRetryWorkerRunning = false;

    setInterval(async () => {
      if (isRetryWorkerRunning) return;

      isRetryWorkerRunning = true;

      try {
        await processCommandRetries();
      } catch (error) {
        console.error("Command retry worker failed:", error.message);
      } finally {
        isRetryWorkerRunning = false;
      }
    }, 1000);
  }
});
