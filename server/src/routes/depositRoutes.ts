import { Router } from "express";
import { body } from "express-validator";
import {
  createDeposit,
  getDepositAddresses,
  getAllDeposits,
  getUserDeposits,
  updateDepositStatus
} from "../controllers/depositController";
import { authenticate, requireAdmin } from "../middleware/auth";

const router = Router();

router.post(
  "/",
  authenticate,
  [
    body("crypto_type")
      .isString()
      .isIn(["BTC", "ETH", "SOL", "ERC20", "TRC20"]),
    body("amount").isFloat({ gt: 0 }),
    body("tx_hash").isString().isLength({ min: 8, max: 200 })
  ],
  createDeposit
);

router.get("/addresses", getDepositAddresses);

router.get("/me", authenticate, getUserDeposits);

router.get("/", authenticate, requireAdmin, getAllDeposits);

router.patch("/:id/status", authenticate, requireAdmin, updateDepositStatus);

export default router;

