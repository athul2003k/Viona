import { Router } from "express";
import { auth } from "../middleware/auth";
import { serveImage } from "../controllers/images.controller";

const router = Router();
router.get("/:id", auth, serveImage);

export default router;
