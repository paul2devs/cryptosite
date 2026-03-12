import { Op, fn, col, literal } from "sequelize";
import { UserActivityEvent } from "../models/UserActivityEvent";

export async function getActivityHeatmap(days: number): Promise<
  Array<{
    dow: number;
    hour: number;
    count: number;
  }>
> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = (await UserActivityEvent.findAll({
    where: { timestamp: { [Op.gte]: since } },
    attributes: [
      [fn("EXTRACT", literal("DOW FROM timestamp")), "dow"],
      [fn("EXTRACT", literal("HOUR FROM timestamp")), "hour"],
      [fn("COUNT", col("id")), "count"]
    ],
    group: [literal("dow") as any, literal("hour") as any],
    order: [[literal("dow") as any, "ASC"], [literal("hour") as any, "ASC"]]
  })) as any[];

  return rows.map((r) => ({
    dow: Number(r.get("dow")),
    hour: Number(r.get("hour")),
    count: Number(r.get("count"))
  }));
}

