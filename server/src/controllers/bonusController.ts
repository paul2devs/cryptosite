import { Request, Response } from "express";
import { getPublicActiveBonuses } from "../services/bonusService";

export async function getActiveBonusesHandler(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const bonuses = await getPublicActiveBonuses();
    res.status(200).json(bonuses);
  } catch {
    res.status(200).json([]);
  }
}

