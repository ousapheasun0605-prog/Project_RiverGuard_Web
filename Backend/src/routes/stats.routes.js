import express from "express";
import prisma from "../config/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

const toRad = (d) => (d * Math.PI) / 180;

export const haversineMeters = (a, b) => {
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export const routeDistanceMeters = (points) => {
  let total = 0;
  const fixes = points.filter((p) => p.latitude != null && p.longitude != null);
  for (let i = 1; i < fixes.length; i += 1) {
    const step = haversineMeters(fixes[i - 1], fixes[i]);
    if (step < 200) total += step; // ignore GPS jumps
  }
  return total;
};

router.get("/", async (req, res) => {
  try {
    const missions = await prisma.mission.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        telemetry: {
          select: { latitude: true, longitude: true, speed: true },
          orderBy: { recordedAt: "asc" },
        },
        images: { select: { detections: { select: { category: true } } } },
      },
    });

    const byStatus = {};
    let totalDistance = 0;
    let totalSeconds = 0;
    const perMission = [];
    const perDay = {};

    for (const m of missions) {
      byStatus[m.status] = (byStatus[m.status] || 0) + 1;
      const distance = routeDistanceMeters(m.telemetry);
      totalDistance += distance;

      let seconds = 0;
      if (m.startedAt) {
        seconds = ((m.endedAt ?? new Date()).getTime() - m.startedAt.getTime()) / 1000;
        totalSeconds += seconds;
      }

      if (m.startedAt) {
        perMission.push({
          mission: m.missionCode,
          distance: Number((distance / 1000).toFixed(3)),
          minutes: Number((seconds / 60).toFixed(1)),
        });
        const day = m.startedAt.toISOString().slice(0, 10);
        perDay[day] = perDay[day] || { period: day, missions: 0, distance: 0 };
        perDay[day].missions += 1;
        perDay[day].distance = Number((perDay[day].distance + distance / 1000).toFixed(3));
      }
    }

    const wasteCounts = {};
    for (const m of missions) {
      for (const image of m.images) {
        for (const d of image.detections) {
          wasteCounts[d.category] = (wasteCounts[d.category] || 0) + 1;
        }
      }
    }

    const telemetryCount = await prisma.telemetry.count();

    res.json({
      missions: missions.length,
      byStatus,
      completed: byStatus.COMPLETED || 0,
      totalDistanceKm: Number((totalDistance / 1000).toFixed(3)),
      totalHours: Number((totalSeconds / 3600).toFixed(2)),
      telemetryCount,
      perMission: perMission.slice(-20),
      perDay: Object.values(perDay).slice(-30),
      waste: Object.entries(wasteCounts).map(([name, value]) => ({ name, value })),
    });
  } catch (error) {
    console.error("Stats failed:", error.message);
    res.status(500).json({ message: "Failed to load statistics" });
  }
});

export default router;
