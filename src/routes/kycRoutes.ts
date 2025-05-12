import express from "express";
import kycController from "../controllers/kycController";
import auth from "../middlewares/auth";
import { upload } from "../utils/multer";

const router = express.Router();

router.post(
  "/",
  auth,
  upload.fields([
    { name: "idProofFileFront", maxCount: 1 },
    { name: "idProofFileBack", maxCount: 1 },
  ]),
  kycController.submitKYC
);
router.get("/user", auth, kycController.getUserKYCDetail);
router.put("/:id/status", auth, kycController.updateKYCStatus);
router.post(
  "/update",
  auth,
  upload.fields([
    { name: "idProofFileFront", maxCount: 1 },
    { name: "idProofFileBack", maxCount: 1 },
  ]),
  kycController.updateUserKYC
);

export default router;
