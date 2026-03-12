import cron from "node-cron";
import { runBonusOptimization } from "../services/bonusOptimizationService";

export function scheduleBonusOptimization(): void {
  cron.schedule("*/30 * * * *", async () => {
    await runBonusOptimization();
  });
}

