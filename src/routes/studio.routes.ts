import { Router } from "express";
import {
  getStudiosHandler,
  getStudioByIdHandler,
  createStudioHandler,
  updateStudioHandler,
  deleteStudioHandler,
} from "../controllers/studio.controller.js";
import {
  requireAuth,
  requireRole,
  verifyStudioOwnership,
} from "../middleware/auth.middleware.js";

const router = Router();

// Public studio endpoints
router.get("/studios", getStudiosHandler);
router.get("/studios/:id", getStudioByIdHandler);

// Protected host-only studio endpoints
router.post("/studios", requireAuth, requireRole(["Host"]), createStudioHandler);
router.patch("/studios/:id", requireAuth, verifyStudioOwnership, updateStudioHandler);
router.delete("/studios/:id", requireAuth, verifyStudioOwnership, deleteStudioHandler);

export default router;
