import { Router } from "express";
import * as topUpController from "../controllers/topUpController";
import auth from "../middlewares/auth";

const router = Router();

router.post("/",auth, topUpController.createTopUp);

export default router;
