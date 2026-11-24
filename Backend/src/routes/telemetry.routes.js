import express from "express";
import prisma from "../config/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

// GET /api/telemetry?missionId=3&minutes=60&limit=2000
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 5000);
    const where = {};

    if (req.query.missionId) {
      const missionId = Number(req.query.missionId);
      if (!Number.isInteger(missionId) || missionId <= 0) {
        return res.status(400).json({ message: "Invalid mission ID" });
      }
      where.missionId = missionId;
    }

    if (req.query.minutes) {
      const minutes = Math.min(Number(req.query.minutes) || 60, 60 * 24 * 30);
      where.recordedAt = { gte: new Date(Date.now() - minutes * 60000) };
    }

    const rows = await prisma.telemetry.findMany({
      where,
      orderBy: { recordedAt: "desc" },
      take: limit,
    });

    res.json({ telemetry: rows.reverse() });
  } catch (error) {
    console.error("Telemetry query failed:", error.message);
    res.status(500).json({ message: "Failed to load telemetry" });
  }
});

export default router;
