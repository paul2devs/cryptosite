import cron from "node-cron";
import { Op } from "sequelize";
import { Notification } from "../models/Notification";
import { User } from "../models/User";

export function scheduleStreakReset(): void {
  cron.schedule("15 2 * * *", async () => {
    const now = new Date();
    const yesterday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1
    );

    const users = await User.findAll({
      where: {
        streak: { [Op.gt]: 0 },
        last_activity_at: {
          [Op.or]: [
            { [Op.lt]: yesterday },
            {
              [Op.is]: null
            }
          ]
        }
      }
    });

    for (const user of users) {
      user.streak = 0;
      await user.save();
      await Notification.create({
        type: "streak_reset",
        message: "Your streak has reset. Come back today to start again.",
        user_id: user.user_id
      });
    }
  });
}

