import { Router } from "express";
import {
    createNewPool
} from "../controllers/poolController";
import auth from "../middlewares/auth";

const router = Router();

router.post("/", auth, createNewPool);

export default router;
