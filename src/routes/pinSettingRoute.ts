import { Router } from "express";
import pinSettingsController from "../controllers/pinSettingsController";
import auth from "../middlewares/auth";

const router = Router();

router.post("/",auth, pinSettingsController.createPinSettings);
router.get("/",auth, pinSettingsController.getAllPinSettings);
router.put("/:id",auth, pinSettingsController.updatePinSettings);

export default router;
