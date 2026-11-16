import { Router } from "express";
import {
  getMarketDataDiagnostics,
  getMarketPriceForCoin,
  getMarketPrices
} from "../controllers/marketController";
import { authenticate, requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/prices", getMarketPrices);
router.get("/coin/:symbol", getMarketPriceForCoin);
router.get("/status", authenticate, requireAdmin, getMarketDataDiagnostics);

export default router;
