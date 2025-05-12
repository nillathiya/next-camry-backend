import { NextFunction, Request, Response, Router } from "express";
import adminSettingController from "../controllers/adminSettingController";
import auth from "../middlewares/auth";
import { AuthenticatedRequest } from "../types";

const router = Router();

router.post("/", adminSettingController.createSettings);
router.get(
  "/",
  auth,
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (Object.keys(req.query).length > 0) {
      return adminSettingController.getSettingsByQuery(req, res, next);
    }
    return adminSettingController.getAllSettings(req, res, next);
  }
);
// router.get("/:id", userSettingController.getSettingsById);
router.put("/:id", adminSettingController.updateSettings);
router.delete("/:id", adminSettingController.deleteSettings);

export default router;
