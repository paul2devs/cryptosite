import { Request, Response } from "express";
import {
  getAllMarketPrices,
  getMarketDataStatus,
  getMarketPriceForSymbol,
  SupportedSymbol
} from "../services/marketDataService";

export async function getMarketPrices(_req: Request, res: Response): Promise<void> {
  try {
    const data = await getAllMarketPrices();
    res.status(200).json(data);
  } catch {
    res.status(500).json({ message: "Failed to load market prices" });
  }
}

export async function getMarketPriceForCoin(
  req: Request,
  res: Response
): Promise<void> {
  const { symbol } = req.params;
  const upper = symbol.toUpperCase() as SupportedSymbol;
  if (!["BTC", "ETH", "SOL", "USDT", "BNB", "XRP",].includes(upper)) {
    res.status(400).json({ message: "Unsupported symbol" });
    return;
  }

  try {
    const point = await getMarketPriceForSymbol(upper);
    if (!point) {
      res.status(404).json({ message: "Price not available" });
      return;
    }
    res.status(200).json(point);
  } catch {
    res.status(500).json({ message: "Failed to load price" });
  }
}

/**
 * Operator-facing diagnostics for the pricing pipeline. Restricted to platform
 * administrators because it exposes the last upstream error.
 */
export async function getMarketDataDiagnostics(_req: Request, res: Response): Promise<void> {
  try {
    const status = await getMarketDataStatus();
    res.status(200).json(status);
  } catch {
    res.status(500).json({ message: "Failed to load market data status" });
  }
}

