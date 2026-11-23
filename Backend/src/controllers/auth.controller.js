import { loginUser } from "../services/auth.service.js";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const result = await loginUser(email, password);

    return res.status(200).json({
      message: "Login successful",
      ...result,
    });
  } catch (error) {
    if (error.message === "Invalid email or password") {
      return res.status(401).json({
        message: error.message,
      });
    }

    if (error.message === "This account has been deactivated") {
      return res.status(403).json({
        message: error.message,
      });
    }

    console.error("Login error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const getCurrentUser = (req, res) => {
  return res.status(200).json({
    user: req.user,
  });
};