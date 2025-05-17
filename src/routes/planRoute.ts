import { Router } from "express";
import {
  createPlan,
  updatePlan,
  getPlans,
  deletePlan,
  deleteRow,
  addRow,
  updateRow,
} from "../controllers/planController";
import auth from "../middlewares/auth";

const router = Router();

router.get("/", auth, getPlans);
router.post("/", auth, createPlan);
router.put("/:id", auth, updatePlan);
router.delete("/:id", auth, deletePlan);
router.post("/add-row/:id", auth, addRow);
router.post("/update-row/:id", auth, updateRow);
router.post("/delete-row/:id", auth, deleteRow);
// router.post("/save-row", auth, saveRow);

export default router;
