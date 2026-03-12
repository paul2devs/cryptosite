"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bonusController_1 = require("../controllers/bonusController");
const router = (0, express_1.Router)();
router.get("/active", bonusController_1.getActiveBonusesHandler);
exports.default = router;
