import { getMQTTClient } from "./mqttClient.js";

export const publishMessage = (topic, message) => {
  const client = getMQTTClient();

  if (!client || !client.connected) {
    throw new Error("MQTT client is not connected");
  }

  const payload =
    typeof message === "string"
      ? message
      : JSON.stringify(message);

  return new Promise((resolve, reject) => {
    client.publish(
      topic,
      payload,
      { qos: 1 },
      (error) => {
        if (error) {
          return reject(error);
        }

        resolve();
      }
    );
  });
};