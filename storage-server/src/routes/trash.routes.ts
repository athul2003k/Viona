import { Router } from "express";
import { File } from "../models/File.model";
import { auth } from "../middleware/auth";
import type { Request, Response } from "express";
import { blobServiceClient, CONTAINER_NAME } from "../services/azure.service";

const router = Router();

router.delete("/", auth, async (req: Request, res: Response) => {
  try {
    const userOrgIds = ((req.query.orgIds as string) || "")
      .split(",")
      .filter(Boolean);

    const orCondition = [
      { ownerId: req.user!.id },
      ...(userOrgIds.length > 0 ? [{ orgId: { $in: userOrgIds } }] : []),
    ];

    const trashedFiles = await File.find({
      $or: orCondition,
      isTrashed: true,
    }).select("_id gcsKey");

    const containerClient =
      blobServiceClient.getContainerClient(CONTAINER_NAME);
    await Promise.all(
      trashedFiles
        .filter((f) => f.gcsKey)
        .map((f) =>
          containerClient.getBlockBlobClient(f.gcsKey!).deleteIfExists(),
        ),
    );

    await File.deleteMany({
      $or: orCondition,
      isTrashed: true,
    });

    res.sendStatus(204);
  } catch (error) {
    console.error("Error emptying trash:", error);
    res.status(500).json({ error: "Failed to empty trash" });
  }
});

export default router;
