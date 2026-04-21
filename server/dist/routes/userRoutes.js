"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const userController_1 = require("../controllers/userController");
const router = (0, express_1.Router)();
router.get("/current_xp_level", auth_1.authenticate, userController_1.getCurrentXpLevel);
router.get("/settings", auth_1.authenticate, userController_1.getSettings);
router.patch("/settings/password", auth_1.authenticate, [(0, express_validator_1.body)("currentPassword").isString().isLength({ min: 8 }), (0, express_validator_1.body)("newPassword").isString().isLength({ min: 8 })], userController_1.changePassword);
router.post("/settings/wallets", auth_1.authenticate, [(0, express_validator_1.body)("asset").isString().isLength({ min: 2, max: 20 }), (0, express_validator_1.body)("address").isString().isLength({ min: 4, max: 200 }), (0, express_validator_1.body)("network").optional({ nullable: true }).isString().isLength({ min: 2, max: 20 })], userController_1.addWithdrawalWallet);
router.delete("/settings/wallets/:walletId", auth_1.authenticate, [(0, express_validator_1.param)("walletId").isUUID()], userController_1.removeWithdrawalWallet);
router.patch("/settings/notifications", auth_1.authenticate, [
    (0, express_validator_1.body)("deposit_updates").isBoolean(),
    (0, express_validator_1.body)("withdrawal_updates").isBoolean(),
    (0, express_validator_1.body)("rewards_bonuses").isBoolean(),
    (0, express_validator_1.body)("announcements").isBoolean()
], userController_1.updateNotificationSettings);
router.patch("/settings/preferences/language", auth_1.authenticate, [(0, express_validator_1.body)("language").isString().isLength({ min: 2, max: 5 })], userController_1.updateLanguage);
router.delete("/settings/account", auth_1.authenticate, [(0, express_validator_1.body)("password").isString().isLength({ min: 8 })], userController_1.deleteAccount);
exports.default = router;
