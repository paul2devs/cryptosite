"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminLogin = adminLogin;
const bcrypt_1 = __importDefault(require("bcrypt"));
const express_validator_1 = require("express-validator");
const sequelize_1 = require("sequelize");
const User_1 = require("../models/User");
const jwt_1 = require("../utils/jwt");
const activityService_1 = require("../services/activityService");
async function adminLogin(req, res) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    const { email, password } = req.body;
    try {
        const user = await User_1.User.findOne({
            where: {
                email: { [sequelize_1.Op.iLike]: String(email).trim() }
            }
        });
        if (!user || !user.is_admin) {
            res.status(401).json({ message: "Invalid admin credentials" });
            return;
        }
        const match = await bcrypt_1.default.compare(password, user.password);
        if (!match) {
            res.status(401).json({ message: "Invalid admin credentials" });
            return;
        }
        const payload = { userId: user.user_id, isAdmin: true };
        const accessToken = (0, jwt_1.signAccessToken)(payload);
        const refreshToken = (0, jwt_1.signRefreshToken)(payload);
        res.status(200).json({
            admin: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                is_admin: true
            },
            accessToken,
            refreshToken
        });
        await (0, activityService_1.trackUserActivity)(user.user_id, "login", { source: "admin_login" });
    }
    catch {
        res.status(500).json({ message: "Admin login failed" });
    }
}
