"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireAdmin = requireAdmin;
const jwt_1 = require("../utils/jwt");
function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    try {
        const token = header.split(" ")[1];
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
