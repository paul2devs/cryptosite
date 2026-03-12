"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAccessToken = signAccessToken;
exports.signRefreshToken = signRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const accessSecret = (0, env_1.requireEnv)("JWT_ACCESS_SECRET");
const refreshSecret = (0, env_1.requireEnv)("JWT_REFRESH_SECRET");
function signAccessToken(payload) {
    return jsonwebtoken_1.default.sign(payload, accessSecret, { expiresIn: "15m" });
}
function signRefreshToken(payload) {
    return jsonwebtoken_1.default.sign(payload, refreshSecret, { expiresIn: "7d" });
}
function verifyAccessToken(token) {
    return jsonwebtoken_1.default.verify(token, accessSecret);
}
function verifyRefreshToken(token) {
    return jsonwebtoken_1.default.verify(token, refreshSecret);
}
