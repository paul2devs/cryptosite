"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const adminAuthController_1 = require("../controllers/adminAuthController");
const router = (0, express_1.Router)();
router.post("/login", [(0, express_validator_1.body)("email").isEmail().normalizeEmail(), (0, express_validator_1.body)("password").isLength({ min: 8 })], adminAuthController_1.adminLogin);
exports.default = router;
