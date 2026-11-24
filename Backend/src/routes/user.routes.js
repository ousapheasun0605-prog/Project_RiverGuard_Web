import express from "express";
import {
  createOperator,
  deactivateOperator,
} from "../controllers/user.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import prisma from "../config/prisma.js";

const router = express.Router();

router.use(authenticate, authorize("ADMIN"));

router.get("/", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
    res.json({ users });
  } catch (error) {
    console.error("List users failed:", error.message);
    res.status(500).json({ message: "Failed to load users" });
  }
});

router.post("/", createOperator);

router.patch("/:id/deactivate", deactivateOperator);

export default router;