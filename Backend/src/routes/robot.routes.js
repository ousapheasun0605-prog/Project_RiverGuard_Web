import express from "express";
import { getRobotDetails } from "../controllers/robot.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", authenticate, getRobotDetails);

export default router;