import { Router } from "express";
import userSettingController from "../controllers/userSettingController";

const router = Router();

router.post("/", userSettingController.createSettings);
router.get("/", userSettingController.getAllSettings);
router.get("/:id", userSettingController.getSettingsById);
router.put("/:id", userSettingController.updateSettings);
router.delete("/:id", userSettingController.deleteSettings);

export default router;
