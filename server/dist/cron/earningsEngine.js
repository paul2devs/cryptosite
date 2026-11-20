"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleEarningsEngine = scheduleEarningsEngine;
const node_cron_1 = __importDefault(require("node-cron"));
const earningsEngineService_1 = require("../services/earningsEngineService");
let scheduled = false;
let running = false;
async function runTick(tickType) {
    if (running) {
        return;
    }
    running = true;
    try {
        const summary = await (0, earningsEngineService_1.processEarningsTick)(tickType);
        // eslint-disable-next-line no-console
        console.log(`[earnings-engine] ${tickType} tick asOf=${summary.asOfDate} rate=${summary.ratePercent}% ` +
            `positions=${summary.positionsEvaluated} accrued=${summary.periodsAccrued} ` +
            `amount=${summary.amountAccrued} alreadyPaid=${summary.skippedAlreadyAccrued} ` +
            `ineligible=${summary.skippedIneligible}`);
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error(`[earnings-engine] ${tickType} tick failed`, error);
    }
    finally {
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
function scheduleEarningsEngine() {
    if (scheduled) {
        return;
    }
    scheduled = true;
    node_cron_1.default.schedule("0 * * * *", () => {
        void runTick("hourly");
    });
    node_cron_1.default.schedule("0 0 * * *", () => {
        void runTick("daily");
    });
}
