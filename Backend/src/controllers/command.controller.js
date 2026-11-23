import { createAndPublishCommand } from "../services/command.service.js";

export const issueCommand = async (req, res) => {
  try {
    const { type, missionId, payload } = req.body;

    const allowedTypes = [
      "START_MISSION",
      "STOP_MISSION",
      "RETURN_HOME",
      "EMERGENCY_STOP",
    ];

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        message: "Invalid command type",
      });
    }

    if (
      missionId !== undefined &&
      missionId !== null &&
      (!Number.isInteger(missionId) || missionId <= 0)
    ) {
      return res.status(400).json({
        message: "Invalid mission ID",
      });
    }

    if (
      payload !== undefined &&
      payload !== null &&
      (typeof payload !== "object" || Array.isArray(payload))
    ) {
      return res.status(400).json({
        message: "Payload must be a JSON object",
      });
    }

    const command = await createAndPublishCommand({
      type,
      issuedByUserId: req.user.id,
      missionId,
      payload,
    });

    return res.status(201).json({
      message: "Command published successfully",
      command,
    });
  } catch (error) {
    console.error("Command creation failed:", error.message);

    return res.status(500).json({
      message: error.message,
    });
  }
};