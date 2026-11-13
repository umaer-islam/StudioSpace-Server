import { Router } from "express";
import {
  createBookingHandler,
  getMyBookingsHandler,
  getHostReservationsHandler,
  getBookingByIdHandler,
  confirmBookingHandler,
  cancelBookingHandler,
  completeBookingHandler,
  getStudioAvailabilityHandler,
} from "../controllers/booking.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

// 1. Public Availability Route (Zero PII leakage)
router.get("/studios/:id/availability", getStudioAvailabilityHandler);

// 2. Creator & Host Booking Creation
router.post("/bookings", requireAuth, createBookingHandler);

// 3. User & Host Dashboards
router.get("/bookings/my-bookings", requireAuth, getMyBookingsHandler);
router.get(
  "/bookings/host-reservations",
  requireAuth,
  requireRole(["Host"]),
  getHostReservationsHandler
);

// 4. Single Booking Details (Participant only)
router.get("/bookings/:id", requireAuth, getBookingByIdHandler);

// 5. Lifecycle Transitions
router.patch(
  "/bookings/:id/confirm",
  requireAuth,
  requireRole(["Host"]),
  confirmBookingHandler
);

router.patch("/bookings/:id/cancel", requireAuth, cancelBookingHandler);

router.patch(
  "/bookings/:id/complete",
  requireAuth,
  requireRole(["Host"]),
  completeBookingHandler
);

export default router;
