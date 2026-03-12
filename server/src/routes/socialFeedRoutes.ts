import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getSocialFeed } from "../controllers/socialFeedController";

const router = Router();

router.get("/", authenticate, getSocialFeed);

export default router;

