import { Router } from "express";
import { auth } from "../middleware/auth";
import * as c from "../controllers/storage.controller";

const router = Router();
router.post("/upload", auth, c.upload);
router.post("/finalize", auth, c.finalize);
router.get("/download/:id", auth, c.download);
router.get("/view/:id", auth, c.view);

export default router;
