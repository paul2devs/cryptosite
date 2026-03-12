"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./config/env");
const http_1 = __importDefault(require("http"));
const app_1 = __importStar(require("./app"));
const streakReset_1 = require("./cron/streakReset");
const marketData_1 = require("./cron/marketData");
const bonusScheduler_1 = require("./cron/bonusScheduler");
const marketAlerts_1 = require("./cron/marketAlerts");
const earningsEngine_1 = require("./cron/earningsEngine");
const multiplierWatcher_1 = require("./cron/multiplierWatcher");
const retention_1 = require("./cron/retention");
const socket_1 = require("./realtime/socket");
const aiPersonalization_1 = require("./cron/aiPersonalization");
const churnDetection_1 = require("./cron/churnDetection");
const bonusOptimization_1 = require("./cron/bonusOptimization");
const fraudSweep_1 = require("./cron/fraudSweep");
const port = Number(process.env.PORT || 4000);
(0, app_1.startApp)()
    .then(() => {
    const server = http_1.default.createServer(app_1.default);
    (0, socket_1.initSocketServer)(server);
    (0, streakReset_1.scheduleStreakReset)();
    (0, marketData_1.scheduleMarketDataRefresh)();
    (0, bonusScheduler_1.scheduleBonusWatcher)();
    (0, marketAlerts_1.scheduleMarketAlerts)();
    (0, earningsEngine_1.scheduleEarningsEngine)();
    (0, multiplierWatcher_1.scheduleMultiplierWatcher)();
    (0, retention_1.scheduleRetentionEngine)();
    (0, bonusOptimization_1.scheduleBonusOptimization)();
    (0, churnDetection_1.scheduleChurnDetection)();
    (0, aiPersonalization_1.scheduleAIPersonalization)();
    (0, fraudSweep_1.scheduleFraudSweep)();
    server.listen(port, () => {
        // eslint-disable-next-line no-console
        console.log(`Server running on http://localhost:${port}`);
    });
})
    .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to start application", error);
    process.exit(1);
});
