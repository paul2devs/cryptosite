"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketPrices = getMarketPrices;
exports.getMarketPriceForCoin = getMarketPriceForCoin;
const marketDataService_1 = require("../services/marketDataService");
async function getMarketPrices(_req, res) {
    try {
        const data = await (0, marketDataService_1.getAllMarketPrices)();
        res.status(200).json(data);
    }
    catch {
        res.status(500).json({ message: "Failed to load market prices" });
    }
}
async function getMarketPriceForCoin(req, res) {
    const { symbol } = req.params;
    const upper = symbol.toUpperCase();
    if (!["BTC", "ETH", "SOL", "USDT", "BNB", "XRP"].includes(upper)) {
        res.status(400).json({ message: "Unsupported symbol" });
        return;
    }
    try {
        const point = await (0, marketDataService_1.getMarketPriceForSymbol)(upper);
        if (!point) {
            res.status(404).json({ message: "Price not available" });
            return;
        }
        res.status(200).json(point);
    }
    catch {
        res.status(500).json({ message: "Failed to load price" });
    }
}
