import "./config/env";
import http from "http";
import app, { startApp } from "./app";
import { scheduleStreakReset } from "./cron/streakReset";
import { scheduleMarketDataRefresh } from "./cron/marketData";
import { scheduleBonusWatcher } from "./cron/bonusScheduler";
import { scheduleMarketAlerts } from "./cron/marketAlerts";
import { scheduleEarningsEngine } from "./cron/earningsEngine";
import { scheduleMultiplierWatcher } from "./cron/multiplierWatcher";
import { scheduleRetentionEngine } from "./cron/retention";
import { initSocketServer } from "./realtime/socket";
import { scheduleAIPersonalization } from "./cron/aiPersonalization";
import { scheduleChurnDetection } from "./cron/churnDetection";
import { scheduleBonusOptimization } from "./cron/bonusOptimization";
import { scheduleFraudSweep } from "./cron/fraudSweep";

const port = Number(process.env.PORT || 4000);

startApp()
  .then(() => {
    const server = http.createServer(app);
    initSocketServer(server);
    scheduleStreakReset();
    scheduleMarketDataRefresh();
    scheduleBonusWatcher();
    scheduleMarketAlerts();
    scheduleEarningsEngine();
    scheduleMultiplierWatcher();
    scheduleRetentionEngine();
    scheduleBonusOptimization();
    scheduleChurnDetection();
    scheduleAIPersonalization();
    scheduleFraudSweep();
    server.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`Server running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to start application", error);
    process.exit(1);
  });

