import { Router } from "express";
import {
  sendNotificationAPI,
  notificationStream,
  getNotificationsList,
  getNotificationDetail,
  markReadController,
  deleteNotificationController
} from "../controllers/notification.controller.js";

const router = Router();

// used by other services via HTTP
router.post("/send", sendNotificationAPI);

// frontend SSE stream
router.get("/stream", notificationStream);

// list + detail + read + delete
router.get("/", getNotificationsList);
router.get("/:id", getNotificationDetail);
router.patch("/:id/read", markReadController);
router.delete("/:id", deleteNotificationController);

export default router;
