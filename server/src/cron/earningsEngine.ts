import cron from "node-cron";
import { processEarningsTick } from "../services/earningsEngineService";

let scheduled = false;
let running = false;

async function runTick(tickType: "hourly" | "daily"): Promise<void> {
  if (running) {
    return;
  }
  running = true;
  try {
    const summary = await processEarningsTick(tickType);
    // eslint-disable-next-line no-console
    console.log(
      `[earnings-engine] ${tickType} tick asOf=${summary.asOfDate} band=${summary.rateBand} ` +
        `positions=${summary.positionsEvaluated} accrued=${summary.periodsAccrued} ` +
        `amount=${summary.amountAccrued} alreadyPaid=${summary.skippedAlreadyAccrued} ` +
        `ineligible=${summary.skippedIneligible}`
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[earnings-engine] ${tickType} tick failed`, error);
  } finally {
    running = false;
  }
}

/**
 * Daily investment earnings schedule.
 *
 * The hourly tick reconciles any day that has become eligible since the last
 * run (catching up missed executions safely), and the midnight tick finalises
 * the day that just closed. Both ticks are idempotent per position/day, so an
 * overlap, a retry or a manual re-run can never credit earnings twice.
 */
export function scheduleEarningsEngine(): void {
  if (scheduled) {
    return;
  }
  scheduled = true;

  cron.schedule("0 * * * *", () => {
    void runTick("hourly");
  });

  cron.schedule("0 0 * * *", () => {
    void runTick("daily");
  });
}
