import {
  createUser,
  deactivateUser,
} from "../services/user.service.js";

export const createOperator = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email, and password are required",
      });
    }

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        message: "Invalid input types",
      });
    }

    if (!name.trim() || !email.trim()) {
      return res.status(400).json({
        message: "Name and email cannot be empty",
      });
    }

    if (password.length < 12) {
      return res.status(400).json({
        message: "Password must contain at least 12 characters",
      });
    }

    const user = await createUser({ name, email, password });

    return res.status(201).json({
      message: "Operator account created successfully",
      user,
    });
  } catch (error) {
    if (error.message === "Email is already registered") {
      return res.status(409).json({
        message: error.message,
      });
    }

    console.error("Create operator error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const deactivateOperator = async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    const user = await deactivateUser(userId, req.user.id);

    return res.status(200).json({
      message: "Operator account deactivated successfully",
      user,
    });
  } catch (error) {
    if (error.message === "User not found") {
      return res.status(404).json({
        message: error.message,
      });
    }

    if (
      error.message === "You cannot deactivate your own account" ||
      error.message === "Cannot deactivate an ADMIN account"
    ) {
      return res.status(403).json({
        message: error.message,
      });
    }

    console.error("Deactivate operator error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};