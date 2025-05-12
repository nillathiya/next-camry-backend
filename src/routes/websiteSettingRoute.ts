import { Router } from "express";
import websiteSettingController from "../controllers/websiteSettingController";
import auth from "../middlewares/auth";

const router = Router();

router.post("/", websiteSettingController.createWebsiteSetting);
router.get("/", auth, websiteSettingController.getWebsiteSettings);
router.get("/global", websiteSettingController.getGlobalWebsiteSettings);
router.get("/:id", websiteSettingController.getWebsiteSettingsById);
router.put("/:id", websiteSettingController.updateWebsiteSetting);
router.delete("/:id", websiteSettingController.deleteWebsiteSetting);

export default router;
