import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getMyReferralDashboard } from "../controllers/referralController";

const router = Router();

router.get("/dashboard", authenticate, getMyReferralDashboard);

export default router;

