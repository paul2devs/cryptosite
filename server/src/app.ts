import "./config/env";
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import { getDatabaseStatus, initDatabase } from "./config/database";
import { validateCoreEnv } from "./config/env";
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
import { ensureDefaultLevels } from "./services/gamificationService";
import { ensureAdminAccount } from "./services/adminBootstrapService";
import "./models";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  const db = getDatabaseStatus();
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
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.headersSent) {
    return;
  }
  res.status(500).json({
    message: "An unexpected error occurred. Please try again later.",
    error: process.env.NODE_ENV === "production" ? undefined : String(err)
  });
});

export async function startApp(): Promise<void> {
  validateCoreEnv();
  await initDatabase();
  await ensureDefaultLevels();
  await ensureAdminAccount();
}

export default app;

