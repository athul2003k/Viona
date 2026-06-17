import mongoose, { Schema, Document } from "mongoose";

export interface IStorageUser extends Document {
  _id: string; // Clerk user ID
  email: string;
  storageUsed: number;
  createdAt: Date;
  updatedAt: Date;
}

const StorageUserSchema = new Schema<IStorageUser>(
  {
    _id: { type: String, required: true }, // Clerk user ID as _id
    email: { type: String, required: true, unique: true },
    storageUsed: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    _id: false, // We supply _id manually
    toJSON: {
      virtuals: true,
      transform: (_doc: any, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const StorageUser = mongoose.model<IStorageUser>(
  "StorageUser",
  StorageUserSchema,
  "storage_users",
);
