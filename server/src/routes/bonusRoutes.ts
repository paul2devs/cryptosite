import { Router } from "express";
import { getActiveBonusesHandler } from "../controllers/bonusController";

const router = Router();

router.get("/active", getActiveBonusesHandler);

export default router;

