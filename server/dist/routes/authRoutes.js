"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post("/register", [
    (0, express_validator_1.body)("name").isString().isLength({ min: 2, max: 100 }),
    (0, express_validator_1.body)("email").isEmail().normalizeEmail(),
    (0, express_validator_1.body)("password").isLength({ min: 8 }),
    (0, express_validator_1.body)("walletAddress").optional().isString().isLength({ min: 4, max: 200 }),
    (0, express_validator_1.body)("referralCode").optional().isString().isLength({ min: 4, max: 32 })
], authController_1.register);
router.post("/login", [
    (0, express_validator_1.body)("email").isEmail().normalizeEmail(),
    (0, express_validator_1.body)("password").isLength({ min: 8 })
], authController_1.login);
router.post("/refresh", authController_1.refreshToken);
router.get("/me", auth_1.authenticate, authController_1.me);
router.post("/forgot-password", [(0, express_validator_1.body)("email").isEmail().normalizeEmail()], authController_1.forgotPassword);
router.post("/reset-password", [
    (0, express_validator_1.body)("token").isString().isLength({ min: 16, max: 256 }),
    (0, express_validator_1.body)("password").isLength({ min: 8 })
], authController_1.resetPassword);
exports.default = router;
