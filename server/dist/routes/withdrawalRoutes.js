"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_validator_1 = require("express-validator");
const withdrawalController_1 = require("../controllers/withdrawalController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const withdrawalLimiter = (0, express_rate_limit_1.default)({
    windowMs: Number(process.env.RATE_LIMIT_WITHDRAWAL_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_WITHDRAWAL_MAX || 10),
    standardHeaders: true,
    legacyHeaders: false
});
router.post("/", auth_1.authenticate, withdrawalLimiter, [(0, express_validator_1.body)("amount").isFloat({ gt: 0 })], withdrawalController_1.createWithdrawal);
router.get("/me", auth_1.authenticate, withdrawalController_1.getUserWithdrawals);
router.get("/summary", auth_1.authenticate, withdrawalController_1.getWithdrawalSummary);
router.get("/", auth_1.authenticate, auth_1.requireAdmin, withdrawalController_1.getAllWithdrawals);
router.patch("/:id/status", auth_1.authenticate, auth_1.requireAdmin, withdrawalController_1.updateWithdrawalStatus);
exports.default = router;
