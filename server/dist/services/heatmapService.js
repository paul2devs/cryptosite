"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActivityHeatmap = getActivityHeatmap;
const sequelize_1 = require("sequelize");
const UserActivityEvent_1 = require("../models/UserActivityEvent");
async function getActivityHeatmap(days) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = (await UserActivityEvent_1.UserActivityEvent.findAll({
        where: { timestamp: { [sequelize_1.Op.gte]: since } },
        attributes: [
            [(0, sequelize_1.fn)("EXTRACT", (0, sequelize_1.literal)("DOW FROM timestamp")), "dow"],
            [(0, sequelize_1.fn)("EXTRACT", (0, sequelize_1.literal)("HOUR FROM timestamp")), "hour"],
            [(0, sequelize_1.fn)("COUNT", (0, sequelize_1.col)("id")), "count"]
        ],
        group: [(0, sequelize_1.literal)("dow"), (0, sequelize_1.literal)("hour")],
        order: [[(0, sequelize_1.literal)("dow"), "ASC"], [(0, sequelize_1.literal)("hour"), "ASC"]]
    }));
    return rows.map((r) => ({
        dow: Number(r.get("dow")),
        hour: Number(r.get("hour")),
        count: Number(r.get("count"))
    }));
}
