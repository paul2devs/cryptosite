"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const socialFeedController_1 = require("../controllers/socialFeedController");
const router = (0, express_1.Router)();
router.get("/", auth_1.authenticate, socialFeedController_1.getSocialFeed);
exports.default = router;
