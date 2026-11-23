import prisma from "../config/prisma.js";

export const getHealth = async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: "ok",
      service: "RiverGuard API",
      database: "connected",
    });
  } catch (error) {
    console.error("Database connection failed:", error);

    res.status(503).json({
      status: "error",
      service: "RiverGuard API",
      database: "disconnected",
    });
  }
};