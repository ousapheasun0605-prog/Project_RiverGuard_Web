import { getRobot } from "../services/robot.service.js";

export const getRobotDetails = async (req, res) => {
  try {
    const robot = await getRobot();

    return res.status(200).json({
      message: "Robot information retrieved successfully",
      robot,
    });
  } catch (error) {
    if (error.message === "Robot not found") {
      return res.status(404).json({
        message: error.message,
      });
    }

    console.error("Get robot error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};