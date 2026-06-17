import type { Request, Response } from "express";
import { File } from "../models/File.model";
import { blobServiceClient, CONTAINER_NAME } from "../services/azure.service";
import {
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";

function generateSasUrl(
  blobName: string,
  permissions: string,
  expiresInSeconds: number,
): string {
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
  const credential = new StorageSharedKeyCredential(accountName, accountKey);
  const expiresOn = new Date(Date.now() + expiresInSeconds * 1000);
  const sasQueryParams = generateBlobSASQueryParameters(
    {
      containerName: CONTAINER_NAME,
      blobName,
      permissions: BlobSASPermissions.parse(permissions),
      expiresOn,
    },
    credential,
  ).toString();
  return `https://${accountName}.blob.core.windows.net/${CONTAINER_NAME}/${blobName}?${sasQueryParams}`;
}

export async function serveImage(req: Request, res: Response) {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      ownerId: req.user!.id,
      isTrashed: false,
    });

    if (!file) {
      return res.status(404).json({ error: "Image not found" });
    }

    if (!file.gcsKey) {
      return res.status(400).json({ error: "Image has no storage key" });
    }

    // Generate a SAS URL with Read permission (valid for 10 minutes)
    const signedUrl = generateSasUrl(file.gcsKey, "r", 600);

    res.redirect(signedUrl);
  } catch (error) {
    console.error("Error serving image:", error);
    res.status(500).json({ error: "Failed to serve image" });
  }
}
