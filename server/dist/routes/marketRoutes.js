"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const marketController_1 = require("../controllers/marketController");
const router = (0, express_1.Router)();
router.get("/prices", marketController_1.getMarketPrices);
router.get("/coin/:symbol", marketController_1.getMarketPriceForCoin);
exports.default = router;
