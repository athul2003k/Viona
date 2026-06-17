import type { Request, Response, NextFunction } from "express";

// Re-export Express types for convenience
export type { Request, Response, NextFunction };

// Helper type for authenticated requests (for type assertions in controllers)
export type AuthenticatedRequest = Request & {
  user: {
    id: string;
    email: string;
  };
};

export interface FileCreateData {
  name: string;
  type: string;
  size: number;
  mimeType?: string;
  parentId?: string;
  ownerId: string;
  gcsKey?: string;
}

export interface FileUpdateData {
  name?: string;
  isStarred?: boolean;
  isTrashed?: boolean;
  trashedAt?: Date | null;
  parentId?: string;
}

export interface UploadRequestBody {
  name: string;
  type: string;
  size: number;
  mimeType?: string;
  parentId?: string;
  orgId?: string;
  sku?: string;
  mode?: "replace" | "keep";
}
