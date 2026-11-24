import express from "express";
import { issueCommand } from "../controllers/command.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

router.post("/", issueCommand);

export default router;