"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReferralCode = generateReferralCode;
const crypto_1 = __importDefault(require("crypto"));
function generateReferralCode() {
    return crypto_1.default.randomBytes(6).toString("base64url").toUpperCase();
}
