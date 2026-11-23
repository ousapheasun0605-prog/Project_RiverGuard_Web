import { getMQTTClient } from "./mqttClient.js";
import { saveTelemetry } from "../services/telemetry.service.js";
import { updateRobotStatus } from "../services/robot.service.js";
import { processCommandAcknowledgement } from "../services/command.service.js";
import { processMissionStatusUpdate } from "../services/mission.service.js";

const topics = [
  "robot/1/telemetry",
  "robot/1/status",
  "robot/1/ack",
  "robot/1/mission",
];

let messageListenerRegistered = false;

const handleMessage = async (topic, payload) => {
  const rawPayload = payload.toString();

  try {
    const message = JSON.parse(rawPayload);

    console.log("MQTT message received:", {
      topic,
      message,
    });

    if (topic === "robot/1/telemetry") {
      const telemetry = await saveTelemetry(message);
      console.log("Telemetry saved to database:", telemetry);
    }

    if (topic === "robot/1/status") {
      const robot = await updateRobotStatus(message.status);
      console.log("Robot status updated:", robot);
    }

    if (topic === "robot/1/ack") {
      const command = await processCommandAcknowledgement(message);
      console.log("Command acknowledgement processed:", command);
    }

    if (topic === "robot/1/mission") {
      const mission = await processMissionStatusUpdate(message);
      console.log("Mission status updated:", mission);
    }
    
  } catch (error) {
    console.error("MQTT message processing failed:", error.message);
  }
};

export const subscribeToRobotTopics = () => {
  const client = getMQTTClient();

  if (!client || !client.connected) {
    throw new Error("MQTT client is not connected");
  }

  if (!messageListenerRegistered) {
    client.on("message", handleMessage);
    messageListenerRegistered = true;
  }

  client.subscribe(topics, { qos: 1 }, (error, granted) => {
    if (error) {
      console.error("MQTT subscription failed:", error.message);
      return;
    }

    console.log("Subscribed to robot topics:", granted);
  });
};