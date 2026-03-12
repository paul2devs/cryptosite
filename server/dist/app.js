"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startApp = startApp;
require("./config/env");
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_1 = __importDefault(require("express"));
const database_1 = require("./config/database");
const env_1 = require("./config/env");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const depositRoutes_1 = __importDefault(require("./routes/depositRoutes"));
const withdrawalRoutes_1 = __importDefault(require("./routes/withdrawalRoutes"));
const marketRoutes_1 = __importDefault(require("./routes/marketRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const socialFeedRoutes_1 = __importDefault(require("./routes/socialFeedRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const portfolioRoutes_1 = __importDefault(require("./routes/portfolioRoutes"));
const leaderboardRoutes_1 = __importDefault(require("./routes/leaderboardRoutes"));
const bonusRoutes_1 = __importDefault(require("./routes/bonusRoutes"));
const aiRoutes_1 = __importDefault(require("./routes/aiRoutes"));
const referralRoutes_1 = __importDefault(require("./routes/referralRoutes"));
const adminAuthRoutes_1 = __importDefault(require("./routes/adminAuthRoutes"));
const gamificationService_1 = require("./services/gamificationService");
const adminBootstrapService_1 = require("./services/adminBootstrapService");
require("./models");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.get("/api/health", (_req, res) => {
    const db = (0, database_1.getDatabaseStatus)();
    res.status(200).json({
        status: "ok",
        api: { ok: true },
        server: {
            ok: true,
            uptimeSeconds: Math.floor(process.uptime()),
            timestamp: new Date().toISOString()
        },
        database: db
    });
});
app.use("/api/auth", authRoutes_1.default);
app.use("/api/market", marketRoutes_1.default);
app.use("/api/deposits", depositRoutes_1.default);
app.use("/api/withdrawals", withdrawalRoutes_1.default);
app.use("/api/notifications", notificationRoutes_1.default);
app.use("/api/user", userRoutes_1.default);
app.use("/api/social_feed", socialFeedRoutes_1.default);
app.use("/api/admin", adminRoutes_1.default);
app.use("/api/portfolio", portfolioRoutes_1.default);
app.use("/api/leaderboard", leaderboardRoutes_1.default);
app.use("/api/bonuses", bonusRoutes_1.default);
app.use("/api/ai", aiRoutes_1.default);
app.use("/api/referrals", referralRoutes_1.default);
app.use("/api/admin_auth", adminAuthRoutes_1.default);
app.use((req, res, next) => {
    if (res.headersSent) {
        next();
        return;
    }
    res.status(404).json({
        message: "Endpoint not found",
        path: req.path
    });
});
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
    if (res.headersSent) {
        return;
    }
    res.status(500).json({
        message: "An unexpected error occurred. Please try again later.",
        error: process.env.NODE_ENV === "production" ? undefined : String(err)
    });
});
async function startApp() {
    (0, env_1.validateCoreEnv)();
    await (0, database_1.initDatabase)();
    await (0, gamificationService_1.ensureDefaultLevels)();
    await (0, adminBootstrapService_1.ensureAdminAccount)();
}
exports.default = app;
