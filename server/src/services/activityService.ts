import { UserActivityEvent, UserActivityType } from "../models/UserActivityEvent";

export async function trackUserActivity(
  userId: string,
  type: UserActivityType,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await UserActivityEvent.create({
    user_id: userId,
    type,
    metadata
  });
}

