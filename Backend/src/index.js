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

const { default: prisma } = await import("./config/prisma.js");
const { default: healthRouter } = await import("./routes/health.routes.js");
const { default: authRouter } = await import("./routes/auth.routes.js");
const { default: userRouter } = await import("./routes/user.routes.js");
const { default: robotRouter } = await import("./routes/robot.routes.js");
const { default: commandRouter } = await import("./routes/command.routes.js");
const { default: missionRouter } = await import("./routes/mission.routes.js");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  })
);

app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/robots", robotRouter);
app.use("/api/commands", commandRouter);
app.use("/api/missions", missionRouter);

app.get("/", (req, res) => {
  res.json({
    message: "RiverGuard API is running",
  });
});

app.listen(PORT, () => {
  console.log(`RiverGuard API running at http://localhost:${PORT}`);

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
      await checkRobotHeartbeat();
    } catch (error) {
      console.error("Robot heartbeat check failed:", error.message);
    }
  }, 5000);

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

});