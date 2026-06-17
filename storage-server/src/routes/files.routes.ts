import { Router } from "express";
import { auth } from "../middleware/auth";
import * as c from "../controllers/files.controller";

const router = Router();
router.get("/usage", auth, c.usage);
router.get("/", auth, c.list);
router.post("/folder", auth, c.createFolder);
router.post("/org-folder", auth, c.ensureOrgFolder);
router.patch("/:id", auth, c.update);
router.delete("/:id", auth, c.remove);
router.post("/:id/copy", auth, c.copy);

export default router;
