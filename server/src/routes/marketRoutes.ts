import { Router } from "express";
import { getMarketPriceForCoin, getMarketPrices } from "../controllers/marketController";

const router = Router();

router.get("/prices", getMarketPrices);
router.get("/coin/:symbol", getMarketPriceForCoin);

export default router;

