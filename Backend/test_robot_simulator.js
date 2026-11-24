import "dotenv/config";
import mqtt from "mqtt";

const brokerUrl = process.env.MQTT_BROKER_URL || "mqtt://127.0.0.1:1883";

const client = mqtt.connect(brokerUrl, {
  clientId: "riverguard-robot-simulator",
  reconnectPeriod: 5000,
  clean: true,
});

client.on("connect", () => {
  console.log("Robot simulator connected to MQTT broker.");

  client.subscribe("robot/1/command", { qos: 1 }, (error) => {
    if (error) {
      console.error("Command subscription failed:", error.message);
      return;
    }

    console.log("Listening for commands on robot/1/command");
  });
});

client.on("message", (topic, payload) => {
  try {
    const command = JSON.parse(payload.toString());

    console.log("Command received:", command);

    if (!Number.isInteger(command.commandId)) {
      console.error("Invalid command ID. Ignoring command.");
      return;
    }

    const acknowledgement = {
      commandId: command.commandId,
      status: "ACKNOWLEDGED",
      message: `${command.type} command received by robot simulator`,
    };

    client.publish(
      "robot/1/ack",
      JSON.stringify(acknowledgement),
      { qos: 1 },
      (error) => {
        if (error) {
          console.error("Acknowledgement publishing failed:", error.message);
          return;
        }

        console.log("Acknowledgement sent:", acknowledgement);
      }
    );
  } catch (error) {
    console.error("Invalid command message:", error.message);
  }
});

client.on("error", (error) => {
  console.error("Robot simulator MQTT error:", error.message);
});