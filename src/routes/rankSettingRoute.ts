import { Router } from "express";
import {
  createRankSetting,
  updateRankSetting,
  getRankSettings,
  deleteRankSetting,
  deleteRow,
  saveRow,
  //   getUserRankAndTeamMetrics,
} from "../controllers/rankSettingController";
import auth from "../middlewares/auth";

const router = Router();

router.get("/", auth, getRankSettings);
router.post("/", auth, createRankSetting);
router.put("/:id", auth, updateRankSetting);
router.delete("/:id", auth, deleteRankSetting);
router.post("/delete-row", auth, deleteRow);
router.post("/save-row", auth, saveRow);
// router.get('/metrics', isAuthenticated, getUserRankAndTeamMetrics);

export default router;
