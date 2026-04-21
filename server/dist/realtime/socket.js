"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocketServer = initSocketServer;
exports.emitSocialProofDeposit = emitSocialProofDeposit;
exports.emitLevelUpEvent = emitLevelUpEvent;
const socket_io_1 = require("socket.io");
const jwt_1 = require("../utils/jwt");
let io = null;
const userSockets = new Map();
const defaultAllowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://cryptosite-seven.vercel.app"
];
const configuredOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
const allowedOrigins = new Set([...defaultAllowedOrigins, ...configuredOrigins]);
function initSocketServer(server) {
    if (io) {
        return;
    }
    io = new socket_io_1.Server(server, {
        cors: {
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.has(origin)) {
                    callback(null, true);
                    return;
                }
                callback(new Error(`Socket CORS origin not allowed: ${origin}`));
            },
            credentials: true
        }
    });
    io.use((socket, next) => {
        const token = (socket.handshake.auth && socket.handshake.auth.token) ||
            (socket.handshake.query && socket.handshake.query.token);
        if (!token) {
            next(new Error("Unauthorized"));
            return;
        }
        try {
            const payload = (0, jwt_1.verifyAccessToken)(token);
            socket.userId = payload.userId;
            next();
        }
        catch {
            next(new Error("Unauthorized"));
        }
    });
    io.on("connection", (socket) => {
        const authed = socket;
        const userId = authed.userId;
        if (userId) {
            if (!userSockets.has(userId)) {
                userSockets.set(userId, new Set());
            }
            userSockets.get(userId).add(socket.id);
        }
        socket.on("disconnect", () => {
            if (!userId) {
                return;
            }
            const set = userSockets.get(userId);
            if (!set) {
                return;
            }
            set.delete(socket.id);
            if (set.size === 0) {
                userSockets.delete(userId);
            }
        });
    });
}
function emitSocialProofDeposit(deposit, userAlias) {
    if (!io) {
        return;
    }
    const event = {
        id: deposit.deposit_id,
        type: "deposit",
        message: `${userAlias} just deposited ${deposit.amount} ${deposit.crypto_type}`,
        createdAt: new Date(deposit.timestamp || new Date()).toISOString()
    };
    io.emit("social_proof_event", event);
}
function emitLevelUpEvent(user, level) {
    if (!io) {
        return;
    }
    const alias = `${user.name.slice(0, 2).toUpperCase()}${user.user_id.slice(0, 2)}`;
    const event = {
        id: `${user.user_id}:${level}:${Date.now()}`,
        type: "level_up",
        message: `Level ${level} unlocked by user ${alias}`,
        createdAt: new Date().toISOString()
    };
    io.emit("social_proof_event", event);
}
