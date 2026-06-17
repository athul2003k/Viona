import type { Request, Response } from "express";
import { File } from "../models/File.model";
import type { FileUpdateData, AuthenticatedRequest } from "../types/interfaces";
import { blobServiceClient, CONTAINER_NAME } from "../services/azure.service";

// ─── Helper 1: global "organizations" root folder ────────────────────────────
async function getOrEnsureRootOrgFolder(): Promise<{ id: string }> {
  const root = await File.findOneAndUpdate(
    {
      name: "organizations",
      parentId: null,
      isOrgFolder: false,
      isTrashed: false,
    },
    {
      $setOnInsert: {
        name: "organizations",
        type: "folder",
        ownerId: "system",
      },
    },
    { upsert: true, new: true },
  );
  return { id: root._id as string };
}

// ─── Helper 2: per-org subfolder inside "organizations/" ─────────────────────
async function getOrEnsureOrgFolder(
  orgId: string,
  orgName: string,
  rootFolderId: string,
): Promise<{ id: string }> {
  const orgFolder = await File.findOneAndUpdate(
    { orgId, isOrgFolder: true, parentId: rootFolderId, isTrashed: false },
    {
      $setOnInsert: {
        name: orgName,
        type: "folder",
        isOrgFolder: true,
        orgId,
        parentId: rootFolderId,
        ownerId: "system",
      },
    },
    { upsert: true, new: true },
  );
  return { id: orgFolder._id as string };
}

// ─── Helper 3: "product images" subfolder inside the org folder ──────────────
async function getOrEnsureProductImagesFolder(
  orgId: string,
  orgFolderId: string,
): Promise<{ id: string }> {
  let folder = await File.findOne({
    name: "product images",
    parentId: orgFolderId,
    orgId,
    isTrashed: false,
  });

  if (!folder) {
    folder = await File.create({
      name: "product images",
      type: "folder",
      orgId,
      parentId: orgFolderId,
      ownerId: "system",
    });
  }
  return { id: folder._id as string };
}

export async function ensureOrgFolder(req: Request, res: Response) {
  try {
    const { orgId, orgName } = req.body;
    if (!orgId || !orgName) {
      return res.status(400).json({ error: "orgId and orgName are required" });
    }

    const root = await getOrEnsureRootOrgFolder();
    const orgFolder = await getOrEnsureOrgFolder(
      String(orgId),
      orgName,
      root.id,
    );

    // Ensure the "product images" subfolder exists inside the org folder
    const productImagesFolder = await getOrEnsureProductImagesFolder(
      String(orgId),
      orgFolder.id,
    );

    res.json({
      rootFolderId: root.id,
      orgFolderId: orgFolder.id,
      productImagesFolderId: productImagesFolder.id,
    });
  } catch (error) {
    console.error("Error ensuring org folder:", error);
    res.status(500).json({ error: "Failed to ensure org folder" });
  }
}

export async function list(req: Request, res: Response) {
  try {
    const isTrashed = req.query.trashed === "true";
    const parentId = (req.query.parentId as string) || null;
    const search = (req.query.search as string) || null;
    const orgIds = ((req.query.orgIds as string) || "")
      .split(",")
      .filter(Boolean);

    const parentFilter = search ? {} : isTrashed ? {} : { parentId };
    const nameFilter = search
      ? { name: { $regex: search, $options: "i" } }
      : {};

    // Personal files: exclude isOrgFolder rows so they don't show up twice
    const personalFiles = await File.find({
      ownerId: req.user!.id,
      isOrgFolder: { $ne: true },
      orgId: null,
      isTrashed,
      ...parentFilter,
      ...nameFilter,
    });

    let orgFiles: typeof personalFiles = [];

    if (orgIds.length > 0) {
      const orConditions: any[] = [];

      // Show global "organizations/" root when browsing (not trash, not search)
      if (!search && !isTrashed) {
        orConditions.push({
          name: "organizations",
          parentId: null,
          isOrgFolder: false,
          isTrashed: false,
        });
      }

      const orgFilesCondition: any = {
        orgId: { $in: orgIds },
        isTrashed,
      };
      if (search) {
        orgFilesCondition.name = { $regex: search, $options: "i" };
      } else if (!isTrashed) {
        orgFilesCondition.parentId = parentId;
      }
      orConditions.push(orgFilesCondition);

      orgFiles = await File.find({ $or: orConditions });
    }

    const merged = [...personalFiles, ...orgFiles];
    merged.sort((a, b) => {
      if (a.name === "organizations") return -1;
      if (b.name === "organizations") return 1;
      return 0;
    });
    res.json(merged);
  } catch (error) {
    console.error("Error listing files:", error);
    res.status(500).json({ error: "Failed to list files" });
  }
}

export async function createFolder(req: Request, res: Response) {
  try {
    const { name, parentId } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Folder name is required" });
    }

    // Inherit orgId from parent folder so org membership propagates to
    // sub-folders and any files subsequently uploaded into them.
    let orgId: string | null = null;
    if (parentId) {
      const parent = await File.findById(parentId).select("orgId");
      if (parent?.orgId) orgId = parent.orgId;
    }

    const folder = await File.create({
      name,
      type: "folder",
      parentId: parentId || null,
      ownerId: req.user!.id,
      ...(orgId ? { orgId } : {}),
    });

    res.json(folder);
  } catch (error) {
    console.error("Error creating folder:", error);
    res.status(500).json({ error: "Failed to create folder" });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userOrgIds = ((req.query.orgIds as string) || "")
      .split(",")
      .filter(Boolean);

    const existingFile = await File.findOne({
      _id: id,
      $or: [
        { ownerId: req.user!.id },
        ...(userOrgIds.length > 0 ? [{ orgId: { $in: userOrgIds } }] : []),
      ],
    });

    if (!existingFile) {
      return res.status(404).json({ error: "File not found" });
    }

    const data: FileUpdateData = { ...req.body };

    if (data.isTrashed === true) {
      data.trashedAt = new Date();
    } else if (data.isTrashed === false) {
      data.trashedAt = null;
    }

    const file = await File.findByIdAndUpdate(id, data, { new: true });

    res.json(file);
  } catch (error) {
    console.error("Error updating file:", error);
    res.status(500).json({ error: "Failed to update file" });
  }
}

// ─── FIXED: org children are found by orgId, not only ownerId ─────────────────
async function deleteRecursive(
  folderId: string,
  ownerId: string,
  orgId?: string | null,
) {
  const children = await File.find({
    parentId: folderId,
    $or: [{ ownerId }, ...(orgId ? [{ orgId }] : [])],
  });

  for (const child of children) {
    if (child.type === "folder") {
      await deleteRecursive(child._id as string, ownerId, child.orgId);
    } else {
      if (child.gcsKey) {
        const containerClient =
          blobServiceClient.getContainerClient(CONTAINER_NAME);
        await containerClient.getBlockBlobClient(child.gcsKey).deleteIfExists();
      }
    }
    await File.findByIdAndDelete(child._id);
  }
}

export async function remove(req: Request, res: Response) {
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

    if (file.type === "folder") {
      await deleteRecursive(
        file._id as string,
        req.user!.id,
        file.orgId ?? null,
      );
    } else {
      if (file.gcsKey) {
        const containerClient =
          blobServiceClient.getContainerClient(CONTAINER_NAME);
        await containerClient.getBlockBlobClient(file.gcsKey).deleteIfExists();
      }
    }

    await File.findByIdAndDelete(file._id);
    res.sendStatus(204);
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ error: "Failed to delete file" });
  }
}

export async function usage(req: Request, res: Response) {
  try {
    const result = await File.aggregate([
      {
        $match: {
          ownerId: req.user!.id,
          isTrashed: false,
          type: { $ne: "folder" },
        },
      },
      { $group: { _id: null, totalSize: { $sum: "$size" } } },
    ]);

    const usedBytes = result[0]?.totalSize ?? 0;
    const limitBytes = 500 * 1024 * 1024; // 500 MB
    const percentage = Math.min((usedBytes / limitBytes) * 100, 100);

    res.json({ usedBytes, limitBytes, percentage });
  } catch (error) {
    console.error("Error calculating usage:", error);
    res.status(500).json({ error: "Failed to get usage" });
  }
}

export async function copy(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { parentId } = req.body;

    const original = await File.findOne({ _id: id, ownerId: req.user!.id });
    if (!original) return res.status(404).json({ error: "File not found" });

    if (original.type === "folder") {
      // Only copy the folder record (not recursive contents, for simplicity)
      const newFolder = await File.create({
        name: `${original.name} (copy)`,
        type: "folder",
        parentId: parentId ?? null,
        ownerId: req.user!.id,
      });
      return res.json(newFolder);
    }

    // For files: copy the Azure blob
    const containerClient =
      blobServiceClient.getContainerClient(CONTAINER_NAME);
    const newKey = `${req.user!.id}/${Date.now()}-${original.name}`;
    const sourceBlob = containerClient.getBlockBlobClient(original.gcsKey!);
    const destBlob = containerClient.getBlockBlobClient(newKey);
    await destBlob.beginCopyFromURL(sourceBlob.url);

    const newFile = await File.create({
      name: `${original.name} (copy)`,
      type: original.type,
      size: original.size,
      mimeType: original.mimeType,
      gcsKey: newKey,
      parentId: parentId ?? null,
      ownerId: req.user!.id,
    });
    res.json(newFile);
  } catch (error) {
    console.error("Error copying file:", error);
    res.status(500).json({ error: "Failed to copy file" });
  }
}
