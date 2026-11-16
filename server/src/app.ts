import "./config/env";
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import { getDatabaseStatus, initDatabase } from "./config/database";
import { getCacheStatus } from "./config/cache";
import { isOriginAllowed } from "./config/corsOrigins";
import { logEnvWarnings, validateCoreEnv } from "./config/env";
import {
  correlationIdMiddleware,
  errorHandler,
  notFoundHandler
} from "./middleware/errorHandler";
import authRoutes from "./routes/authRoutes";
import depositRoutes from "./routes/depositRoutes";
import withdrawalRoutes from "./routes/withdrawalRoutes";
import marketRoutes from "./routes/marketRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import userRoutes from "./routes/userRoutes";
import socialFeedRoutes from "./routes/socialFeedRoutes";
import adminRoutes from "./routes/adminRoutes";
import portfolioRoutes from "./routes/portfolioRoutes";
import leaderboardRoutes from "./routes/leaderboardRoutes";
import bonusRoutes from "./routes/bonusRoutes";
import aiRoutes from "./routes/aiRoutes";
import referralRoutes from "./routes/referralRoutes";
import adminAuthRoutes from "./routes/adminAuthRoutes";
import operationsRoutes from "./routes/operationsRoutes";
import emailPreviewRoutes from "./routes/emailPreviewRoutes";
import { ensureDefaultMembershipBenefits, ensureDefaultMembershipTiers } from "./services/membershipService";
import { ensureDefaultInvestmentLevelBenefits, ensureDefaultInvestmentLevels } from "./services/investmentLevelService";
import { ensureDefaultLevels } from "./services/gamificationService";
import { ensureAdminAccount } from "./services/adminBootstrapService";
import { ensureDefaultBonusCampaign } from "./services/bonusEngineService";
import { ensureDefaultRewards } from "./services/rewardService";
import { ensurePlatformSettings } from "./services/platformSettingsService";
import "./models";

const app = express();

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
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

app.use(correlationIdMiddleware);
app.use(
  cors(corsOptions)
);
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  const db = getDatabaseStatus();
  const cache = getCacheStatus();
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

app.use("/api/auth", authRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/deposits", depositRoutes);
app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/user", userRoutes);
app.use("/api/social_feed", socialFeedRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/bonuses", bonusRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/admin_auth", adminAuthRoutes);
app.use("/api/operations", operationsRoutes);

// Email preview is a development tool only: it is never mounted in production.
if (String(process.env.NODE_ENV || "").toLowerCase() !== "production") {
  app.use("/api/dev/email-preview", emailPreviewRoutes);
}

app.use(notFoundHandler);

app.use(errorHandler);

export async function startApp(): Promise<void> {
  validateCoreEnv();
  logEnvWarnings();
  await initDatabase();
  await ensureDefaultLevels();
  await ensureDefaultMembershipTiers();
  await ensureDefaultMembershipBenefits();
  await ensureDefaultInvestmentLevels();
  await ensureDefaultInvestmentLevelBenefits();
  await ensurePlatformSettings();
  await ensureDefaultBonusCampaign();
  await ensureDefaultRewards();
  await ensureAdminAccount();
}

export default app;

