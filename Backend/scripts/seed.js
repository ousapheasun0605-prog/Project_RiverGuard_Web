// Runs on every start (Docker). Safe to repeat:
// - makes sure robot #1 exists
// - creates the first ADMIN from ADMIN_EMAIL / ADMIN_PASSWORD if there is no admin yet
import "dotenv/config";
import bcrypt from "bcryptjs";
import prisma from "../src/config/prisma.js";

async function seed() {
  try {
    await prisma.robot.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, name: process.env.ROBOT_NAME || "RiverGuard-01", status: "UNKNOWN" },
    });

    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || "";

    if (admin) {
      console.log(`Seed: admin already exists (${admin.email})`);
    } else if (!email || password.length < 12) {
      console.log("Seed: no admin yet. Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ chars) in .env");
    } else {
      await prisma.user.create({
        data: {
          name: process.env.ADMIN_NAME || "Admin",
          email,
          passwordHash: await bcrypt.hash(password, 12),
          role: "ADMIN",
        },
      });
      console.log(`Seed: created admin ${email}`);
    }
  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

seed();
