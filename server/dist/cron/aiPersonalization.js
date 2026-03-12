"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleAIPersonalization = scheduleAIPersonalization;
const node_cron_1 = __importDefault(require("node-cron"));
const personalizationService_1 = require("../services/personalizationService");
function scheduleAIPersonalization() {
    node_cron_1.default.schedule("0 */6 * * *", async () => {
        await (0, personalizationService_1.runPersonalizationEngine)();
    });
}
