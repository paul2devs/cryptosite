"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireAdmin = requireAdmin;
const jwt_1 = require("../utils/jwt");
function authenticate(req, res, next) {
    const header = req.headers.authorization;
    const bearerToken = header && header.startsWith("Bearer ") ? header.split(" ")[1] : null;
    const cookieToken = typeof req.cookies?.accessToken === "string" && req.cookies.accessToken.length > 0
        ? req.cookies.accessToken
        : null;
    const token = bearerToken || cookieToken;
    if (!token) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    try {
        const payload = (0, jwt_1.verifyAccessToken)(token);
        req.user = { userId: payload.userId, isAdmin: payload.isAdmin };
        next();
    }
    catch (error) {
        res.status(401).json({ message: "Invalid or expired token" });
    }
}
function requireAdmin(req, res, next) {
    if (!req.user?.isAdmin) {
        res.status(403).json({ message: "Admin access required" });
        return;
    }
    next();
}
