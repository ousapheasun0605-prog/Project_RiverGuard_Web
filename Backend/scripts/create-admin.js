import "dotenv/config";
import bcrypt from "bcryptjs";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import prisma from "../src/config/prisma.js";

const rl = readline.createInterface({ input, output });

async function createAdmin() {
  try {
    const name = (await rl.question("Admin name: ")).trim();
    const email = (await rl.question("Admin email: "))
      .trim()
      .toLowerCase();

    const password = await rl.question("Admin password: ");

    if (!name || !email || !password) {
      throw new Error("All fields are required.");
    }

    if (password.length < 12) {
      throw new Error("Password must contain at least 12 characters.");
    }

    const existingAdmin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });

    if (existingAdmin) {
      throw new Error("An ADMIN account already exists.");
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error("An account with this email already exists.");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "ADMIN",
      },
    });

    console.log("\nADMIN account created successfully!");
    console.log("Name:", admin.name);
    console.log("Email:", admin.email);
    console.log("Role:", admin.role);
  } catch (error) {
    console.error("\nFailed to create ADMIN:", error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

createAdmin();