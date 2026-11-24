import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import {
  createMissionController,
  getAllMissionsController,
  getMissionByIdController,
  startMissionController,
  stopMissionController,
} from "../controllers/mission.controller.js";

const router = express.Router();

router.get("/", authenticate, getAllMissionsController);
router.get("/:id", authenticate, getMissionByIdController);
router.post("/", authenticate, createMissionController);
router.post("/:id/start", authenticate, startMissionController);
router.post("/:id/stop", authenticate, stopMissionController);

export default router;