"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleChurnDetection = scheduleChurnDetection;
const node_cron_1 = __importDefault(require("node-cron"));
const churnService_1 = require("../services/churnService");
function scheduleChurnDetection() {
    node_cron_1.default.schedule("15 * * * *", async () => {
        await (0, churnService_1.runChurnDetection)();
    });
}
