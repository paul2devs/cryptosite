import cron from "node-cron";
import { Op } from "sequelize";
import { ActiveMultiplier } from "../models/ActiveMultiplier";
import { Notification } from "../models/Notification";
import { cleanExpiredMultipliers } from "../services/multiplierService";

export function scheduleMultiplierWatcher(): void {
  cron.schedule("*/5 * * * *", async () => {
    try {
      const now = new Date();
      const soon = new Date(now.getTime() + 10 * 60 * 1000);

      const expiring = await ActiveMultiplier.findAll({
        where: {
          expires_at: {
            [Op.gt]: now,
            [Op.lte]: soon
          }
        }
      });

      await Promise.all(
        expiring.map((m) =>
          Notification.create({
            type: "multiplier_expiring",
            message: `One of your multipliers (${m.type}) is ending soon`,
            user_id: m.user_id
          })
        )
      );

      await cleanExpiredMultipliers();
    } catch {
      // ignore scheduler errors
    }
  });
}

