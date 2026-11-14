import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getPortfolio, getPortfolioOverviewHandler } from "../controllers/portfolioController";

const router = Router();

router.get("/summary", authenticate, getPortfolio);
router.get("/overview", authenticate, getPortfolioOverviewHandler);

export default router;
