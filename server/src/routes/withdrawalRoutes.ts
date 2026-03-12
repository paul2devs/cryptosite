import { Router } from "express";
import rateLimit from "express-rate-limit";
import { body } from "express-validator";
import {
  createWithdrawal,
  getAllWithdrawals,
  getUserWithdrawals,
  updateWithdrawalStatus,
  getWithdrawalSummary
} from "../controllers/withdrawalController";
import { authenticate, requireAdmin } from "../middleware/auth";

const router = Router();

const withdrawalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WITHDRAWAL_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_WITHDRAWAL_MAX || 10),
  standardHeaders: true,
  legacyHeaders: false
});

router.post(
  "/",
  authenticate,
  withdrawalLimiter,
  [body("amount").isFloat({ gt: 0 })],
  createWithdrawal
);

router.get("/me", authenticate, getUserWithdrawals);
router.get("/summary", authenticate, getWithdrawalSummary);

router.get("/", authenticate, requireAdmin, getAllWithdrawals);

router.patch("/:id/status", authenticate, requireAdmin, updateWithdrawalStatus);

export default router;

