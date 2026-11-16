import { Router } from "express";
import rateLimit from "express-rate-limit";
import { body } from "express-validator";
import {
  forgotPassword,
  login,
  me,
  refreshToken,
  register,
  resendVerification,
  resetPassword,
  verifyEmail
} from "../controllers/authController";
import { authenticate } from "../middleware/auth";

const router = Router();

const verifyEmailLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_VERIFY_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_VERIFY_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false
});

const resendVerificationLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_RESEND_VERIFICATION_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_RESEND_VERIFICATION_MAX || 5),
  standardHeaders: true,
  legacyHeaders: false
});

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
  "/verify-email",
  verifyEmailLimiter,
  [body("token").isString().isLength({ min: 16, max: 256 })],
  verifyEmail
);

router.post(
  "/resend-verification",
  resendVerificationLimiter,
  [body("email").isEmail().normalizeEmail()],
  resendVerification
);

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
