import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import {
  getBoatState,
  getControlHistory,
  getRecentLog,
  sendControl,
} from "../services/boat.service.js";

const router = express.Router();

router.use(authenticate);

// Live state of the boat (last telemetry + online flag + recent activity).
router.get("/state", (req, res) => {
  res.json({ ...getBoatState(), log: getRecentLog().slice(0, 50) });
});

// Send one command: { command: "go" } or { command: "drive", l: 40, r: 40 }
router.post("/", async (req, res) => {
  const { command, ...args } = req.body || {};
  try {
    const text = await sendControl(req.user, command, args);
    res.status(201).json({ message: "Command sent", text });
  } catch (error) {
    const status = error.message.includes("not connected") ? 503 : 400;
    res.status(status).json({ message: error.message });
  }
});

router.get("/history", async (req, res) => {
  try {
    res.json({ history: await getControlHistory(req.query.limit) });
  } catch (error) {
    console.error("Control history failed:", error.message);
    res.status(500).json({ message: "Failed to load control history" });
  }
});

export default router;
