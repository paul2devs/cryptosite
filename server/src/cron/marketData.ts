import cron from "node-cron";
import { refreshMarketData } from "../services/marketDataService";

let scheduled = false;

export function scheduleMarketDataRefresh(): void {
  if (scheduled) {
    return;
  }
  scheduled = true;

  cron.schedule("*/15 * * * * *", async () => {
    await refreshMarketData();
  });
}

