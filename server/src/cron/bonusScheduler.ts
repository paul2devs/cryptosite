import cron from "node-cron";
import { Op } from "sequelize";
import { Bonus } from "../models/Bonus";
import { User } from "../models/User";
import { Notification } from "../models/Notification";

let scheduled = false;

export function scheduleBonusWatcher(): void {
  if (scheduled) {
    return;
  }
  scheduled = true;

  cron.schedule("*/1 * * * *", async () => {
    const now = new Date();

    await Bonus.update(
      { is_active: true },
      {
        where: {
          start_time: { [Op.lte]: now },
          end_time: { [Op.gt]: now },
          is_active: false
        }
      }
    );

    await Bonus.update(
      { is_active: false },
      {
        where: {
          end_time: { [Op.lte]: now },
          is_active: true
        }
      }
    );

    const soon = new Date(now.getTime() + 10 * 60 * 1000);
    const expiring = await Bonus.findAll({
      where: {
        end_time: { [Op.gt]: now, [Op.lte]: soon }
      }
    });

    if (expiring.length === 0) {
      return;
    }

    const users = await User.findAll();
    await Promise.all(
      expiring.map(async (bonus: Bonus) => {
        const conditions = (bonus.conditions as any) || {};
        if (conditions.expiryAlertSent) {
          return;
        }
        await Promise.all(
          users.map((user: User) =>
            Notification.create({
              type: "bonus_expiring",
              message: `Bonus "${bonus.label}" ends soon`,
              user_id: user.user_id
            })
          )
        );
        bonus.conditions = {
          ...conditions,
          expiryAlertSent: true
        };
        await bonus.save();
      })
    );
  });
}

