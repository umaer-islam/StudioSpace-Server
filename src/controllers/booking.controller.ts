import { Request, Response, NextFunction } from "express";
import {
  createBooking,
  confirmBooking,
  cancelBooking,
  completeBooking,
  getBookingById,
  getCreatorBookings,
  getHostReservations,
  getStudioAvailability,
  BookingConflictError,
  BookingValidationError,
  BookingForbiddenError,
} from "../services/booking.service.js";
import {
  validateCreateBooking,
  validateCancelBooking,
  parseBookingFilters,
} from "../models/booking.model.js";

export async function createBookingHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const validation = validateCreateBooking(req.body);
    if (!validation.isValid || !validation.value) {
      res.status(400).json({
        success: false,
        message: "Booking validation failed",
        errors: validation.errors,
      });
      return;
    }

    const booking = await createBooking(validation.value, {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
    });

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: booking,
    });
  } catch (error) {
    if (error instanceof BookingConflictError) {
      res.status(409).json({
        success: false,
        message: error.message,
      });
      return;
    }
    if (error instanceof BookingValidationError) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }
    next(error);
  }
}

export async function getMyBookingsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const filters = parseBookingFilters(req.query as Record<string, unknown>);
    const result = await getCreatorBookings(req.user.id, filters);

    res.status(200).json({
      success: true,
      data: result.bookings,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getHostReservationsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const filters = parseBookingFilters(req.query as Record<string, unknown>);
    const result = await getHostReservations(req.user.id, filters);

    res.status(200).json({
      success: true,
      data: result.bookings,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getBookingByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id);
    const booking = await getBookingById(id, req.user.id);

    if (!booking) {
      res.status(404).json({
        success: false,
        message: `Booking not found with ID: ${id}`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    if (error instanceof BookingForbiddenError) {
      // 404 to prevent resource enumeration as per security audit
      res.status(404).json({
        success: false,
        message: "Booking not found",
      });
      return;
    }
    next(error);
  }
}

export async function confirmBookingHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id);
    const confirmed = await confirmBooking(id, req.user.id);

    if (!confirmed) {
      res.status(404).json({
        success: false,
        message: `Booking not found with ID: ${id}`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Booking confirmed successfully",
      data: confirmed,
    });
  } catch (error) {
    if (error instanceof BookingForbiddenError) {
      res.status(403).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof BookingValidationError) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}

export async function cancelBookingHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id);
    const validation = validateCancelBooking(req.body);

    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: "Cancellation validation failed",
        errors: validation.errors,
      });
      return;
    }

    const cancelled = await cancelBooking(id, req.user.id, validation.reason);

    if (!cancelled) {
      res.status(404).json({
        success: false,
        message: `Booking not found with ID: ${id}`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      data: cancelled,
    });
  } catch (error) {
    if (error instanceof BookingForbiddenError) {
      res.status(403).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof BookingValidationError) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}

export async function completeBookingHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id);
    const completed = await completeBooking(id, req.user.id);

    if (!completed) {
      res.status(404).json({
        success: false,
        message: `Booking not found with ID: ${id}`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Booking marked as completed",
      data: completed,
    });
  } catch (error) {
    if (error instanceof BookingForbiddenError) {
      res.status(403).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof BookingValidationError) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}

export async function getStudioAvailabilityHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : String(req.params.id);

    let fromDate: Date | undefined = undefined;
    let toDate: Date | undefined = undefined;

    if (typeof req.query.from === "string") {
      const parsed = new Date(req.query.from);
      if (!isNaN(parsed.getTime())) fromDate = parsed;
    }

    if (typeof req.query.to === "string") {
      const parsed = new Date(req.query.to);
      if (!isNaN(parsed.getTime())) toDate = parsed;
    }

    const slots = await getStudioAvailability(id, fromDate, toDate);

    res.status(200).json({
      success: true,
      data: slots,
    });
  } catch (error) {
    if (error instanceof BookingValidationError) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}

