import { Router } from "express";
import walletSettingController from "../controllers/walletSettingController";
import auth from "../middlewares/auth";

const router = Router();

router.post("/", auth, walletSettingController.createWalletSetting);
router.get("/", auth, walletSettingController.getWalletSettings);
router.get("/:id", auth, walletSettingController.getWalletSettingsById);
router.put("/:id", auth, walletSettingController.updateWalletSetting);

export default router;
