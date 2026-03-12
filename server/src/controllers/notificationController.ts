import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { Notification } from "../models/Notification";
import { User } from "../models/User";
import { trackUserActivity } from "../services/activityService";

export async function getUserNotifications(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const notifications = await Notification.findAll({
      where: { user_id: req.user.userId },
      order: [["timestamp", "DESC"]]
    });
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
}

export async function getUnseenNotifications(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const notifications = await Notification.findAll({
      where: { user_id: req.user.userId, seen: false },
      order: [["timestamp", "DESC"]]
    });

    await Notification.update(
      { seen: true },
      {
        where: {
          user_id: req.user.userId,
          seen: false
        }
      }
    );

    res.status(200).json(notifications);
  } catch (error) {
    res.status(200).json([]);
  }
}

export async function markNotificationSeen(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const { id } = req.params;

  try {
    const notification = await Notification.findByPk(id);
    if (!notification || notification.user_id !== req.user.userId) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }

    notification.seen = true;
    await notification.save();

    res.status(200).json(notification);
  } catch (error) {
    res.status(500).json({ message: "Failed to update notification" });
  }
}

export async function trackNotificationClick(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const { id } = req.params;

  try {
    const notification = await Notification.findByPk(id);
    if (!notification || notification.user_id !== req.user.userId) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }

    await trackUserActivity(req.user.userId, "notification_click", {
      notification_id: id,
      type: notification.type
    });

    res.status(204).send();
  } catch {
    res.status(500).json({ message: "Failed to track click" });
  }
}

export async function createBroadcastNotification(
  req: Request,
  res: Response
): Promise<void> {
  const { type, message } = req.body as { type: string; message: string };

  if (!type || !message) {
    res.status(400).json({ message: "Type and message are required" });
    return;
  }

  try {
    const users = await User.findAll();
    await Promise.all(
      users.map((user) =>
        Notification.create({
          type,
          message,
          user_id: user.user_id
        })
      )
    );

    res.status(201).json({ created: users.length });
  } catch (error) {
    res.status(500).json({ message: "Failed to create broadcast" });
  }
}

