"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const portfolioController_1 = require("../controllers/portfolioController");
const router = (0, express_1.Router)();
router.get("/summary", auth_1.authenticate, portfolioController_1.getPortfolio);
exports.default = router;
