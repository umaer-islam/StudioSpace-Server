import { Request, Response, NextFunction } from "express";
import {
  createStudio,
  getAllStudios,
  getStudioById,
  updateStudio,
  deleteStudio,
  getHostStudios,
} from "../services/studio.service.js";
import {
  validateCreateStudio,
  validateUpdateStudio,
  parseStudioFilters,
} from "../models/studio.model.js";
import { isValidObjectId } from "../utils/validation.js";

export async function getStudiosHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const filters = parseStudioFilters(req.query as Record<string, unknown>);
    const result = await getAllStudios(filters);

    res.status(200).json({
      success: true,
      data: result.studios,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getStudioByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id);

    if (!isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid studio ID format",
      });
      return;
    }

    const studio = await getStudioById(id);
    if (!studio) {
      res.status(404).json({
        success: false,
        message: `Studio not found with ID: ${id}`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: studio,
    });
  } catch (error) {
    next(error);
  }
}

export async function createStudioHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const validation = validateCreateStudio(req.body);
    if (!validation.isValid || !validation.value) {
      res.status(400).json({
        success: false,
        message: "Validation failed for studio creation",
        errors: validation.errors,
      });
      return;
    }

    const studioInput = {
      ...validation.value,
      hostId: req.user?.id,
      hostName: req.user?.name || validation.value.hostName || "Studio Host",
      hostEmail: req.user?.email || validation.value.hostEmail || "",
    };

    const created = await createStudio(studioInput);
    res.status(201).json({
      success: true,
      message: "Studio created successfully",
      data: created,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateStudioHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id);

    if (!isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid studio ID format",
      });
      return;
    }

    const validation = validateUpdateStudio(req.body);
    if (!validation.isValid || !validation.value) {
      res.status(400).json({
        success: false,
        message: "Validation failed for studio update",
        errors: validation.errors,
      });
      return;
    }

    const updated = await updateStudio(id, validation.value);
    if (!updated) {
      res.status(404).json({
        success: false,
        message: `Studio not found with ID: ${id}`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Studio updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteStudioHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id);

    if (!isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid studio ID format",
      });
      return;
    }

    const deleted = await deleteStudio(id);
    if (!deleted) {
      res.status(404).json({
        success: false,
        message: `Studio not found with ID: ${id}`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Studio deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

export async function getHostStudiosHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const hostId = req.user?.id;
    if (!hostId) {
      res.status(401).json({
        success: false,
        message: "Authentication required to view host listings",
      });
      return;
    }

    const studios = await getHostStudios(hostId);
    res.status(200).json({
      success: true,
      data: studios,
    });
  } catch (error) {
    next(error);
  }
}
