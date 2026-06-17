import type { Request, Response } from "express";
import { File } from "../models/File.model";
import { blobServiceClient, CONTAINER_NAME } from "../services/azure.service";
import type { UploadRequestBody } from "../types/interfaces";
import {
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";
import { v4 as uuidv4 } from "uuid";

function getSharedKeyCredential(): StorageSharedKeyCredential {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING!;
  const accountNameMatch = connStr.match(/AccountName=([^;]+)/);
  const accountKeyMatch = connStr.match(/AccountKey=([^;]+)/);
  if (!accountNameMatch || !accountKeyMatch) {
    throw new Error(
      "Cannot parse AccountName/AccountKey from AZURE_STORAGE_CONNECTION_STRING",
    );
  }
  const accountName: string = accountNameMatch[1]!;
  const accountKey: string = accountKeyMatch[1]!;
  return new StorageSharedKeyCredential(accountName, accountKey);
}

function generateSasUrl(
  blobName: string,
  permissions: string,
  expiresInSeconds: number,
  contentDisposition?: string,
): string {
  const credential = getSharedKeyCredential();
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING!;
  const accountNameMatch = connStr.match(/AccountName=([^;]+)/);
  const accountName = accountNameMatch![1];

  const expiresOn = new Date(Date.now() + expiresInSeconds * 1000);

  const sasPermissions = BlobSASPermissions.parse(permissions);

  const sasQueryParams = generateBlobSASQueryParameters(
    {
      containerName: CONTAINER_NAME,
      blobName,
      permissions: sasPermissions,
      expiresOn,
      ...(contentDisposition ? { contentDisposition } : {}),
    },
    credential,
  ).toString();

  return `https://${accountName}.blob.core.windows.net/${CONTAINER_NAME}/${blobName}?${sasQueryParams}`;
}

export async function upload(req: Request, res: Response) {
  try {
    const { name, type, size, mimeType, parentId, orgId, sku, mode } =
      req.body as UploadRequestBody;

    if (!name || !type) {
      return res.status(400).json({ error: "Name and type are required" });
    }

    // If no explicit orgId was passed but a parentId was given,
    // inherit orgId from the parent folder so org members can access the file.
    let resolvedOrgId = orgId ? String(orgId) : null;
    if (!resolvedOrgId && parentId) {
      const parent = await File.findById(parentId).select("orgId");
      if (parent?.orgId) {
        resolvedOrgId = parent.orgId;
      }
    }

    const fileId = uuidv4();

    // Org inventory images get a deterministic, SKU-based blob path.
    // Re-uploading the same SKU overwrites the blob automatically.
    let blobName: string;
    if (resolvedOrgId && sku) {
      const ext = name.split(".").pop() ?? "jpg";
      blobName = `organizations/${resolvedOrgId}/${sku}.${ext}`;
    } else if (resolvedOrgId) {
      blobName = `organizations/${resolvedOrgId}/${fileId}-${name}`;
    } else {
      blobName = `${req.user!.id}/${fileId}`;
    }

    // --- Duplicate handling for regular (non-org-sku) uploads ---
    let finalName = name;
    if (!(resolvedOrgId && sku)) {
      const existing = await File.findOne({
        name,
        parentId: parentId || null,
        ownerId: req.user!.id,
        isTrashed: false,
      });

      if (existing) {
        if (mode === "replace") {
          // Reuse the same blob key so Azure overwrites it in-place
          blobName = existing.gcsKey!;
          const updated = await File.findByIdAndUpdate(
            existing._id,
            { size: size || 0, mimeType, updatedAt: new Date() },
            { new: true },
          );
          const uploadUrl = generateSasUrl(blobName, "cw", 600);
          return res.json({
            uploadUrl,
            fileId: (updated as any)._id ?? (updated as any).id,
          });
        } else {
          // "keep" — find the next available numbered name: foo (1).pdf, foo (2).pdf …
          const dotIndex = name.lastIndexOf(".");
          const base = dotIndex !== -1 ? name.slice(0, dotIndex) : name;
          const ext = dotIndex !== -1 ? name.slice(dotIndex) : "";
          let counter = 1;
          let candidate = `${base} (${counter})${ext}`;
          while (
            await File.exists({
              name: candidate,
              parentId: parentId || null,
              ownerId: req.user!.id,
              isTrashed: false,
            })
          ) {
            counter++;
            candidate = `${base} (${counter})${ext}`;
          }
          finalName = candidate;
        }
      }
    }

    // For org inventory images (deterministic blob path), upsert to avoid duplicates.
    // For regular files (unique blob path), always create.
    let file;
    if (resolvedOrgId && sku) {
      const existing = await File.findOne({ gcsKey: blobName });
      if (existing) {
        file = await File.findByIdAndUpdate(
          existing._id,
          {
            name: sku ?? name,
            size: size || 0,
            mimeType,
            updatedAt: new Date(),
            isTrashed: false,
            trashedAt: null,
          },
          { new: true },
        );
      } else {
        file = await File.create({
          _id: fileId,
          name: sku ?? name,
          type,
          size: size || 0,
          mimeType,
          parentId: parentId || null,
          ownerId: req.user!.id,
          gcsKey: blobName,
          orgId: resolvedOrgId,
        });
      }
    } else {
      file = await File.create({
        _id: fileId,
        name: finalName,
        type,
        size: size || 0,
        mimeType,
        parentId: parentId || null,
        ownerId: req.user!.id,
        gcsKey: blobName,
        ...(resolvedOrgId ? { orgId: resolvedOrgId } : {}),
      });
    }

    // Generate a SAS URL with Write permission (valid for 10 minutes)
    const uploadUrl = generateSasUrl(blobName, "cw", 600);

    return res.json({
      uploadUrl,
      fileId: (file as any)._id ?? (file as any).id,
    });
  } catch (error) {
    console.error("Error creating upload URL:", error);
    return res.status(500).json({ error: "Failed to create upload URL" });
  }
}

export async function finalize(req: Request, res: Response) {
  try {
    // Azure SAS uploads are atomic — no finalization step needed
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error finalizing upload:", error);
    res.status(500).json({ error: "Failed to finalize upload" });
  }
}

export async function download(req: Request, res: Response) {
  try {
    const userOrgIds = ((req.query.orgIds as string) || "")
      .split(",")
      .filter(Boolean);

    const file = await File.findOne({
      _id: req.params.id,
      $or: [{ ownerId: req.user!.id }, { orgId: { $in: userOrgIds } }],
    });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    if (!file.gcsKey) {
      return res.status(400).json({ error: "File has no storage key" });
    }

    // Generate a SAS URL with Read permission (valid for 10 minutes)
    const downloadUrl = generateSasUrl(file.gcsKey, "r", 600);

    res.json({ downloadUrl });
  } catch (error) {
    console.error("Error creating download URL:", error);
    res.status(500).json({ error: "Failed to create download URL" });
  }
}

export async function view(req: Request, res: Response) {
  try {
    const userOrgIds = ((req.query.orgIds as string) || "")
      .split(",")
      .filter(Boolean);

    const file = await File.findOne({
      _id: req.params.id,
      $or: [{ ownerId: req.user!.id }, { orgId: { $in: userOrgIds } }],
    });
    if (!file) return res.status(404).json({ error: "File not found" });
    if (!file.gcsKey)
      return res.status(400).json({ error: "File has no storage key" });

    const viewUrl = generateSasUrl(file.gcsKey, "r", 600, "inline");
    res.json({ viewUrl });
  } catch (error) {
    console.error("Error creating view URL:", error);
    res.status(500).json({ error: "Failed to create view URL" });
  }
}
