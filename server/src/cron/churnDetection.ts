import cron from "node-cron";
import { runChurnDetection } from "../services/churnService";

export function scheduleChurnDetection(): void {
  cron.schedule("15 * * * *", async () => {
    await runChurnDetection();
  });
}

