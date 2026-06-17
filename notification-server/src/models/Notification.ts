import mongoose, { Document } from "mongoose";

export type NotificationPriority = "HIGH" | "MEDIUM" | "LOW";

export interface INotification extends Document {
  userId: string;
  title: string;
  message: string;
  type: string;       // e.g. ORDER, CHAT, SYSTEM
  priority: NotificationPriority;
  link?: string;      // URL path to open in frontend
  read: boolean;
  deleted: boolean;
  createdAt: Date;
}

const NotificationSchema = new mongoose.Schema<INotification>({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, required: true },
  priority: {
    type: String,
    enum: ["HIGH", "MEDIUM", "LOW"],
    default: "MEDIUM"
  },
  link: { type: String },
  read: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export const NotificationModel = mongoose.model<INotification>(
  "Notification",
  NotificationSchema
);
