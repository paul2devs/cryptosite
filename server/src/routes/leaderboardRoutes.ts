import { Router } from "express";
import {
  getDepositorsLeaderboard,
  getEarningsLeaderboard,
  getGrowthLeaderboard,
  getStreaksLeaderboard
} from "../controllers/leaderboardController";

const router = Router();

router.get("/depositors", getDepositorsLeaderboard);
router.get("/earnings", getEarningsLeaderboard);
router.get("/streaks", getStreaksLeaderboard);
router.get("/growth", getGrowthLeaderboard);

export default router;

