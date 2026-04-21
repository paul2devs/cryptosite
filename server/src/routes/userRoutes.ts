import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate } from "../middleware/auth";
import {
  addWithdrawalWallet,
  changePassword,
  deleteAccount,
  getCurrentXpLevel,
  getSettings,
  removeWithdrawalWallet,
  updateLanguage,
  updateNotificationSettings
} from "../controllers/userController";

const router = Router();

router.get("/current_xp_level", authenticate, getCurrentXpLevel);
router.get("/settings", authenticate, getSettings);
router.patch(
  "/settings/password",
  authenticate,
  [body("currentPassword").isString().isLength({ min: 8 }), body("newPassword").isString().isLength({ min: 8 })],
  changePassword
);
router.post(
  "/settings/wallets",
  authenticate,
  [body("asset").isString().isLength({ min: 2, max: 20 }), body("address").isString().isLength({ min: 4, max: 200 }), body("network").optional({ nullable: true }).isString().isLength({ min: 2, max: 20 })],
  addWithdrawalWallet
);
router.delete(
  "/settings/wallets/:walletId",
  authenticate,
  [param("walletId").isUUID()],
  removeWithdrawalWallet
);
router.patch(
  "/settings/notifications",
  authenticate,
  [
    body("deposit_updates").isBoolean(),
    body("withdrawal_updates").isBoolean(),
    body("rewards_bonuses").isBoolean(),
    body("announcements").isBoolean()
  ],
  updateNotificationSettings
);
router.patch(
  "/settings/preferences/language",
  authenticate,
  [body("language").isString().isLength({ min: 2, max: 5 })],
  updateLanguage
);
router.delete(
  "/settings/account",
  authenticate,
  [body("password").isString().isLength({ min: 8 })],
  deleteAccount
);

export default router;

