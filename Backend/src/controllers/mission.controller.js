import {
  createMission,
  getAllMissions,
  getMissionById,
  startMission,
  stopMission,
} from "../services/mission.service.js";

const getErrorStatus = (error) => {
  if (error.message === "Mission not found") return 404;

  if (
    error.message.includes("already") ||
    error.message.includes("Only") ||
    error.message.includes("cannot") ||
    error.message.includes("offline") ||
    error.message.includes("No acknowledged") ||
    error.message.includes("another mission")
  ) {
    return 409;
  }

  return 400;
};

export const createMissionController = async (req, res) => {
  try {
    const mission = await createMission(req.user.id);

    return res.status(201).json({
      message: "Mission created successfully",
      mission,
    });
  } catch (error) {
    console.error("Mission creation failed:", error.message);

    return res.status(400).json({
      message: error.message,
    });
  }
};

export const getAllMissionsController = async (req, res) => {
  try {
    const missions = await getAllMissions();

    return res.status(200).json({
      count: missions.length,
      missions,
    });
  } catch (error) {
    console.error("Fetching missions failed:", error.message);

    return res.status(500).json({
      message: "Failed to retrieve missions",
    });
  }
};

export const getMissionByIdController = async (req, res) => {
  try {
    const missionId = Number(req.params.id);
    const mission = await getMissionById(missionId);

    return res.status(200).json({ mission });
  } catch (error) {
    console.error("Fetching mission failed:", error.message);

    return res.status(getErrorStatus(error)).json({
      message: error.message,
    });
  }
};

export const startMissionController = async (req, res) => {
  try {
    const missionId = Number(req.params.id);

    const result = await startMission(missionId, req.user.id);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Starting mission failed:", error.message);

    return res.status(getErrorStatus(error)).json({
      message: error.message,
    });
  }
};

export const stopMissionController = async (req, res) => {
  try {
    const missionId = Number(req.params.id);

    const result = await stopMission(missionId, req.user.id);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Stopping mission failed:", error.message);

    return res.status(getErrorStatus(error)).json({
      message: error.message,
    });
  }
};