import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getMyAIProfile, refreshMyAIProfile } from "../controllers/aiController";

const router = Router();

router.get("/me", authenticate, getMyAIProfile);
router.post("/me/refresh", authenticate, refreshMyAIProfile);

export default router;

