import mqtt from "mqtt";

let mqttClient = null;

export const connectMQTT = () => {
  if (mqttClient) {
    return mqttClient;
  }

  const brokerUrl = process.env.MQTT_BROKER_URL;

  if (!brokerUrl) {
    throw new Error("MQTT_BROKER_URL is not configured");
  }

  mqttClient = mqtt.connect(brokerUrl, {
    clientId: process.env.MQTT_CLIENT_ID || "riverguard-backend",
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    reconnectPeriod: 5000,
    connectTimeout: 30000,
    clean: true,
  });

  mqttClient.on("connect", () => {
    console.log("Connected to Mosquitto MQTT broker");
  });

  mqttClient.on("reconnect", () => {
    console.log("Reconnecting to MQTT broker...");
  });

  mqttClient.on("offline", () => {
    console.log("MQTT client is offline");
  });

  mqttClient.on("error", (error) => {
    console.error("MQTT connection error:", error.message);
  });

  mqttClient.on("close", () => {
    console.log("MQTT connection closed");
  });

  return mqttClient;
};

export const getMQTTClient = () => {
  return mqttClient;
};