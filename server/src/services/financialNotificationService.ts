import { Notification } from "../models/Notification";
import { User } from "../models/User";
import { getNotificationTemplates } from "./platformSettingsService";

export type FinancialNotificationType =
  | "deposit_confirmed"
  | "promotional_bonus_credited"
  | "reward_granted"
  | "reward_redeemed"
  | "investment_allocation"
  | "verified_trading_activity"
  | "daily_performance"
  | "profit_realised"
  | "withdrawal_processing"
  | "withdrawal_completed";

const NOTIFICATION_FLAG: Record<FinancialNotificationType, string> = {
  deposit_confirmed: "deposit_updates",
  promotional_bonus_credited: "rewards_bonuses",
  reward_granted: "rewards_bonuses",
  reward_redeemed: "rewards_bonuses",
  investment_allocation: "investment_updates",
  verified_trading_activity: "investment_updates",
  daily_performance: "performance_updates",
  profit_realised: "performance_updates",
  withdrawal_processing: "withdrawal_updates",
  withdrawal_completed: "withdrawal_updates"
};

export type TemplateVariables = Record<string, string>;

export function renderTemplate(template: string, variables: TemplateVariables): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = variables[key];
    return value === undefined ? match : value;
  });
}

// Financial events are opt-out: an explicit `false` disables them, but a missing
// flag keeps the required disclosure enabled so users always receive an accurate
// record of money moving on their account.
export function notificationEnabled(settings: unknown, type: FinancialNotificationType): boolean {
  if (!settings || typeof settings !== "object") return true;
  const notifications = (settings as { notifications?: unknown }).notifications;
  if (!notifications || typeof notifications !== "object") return true;
  const value = (notifications as Record<string, unknown>)[NOTIFICATION_FLAG[type]];
  return typeof value === "boolean" ? value : true;
}

export async function notifyFinancialEvent(input: {
  userId: string;
  type: FinancialNotificationType;
  templateKey:
    | "depositConfirmation"
    | "promotionalBonusCredited"
    | "rewardGranted"
    | "rewardRedeemed"
    | "investmentAllocation"
    | "verifiedTradingActivity"
    | "dailyPerformance"
    | "profitRealised"
    | "withdrawalProcessing"
    | "withdrawalCompleted";
  variables: TemplateVariables;
  fallbackMessage: string;
}): Promise<Notification | null> {
  const user = await User.findByPk(input.userId);
  if (!user) return null;
  if (!notificationEnabled(user.account_settings, input.type)) return null;
  const templates = await getNotificationTemplates();
  const template = templates[input.templateKey] || input.fallbackMessage;
  const message = renderTemplate(template, input.variables).slice(0, 500);
  const existing = await Notification.findOne({
    where: { user_id: input.userId, type: input.type, message }
  });
  if (existing) return existing;
  return Notification.create({ user_id: input.userId, type: input.type, message });
}
