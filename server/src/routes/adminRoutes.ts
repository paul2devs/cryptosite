import { Router } from "express";
import { getRiskFlags, getUserStats } from "../controllers/adminController";
import {
  getAdminActivityHeatmap,
  getAdminAnalyticsOverview
} from "../controllers/analyticsController";
import { authenticate, requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/users_stats", authenticate, requireAdmin, getUserStats);
router.get("/risk_flags", authenticate, requireAdmin, getRiskFlags);
router.get("/analytics/overview", authenticate, requireAdmin, getAdminAnalyticsOverview);
router.get("/analytics/heatmap", authenticate, requireAdmin, getAdminActivityHeatmap);

export default router;

