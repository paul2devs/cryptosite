import { Router } from "express";
import { body } from "express-validator";
import {
  forgotPassword,
  login,
  me,
  refreshToken,
  register,
  resetPassword
} from "../controllers/authController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post(
  "/register",
  [
    body("name").isString().isLength({ min: 2, max: 100 }),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 }),
    body("walletAddress").optional().isString().isLength({ min: 4, max: 200 }),
    body("referralCode").optional().isString().isLength({ min: 4, max: 32 })
  ],
  register
);

router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 })
  ],
  login
);

router.post("/refresh", refreshToken);
router.get("/me", authenticate, me);

router.post(
  "/forgot-password",
  [body("email").isEmail().normalizeEmail()],
  forgotPassword
);

router.post(
  "/reset-password",
  [
    body("token").isString().isLength({ min: 16, max: 256 }),
    body("password").isLength({ min: 8 })
  ],
  resetPassword
);

export default router;

