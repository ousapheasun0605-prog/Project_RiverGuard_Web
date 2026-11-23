import "dotenv/config";
import prisma from "../src/config/prisma.js";

async function initializeRobot() {
  try {
    const robot = await prisma.robot.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        name: "RiverGuard-01",
        status: "UNKNOWN",
      },
    });

    console.log("RiverGuard robot initialized successfully!");
    console.log("Robot ID:", robot.id);
    console.log("Robot Name:", robot.name);
    console.log("Robot Status:", robot.status);
  } catch (error) {
    console.error("Robot initialization failed:", error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

initializeRobot();