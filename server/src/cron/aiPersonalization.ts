import cron from "node-cron";
import { runPersonalizationEngine } from "../services/personalizationService";

export function scheduleAIPersonalization(): void {
  cron.schedule("0 */6 * * *", async () => {
    await runPersonalizationEngine();
  });
}

