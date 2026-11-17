import cron from "node-cron";
import { runDepositMonitor } from "../services/depositMatchingService";

let scheduled = false;
let running = false;

function monitorIntervalSeconds(): number {
  const raw = Number(process.env.DEPOSIT_MONITOR_INTERVAL_SECONDS || 120);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 120;
  }
  return Math.max(30, Math.round(raw));
}

function cronExpressionForInterval(seconds: number): string {
  if (seconds < 60) {
    return `*/${seconds} * * * * *`;
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `*/${minutes} * * * *`;
}

/**
 * Poll the supported networks for incoming transfers and advance the deposits
 * that match them. The monitor is a single central schedule (not per visitor) so
 * provider rate limits are respected, and it never credits a wallet: a verified
 * transfer only moves a deposit to "awaiting administrator approval". An overlap
 * guard stops a slow scan from stacking runs.
 */
export function scheduleDepositMonitor(): void {
  if (scheduled) {
    return;
  }
  scheduled = true;

  cron.schedule(cronExpressionForInterval(monitorIntervalSeconds()), () => {
    if (running) {
      return;
    }
    running = true;
    void runDepositMonitor()
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error("[deposit-monitor] scan failed", error);
      })
      .finally(() => {
        running = false;
      });
  });
}
