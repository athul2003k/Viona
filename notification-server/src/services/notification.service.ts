import {
    INotification,
    NotificationModel
  } from "../models/Notification.js";
  import { pushToUser } from "../sse/connectionManager.js";
  
  export interface CreateNotificationInput {
    userId: string;
    title: string;
    message: string;
    type: string;
    priority?: "HIGH" | "MEDIUM" | "LOW";
    link?: string;
  }
  
  export const createAndBroadcastNotification = async (
    payload: CreateNotificationInput
  ): Promise<INotification> => {
    const normalizedPriority =
      payload.priority?.toUpperCase() as "HIGH" | "MEDIUM" | "LOW";
  
    const doc = await NotificationModel.create({
      userId: payload.userId,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      priority: normalizedPriority || "MEDIUM",
      link: payload.link
    });
  
    pushToUser(payload.userId, {
      id: doc._id,
      title: doc.title,
      message: doc.message,
      type: doc.type,
      priority: doc.priority,
      link: doc.link,
      createdAt: doc.createdAt,
      read: doc.read
    });
  
    return doc;
  };
  
  export const listNotifications = async (userId: string, priority?: string) => {
    const query: any = { userId, deleted: false };
    if (priority) query.priority = priority.toUpperCase();
    return NotificationModel.find(query).sort({ createdAt: -1 }).lean();
  };
  
  export const getNotificationById = async (
    id: string,
    userId: string
  ) => {
    return NotificationModel.findOne({
      _id: id,
      userId,
      deleted: false
    }).lean();
  };
  
  export const markNotificationRead = async (id: string, userId: string) => {
    return NotificationModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: { read: true } },
      { new: true }
    ).lean();
  };
  
  export const deleteNotification = async (id: string, userId: string) => {
    return NotificationModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: { deleted: true } },
      { new: true }
    ).lean();
  };
  