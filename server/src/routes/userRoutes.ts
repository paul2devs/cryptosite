import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getCurrentXpLevel } from "../controllers/userController";

const router = Router();

router.get("/current_xp_level", authenticate, getCurrentXpLevel);

export default router;

