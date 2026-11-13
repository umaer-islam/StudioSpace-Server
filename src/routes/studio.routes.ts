import { Router } from "express";
import {
  getStudiosHandler,
  getStudioByIdHandler,
  createStudioHandler,
  updateStudioHandler,
  deleteStudioHandler,
} from "../controllers/studio.controller.js";

const router = Router();

router.get("/studios", getStudiosHandler);
router.get("/studios/:id", getStudioByIdHandler);
router.post("/studios", createStudioHandler);
router.patch("/studios/:id", updateStudioHandler);
router.delete("/studios/:id", deleteStudioHandler);

export default router;
