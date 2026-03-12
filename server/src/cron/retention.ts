import cron from "node-cron";
import { Op } from "sequelize";
import { Deposit } from "../models/Deposit";
import { Notification } from "../models/Notification";
import { User } from "../models/User";
import { getUserProgression } from "../services/gamificationService";
import { grantTemporaryMultiplier } from "../services/multiplierService";

export function scheduleRetentionEngine(): void {
  cron.schedule("0 * * * *", async () => {
    try {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      const users = await User.findAll();

      for (const user of users) {
        const progression = await getUserProgression(user);
        const lastActivity = user.last_activity_at;

        const lastDeposit = await Deposit.findOne({
          where: { user_id: user.user_id, status: "Approved" },
          order: [["timestamp", "DESC"]]
        });

        const inactive =
          !lastActivity || lastActivity < threeDaysAgo || !lastDeposit;
        const closeToNext =
          progression.xpToNext !== null && progression.xpToNext <= 50;

        if (inactive) {
          await grantTemporaryMultiplier({
            user,
            type: "retention",
            value: 0.1,
            durationMinutes: 60 * 24
          });
          await Notification.create({
            type: "retention_bonus",
            message:
              "Welcome back bonus: limited-time earnings boost active for the next 24 hours.",
            user_id: user.user_id
          });
          continue;
        }

        if (closeToNext && lastActivity && lastActivity >= dayAgo) {
          await grantTemporaryMultiplier({
            user,
            type: "retention",
            value: 0.05,
            durationMinutes: 60 * 6
          });
          await Notification.create({
            type: "retention_nudge",
            message:
              "You are very close to the next level. A temporary XP boost is active on your next deposits.",
            user_id: user.user_id
          });
        }
      }
    } catch {
      // swallow errors so the scheduler keeps running
    }
  });
}

