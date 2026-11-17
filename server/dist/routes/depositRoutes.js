"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const depositController_1 = require("../controllers/depositController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
/**
 * Create a pending crypto deposit request.
 *
 * `tx_hash` is intentionally NOT accepted here: a pending deposit only needs the
 * authenticated user, a supported asset/network and an amount. The transaction
 * hash is submitted later, after the user has paid, and is verified server-side.
 */
router.post("/", auth_1.authenticate, [
    (0, express_validator_1.body)("crypto_type")
        .isString()
        .isIn(["BTC", "ETH", "SOL", "ERC20", "TRC20"]),
    (0, express_validator_1.body)("amount").optional().isFloat({ gt: 0 }),
    (0, express_validator_1.body)("usd_amount").optional().isFloat({ gt: 0 }),
    (0, express_validator_1.body)("memo").optional({ nullable: true }).isString().isLength({ max: 200 }),
    (0, express_validator_1.body)("idempotency_key").optional({ nullable: true }).isString().isLength({ min: 8, max: 120 })
], depositController_1.createDeposit);
router.get("/addresses", depositController_1.getDepositAddresses);
router.get("/capabilities", depositController_1.getDepositCapabilities);
router.get("/quote", depositController_1.getDepositQuote);
router.get("/me", auth_1.authenticate, depositController_1.getUserDeposits);
/* Admin crypto deposit management. Declared before "/:reference" so the static
 * admin paths are never captured by the reference route parameter. */
router.get("/admin", auth_1.authenticate, auth_1.requireAdmin, depositController_1.getAdminDeposits);
router.get("/admin/counts", auth_1.authenticate, auth_1.requireAdmin, depositController_1.getAdminDepositCounts);
router.get("/admin/:depositId", auth_1.authenticate, auth_1.requireAdmin, depositController_1.getAdminDepositDetail);
router.post("/admin/:depositId/approve", auth_1.authenticate, auth_1.requireAdmin, [(0, express_validator_1.body)("reason").optional({ nullable: true }).isString().isLength({ max: 500 })], depositController_1.approveAdminDeposit);
router.post("/admin/:depositId/reject", auth_1.authenticate, auth_1.requireAdmin, [(0, express_validator_1.body)("reason").isString().isLength({ min: 3, max: 500 })], depositController_1.rejectAdminDeposit);
router.post("/admin/:depositId/rescan", auth_1.authenticate, auth_1.requireAdmin, depositController_1.rescanAdminDeposit);
router.get("/:reference", auth_1.authenticate, depositController_1.getUserDepositByReference);
router.post("/:reference/transaction", auth_1.authenticate, [(0, express_validator_1.body)("tx_hash").isString().isLength({ min: 8, max: 200 })], depositController_1.submitDepositTransaction);
router.post("/:reference/rescan", auth_1.authenticate, depositController_1.rescanUserDeposit);
exports.default = router;
