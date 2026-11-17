import { Router } from "express";
import { body } from "express-validator";
import {
  approveAdminDeposit,
  createDeposit,
  getAdminDepositCounts,
  getAdminDepositDetail,
  getAdminDeposits,
  getDepositAddresses,
  getDepositCapabilities,
  getDepositQuote,
  getUserDepositByReference,
  getUserDeposits,
  rejectAdminDeposit,
  rescanAdminDeposit,
  rescanUserDeposit,
  submitDepositTransaction
} from "../controllers/depositController";
import { authenticate, requireAdmin } from "../middleware/auth";

const router = Router();

/**
 * Create a pending crypto deposit request.
 *
 * `tx_hash` is intentionally NOT accepted here: a pending deposit only needs the
 * authenticated user, a supported asset/network and an amount. The transaction
 * hash is submitted later, after the user has paid, and is verified server-side.
 */
router.post(
  "/",
  authenticate,
  [
    body("crypto_type")
      .isString()
      .isIn(["BTC", "ETH", "SOL", "ERC20", "TRC20"]),
    body("amount").optional().isFloat({ gt: 0 }),
    body("usd_amount").optional().isFloat({ gt: 0 }),
    body("memo").optional({ nullable: true }).isString().isLength({ max: 200 }),
    body("idempotency_key").optional({ nullable: true }).isString().isLength({ min: 8, max: 120 })
  ],
  createDeposit
);

router.get("/addresses", getDepositAddresses);

router.get("/capabilities", getDepositCapabilities);

router.get("/quote", getDepositQuote);

router.get("/me", authenticate, getUserDeposits);

/* Admin crypto deposit management. Declared before "/:reference" so the static
 * admin paths are never captured by the reference route parameter. */
router.get("/admin", authenticate, requireAdmin, getAdminDeposits);

router.get("/admin/counts", authenticate, requireAdmin, getAdminDepositCounts);

router.get("/admin/:depositId", authenticate, requireAdmin, getAdminDepositDetail);

router.post(
  "/admin/:depositId/approve",
  authenticate,
  requireAdmin,
  [body("reason").optional({ nullable: true }).isString().isLength({ max: 500 })],
  approveAdminDeposit
);

router.post(
  "/admin/:depositId/reject",
  authenticate,
  requireAdmin,
  [body("reason").isString().isLength({ min: 3, max: 500 })],
  rejectAdminDeposit
);

router.post("/admin/:depositId/rescan", authenticate, requireAdmin, rescanAdminDeposit);

router.get("/:reference", authenticate, getUserDepositByReference);

router.post(
  "/:reference/transaction",
  authenticate,
  [body("tx_hash").isString().isLength({ min: 8, max: 200 })],
  submitDepositTransaction
);

router.post("/:reference/rescan", authenticate, rescanUserDeposit);

export default router;
