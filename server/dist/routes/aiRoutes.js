"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const aiController_1 = require("../controllers/aiController");
const router = (0, express_1.Router)();
router.get("/me", auth_1.authenticate, aiController_1.getMyAIProfile);
router.post("/me/refresh", auth_1.authenticate, aiController_1.refreshMyAIProfile);
exports.default = router;
