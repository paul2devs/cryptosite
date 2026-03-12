import { Router } from "express";
import {
  createBroadcastNotification,
  getUnseenNotifications,
  getUserNotifications,
  markNotificationSeen,
  trackNotificationClick
} from "../controllers/notificationController";
import { authenticate, requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/me", authenticate, getUserNotifications);
router.get("/unseen", authenticate, getUnseenNotifications);
router.patch("/:id/seen", authenticate, markNotificationSeen);
router.post("/:id/click", authenticate, trackNotificationClick);
router.post("/broadcast", authenticate, requireAdmin, createBroadcastNotification);

export default router;

