import { Router } from "express";
import companyInfoController from "../controllers/companyInfoController";
import auth from "../middlewares/auth";
import { upload } from "../utils/multer";

const router = Router();

router.post("/", companyInfoController.createCompanyInfo);
router.get("/", companyInfoController.getAllCompanyInfo);
router.get("/admin", auth, companyInfoController.getAllCompanyInfoForAdmin);
router.put(
  "/:id",
  auth,
  upload.single("file"),
  companyInfoController.updateCompanyInfo
);
router.delete("/:id", companyInfoController.deleteCompanyInfo);

export default router;
