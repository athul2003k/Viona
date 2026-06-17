import mongoose, { Schema, Document } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface IFile extends Document {
  _id: string; // UUID string
  name: string;
  type: string;
  size: number;
  mimeType?: string;
  gcsKey?: string;
  orgId?: string | null;
  isOrgFolder: boolean;
  parentId?: string | null;
  ownerId: string;
  isStarred: boolean;
  isTrashed: boolean;
  trashedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const FileSchema = new Schema<IFile>(
  {
    _id: { type: String, default: () => uuidv4() },
    name: { type: String, required: true },
    type: { type: String, required: true },
    size: { type: Number, default: 0 },
    mimeType: { type: String, default: null },
    gcsKey: { type: String, default: null },
    orgId: { type: String, default: null },
    isOrgFolder: { type: Boolean, default: false },
    parentId: { type: String, default: null },
    ownerId: { type: String, required: true },
    isStarred: { type: Boolean, default: false },
    isTrashed: { type: Boolean, default: false },
    trashedAt: { type: Date, default: null },
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

// Indexes
FileSchema.index({ ownerId: 1, parentId: 1 });
FileSchema.index({ orgId: 1 });
FileSchema.index({ gcsKey: 1 });
// Prevents duplicate org subfolders
FileSchema.index(
  { orgId: 1, isOrgFolder: 1, parentId: 1 },
  { unique: true, partialFilterExpression: { isOrgFolder: true } }
);


export const File = mongoose.model<IFile>("File", FileSchema, "files");
