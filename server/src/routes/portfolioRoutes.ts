import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getPortfolio } from "../controllers/portfolioController";

const router = Router();

router.get("/summary", authenticate, getPortfolio);

export default router;

