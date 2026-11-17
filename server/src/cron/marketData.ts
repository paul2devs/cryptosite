import cron from "node-cron";
import { getMarketRefreshIntervalMs, refreshMarketData } from "../services/marketDataService";

let scheduled = false;

/**
 * Collapse the configured refresh interval (milliseconds) into a cron
 * expression. `refreshMarketData` gates on the same interval internally, so an
 * accidental extra trigger can never increase upstream provider traffic.
 */
function cronExpressionForInterval(intervalMs: number): string {
  const seconds = Math.max(5, Math.round(intervalMs / 1000));
  if (seconds < 60) {
    return `*/${seconds} * * * * *`;
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `*/${minutes} * * * *`;
}

/**
 * Start the single central refresh used by every instance. It runs on a fixed
 * schedule (not per visitor) so provider rate limits are respected, and primes
 * once at startup so the first request does not wait on a cold cache.
 */
export function scheduleMarketDataRefresh(): void {
  if (scheduled) {
    return;
  }
  scheduled = true;

  cron.schedule(cronExpressionForInterval(getMarketRefreshIntervalMs()), () => {
    void refreshMarketData();
  });

  void refreshMarketData(true);
}
