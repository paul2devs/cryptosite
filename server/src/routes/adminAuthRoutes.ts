import { Router } from "express";
import { body } from "express-validator";
import { adminLogin } from "../controllers/adminAuthController";

const router = Router();

router.post(
  "/login",
  [body("email").isEmail().normalizeEmail(), body("password").isLength({ min: 8 })],
  adminLogin
);

export default router;

