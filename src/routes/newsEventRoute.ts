import { Router } from "express";
import {
  createNewsEvent,
  getPublishedNewsEvents,
  getAllNewsEvents,
  getNewsEventById,
  updateNewsEvent,
  deleteNewsEvent,
  togglePublishStatus,
} from "../controllers/newsEventController";

import auth from "../middlewares/auth";
import { upload } from "../utils/multer";

const router = Router();

router.post("/", auth, upload.array("image", 5), createNewsEvent);
router.post("/published", getPublishedNewsEvents);
router.get("/", auth, getAllNewsEvents);
router.get("/id", getNewsEventById);
router.put("/:id", auth, upload.array("image", 5), updateNewsEvent);
router.delete("/", auth, deleteNewsEvent);
router.patch("/toggle-publish", auth, togglePublishStatus);

export default router;
