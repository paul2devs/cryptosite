import cron from "node-cron";
import { getAllMarketPrices } from "../services/marketDataService";
import { User } from "../models/User";
import { Notification } from "../models/Notification";

let scheduled = false;
let lastAlertKey: string | null = null;

export function scheduleMarketAlerts(): void {
  if (scheduled) {
    return;
  }
  scheduled = true;

  cron.schedule("*/5 * * * *", async () => {
    const prices = await getAllMarketPrices();
    const btc = prices.BTC;
    const eth = prices.ETH;

    if (!btc || !eth) {
      return;
    }

    const alerts: string[] = [];

    if (btc.change24h >= 5) {
      alerts.push(`BTC is up ${btc.change24h.toFixed(1)}% in the last 24h`);
    } else if (btc.change24h <= -5) {
      alerts.push(`BTC is down ${btc.change24h.toFixed(1)}% in the last 24h`);
    }

    if (eth.change24h >= 5) {
      alerts.push(`ETH is up ${eth.change24h.toFixed(1)}% in the last 24h`);
    } else if (eth.change24h <= -5) {
      alerts.push(`ETH is down ${eth.change24h.toFixed(1)}% in the last 24h`);
    }

    if (alerts.length === 0) {
      return;
    }

    const key = alerts.join("|");
    if (key === lastAlertKey) {
      return;
    }
    lastAlertKey = key;

    const users = await User.findAll();
    await Promise.all(
      users.map((user: User) =>
        Promise.all(
          alerts.map((message) =>
            Notification.create({
              type: "market_alert",
              message,
              user_id: user.user_id
            })
          )
        )
      )
    );
  });
}

