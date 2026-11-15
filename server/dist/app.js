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
const cache_1 = require("./config/cache");
const corsOrigins_1 = require("./config/corsOrigins");
const env_1 = require("./config/env");
const errorHandler_1 = require("./middleware/errorHandler");
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
const operationsRoutes_1 = __importDefault(require("./routes/operationsRoutes"));
const membershipService_1 = require("./services/membershipService");
const investmentLevelService_1 = require("./services/investmentLevelService");
const gamificationService_1 = require("./services/gamificationService");
const adminBootstrapService_1 = require("./services/adminBootstrapService");
const bonusEngineService_1 = require("./services/bonusEngineService");
const rewardService_1 = require("./services/rewardService");
const platformSettingsService_1 = require("./services/platformSettingsService");
require("./models");
const app = (0, express_1.default)();
const corsOptions = {
    origin: (origin, callback) => {
        if ((0, corsOrigins_1.isOriginAllowed)(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "Accept", "X-Requested-With"],
    exposedHeaders: ["Content-Type"]
};
app.use(errorHandler_1.correlationIdMiddleware);
app.use((0, cors_1.default)(corsOptions));
app.options("*", (0, cors_1.default)(corsOptions));
app.use(express_1.default.json({ limit: "1mb" }));
app.use((0, cookie_parser_1.default)());
app.get("/api/health", (_req, res) => {
    const db = (0, database_1.getDatabaseStatus)();
    const cache = (0, cache_1.getCacheStatus)();
    const healthy = db.ok;
    res.status(healthy ? 200 : 503).json({
        status: healthy ? "ok" : "degraded",
        api: { ok: true },
        server: {
            ok: true,
            uptimeSeconds: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
            nodeEnv: process.env.NODE_ENV || "development"
        },
        database: db,
        cache
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
app.use("/api/operations", operationsRoutes_1.default);
app.use(errorHandler_1.notFoundHandler);
app.use(errorHandler_1.errorHandler);
async function startApp() {
    (0, env_1.validateCoreEnv)();
    (0, env_1.logEnvWarnings)();
    await (0, database_1.initDatabase)();
    await (0, gamificationService_1.ensureDefaultLevels)();
    await (0, membershipService_1.ensureDefaultMembershipTiers)();
    await (0, membershipService_1.ensureDefaultMembershipBenefits)();
    await (0, investmentLevelService_1.ensureDefaultInvestmentLevels)();
    await (0, investmentLevelService_1.ensureDefaultInvestmentLevelBenefits)();
    await (0, platformSettingsService_1.ensurePlatformSettings)();
    await (0, bonusEngineService_1.ensureDefaultBonusCampaign)();
    await (0, rewardService_1.ensureDefaultRewards)();
    await (0, adminBootstrapService_1.ensureAdminAccount)();
}
exports.default = app;
