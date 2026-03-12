"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const referralController_1 = require("../controllers/referralController");
const router = (0, express_1.Router)();
router.get("/dashboard", auth_1.authenticate, referralController_1.getMyReferralDashboard);
exports.default = router;
