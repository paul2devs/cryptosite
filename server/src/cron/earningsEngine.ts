import cron from "node-cron";
import { processEarningsTick } from "../services/earningsEngineService";

export function scheduleEarningsEngine(): void {
  cron.schedule("0 * * * *", async () => {
    try {
      await processEarningsTick("hourly");
    } catch {
      // swallow to avoid crashing scheduler
    }
  });

  cron.schedule("0 0 * * *", async () => {
    try {
      await processEarningsTick("daily");
    } catch {
      // swallow to avoid crashing scheduler
    }
  });
}

