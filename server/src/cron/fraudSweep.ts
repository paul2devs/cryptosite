import cron from "node-cron";
import { runFraudSweep } from "../services/fraudService";

export function scheduleFraudSweep(): void {
  cron.schedule("45 * * * *", async () => {
    await runFraudSweep();
  });
}

