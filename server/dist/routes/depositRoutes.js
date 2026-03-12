"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const depositController_1 = require("../controllers/depositController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post("/", auth_1.authenticate, [
    (0, express_validator_1.body)("crypto_type")
        .isString()
        .isIn(["BTC", "ETH", "SOL", "ERC20", "TRC20"]),
    (0, express_validator_1.body)("amount").isFloat({ gt: 0 }),
    (0, express_validator_1.body)("tx_hash").isString().isLength({ min: 8, max: 200 })
], depositController_1.createDeposit);
router.get("/addresses", depositController_1.getDepositAddresses);
router.get("/me", auth_1.authenticate, depositController_1.getUserDeposits);
router.get("/", auth_1.authenticate, auth_1.requireAdmin, depositController_1.getAllDeposits);
router.patch("/:id/status", auth_1.authenticate, auth_1.requireAdmin, depositController_1.updateDepositStatus);
exports.default = router;
