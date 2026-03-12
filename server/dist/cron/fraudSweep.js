"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleFraudSweep = scheduleFraudSweep;
const node_cron_1 = __importDefault(require("node-cron"));
const fraudService_1 = require("../services/fraudService");
function scheduleFraudSweep() {
    node_cron_1.default.schedule("45 * * * *", async () => {
        await (0, fraudService_1.runFraudSweep)();
    });
}
