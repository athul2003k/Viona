import { Request, Response } from "express";
import {
  createAndBroadcastNotification,
  listNotifications,
  getNotificationById,
  markNotificationRead,
  deleteNotification
} from "../services/notification.service.js";
import { addClient, removeClient } from "../sse/connectionManager.js";

// HTTP endpoint for services that don't use Kafka
export const sendNotificationAPI = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const doc = await createAndBroadcastNotification(data);
    return res.status(201).json({ notification: doc });
  } catch (err) {
    console.error("Error in sendNotificationAPI:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// SSE: /notifications/stream?userId=123
export const notificationStream = (req: Request, res: Response) => {
  const userId = req.query.userId as string;

  if (!userId) {
    return res.status(400).json({ error: "userId query param required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Optional: send initial comment
  res.write(`: connected\n\n`);

  addClient(userId, res);

  req.on("close", () => {
    removeClient(userId, res);
    res.end();
  });
};

// GET /notifications?userId=123&priority=HIGH
export const getNotificationsList = async (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  const priority = req.query.priority as string | undefined;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const items = await listNotifications(userId, priority);
  return res.json({ notifications: items });
};

// GET /notifications/:id?userId=123
export const getNotificationDetail = async (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  const id = req.params.id;

  const notif = await getNotificationById(id, userId);
  if (!notif) return res.status(404).json({ error: "Not found" });

  return res.json({ notification: notif });
};

// PATCH /notifications/:id/read?userId=123
export const markReadController = async (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  const id = req.params.id;

  const updated = await markNotificationRead(id, userId);
  if (!updated) return res.status(404).json({ error: "Not found" });

  return res.json({ notification: updated });
};

// DELETE /notifications/:id?userId=123
export const deleteNotificationController = async (
  req: Request,
  res: Response
) => {
  const userId = req.query.userId as string;
  const id = req.params.id;
  console.log("deleteNotificationController", userId, id);
  const updated = await deleteNotification(id, userId);
  if (!updated) return res.status(404).json({ error: "Not found" });

  return res.json({ notification: updated });
};
