import express from "express";
import {
  createOperator,
  deactivateOperator,
} from "../controllers/user.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";

const router = express.Router();

router.use(authenticate, authorize("ADMIN"));

router.post("/", createOperator);

router.patch("/:id/deactivate", deactivateOperator);

export default router;