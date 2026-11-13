import { ObjectId } from "mongodb";
import { isValidObjectId } from "../utils/validation.js";

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";

export interface Booking {
  _id?: ObjectId;

  // Relations
  studioId: ObjectId;
  creatorId: string; // Authenticated user ID of the person making the booking
  hostId: string;    // Authenticated user ID of the studio host

  // Timing (Stored in UTC)
  startTime: Date;
  endTime: Date;
  hours: number;     // e.g., 2.5 hours

  // Pricing Snapshots (Immutable financial history)
  hourlyRate: number;      // Studio rate snapshot at booking time
  securityDeposit: number; // Deposit snapshot
  rentalFee: number;       // hours * hourlyRate
  totalPrice: number;      // rentalFee + securityDeposit
  currency: "BDT";

  // Contextual Snapshots
  studioTitle: string;
  studioLocation: string;
  studioImageUrl: string;
  creatorName: string;
  creatorEmail: string;
  hostName: string;
  hostEmail: string;

  // Lifecycle Metadata
  status: BookingStatus;
  notes?: string;
  cancellationReason?: string;
  cancelledBy?: "creator" | "host";
  cancelledAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBookingInput {
  studioId: string;
  startTime: string; // ISO 8601 string
  endTime: string;   // ISO 8601 string
  notes?: string;
}

export interface ValidatedBookingInput {
  studioObjectId: ObjectId;
  startTime: Date;
  endTime: Date;
  hours: number;
  notes?: string;
}

export interface CancelBookingInput {
  reason?: string;
}

export interface BookingQueryFilters {
  page: number;
  limit: number;
  status?: BookingStatus;
}

/**
 * Validates booking creation input:
 * - studioId must be a valid ObjectId
 * - startTime and endTime must be valid ISO date strings in UTC
 * - startTime must be at least 15 minutes in the future
 * - endTime must be strictly after startTime
 * - duration must be at least 1 hour (60 minutes)
 * - duration and timestamps must align with 30-minute intervals
 * - notes must not exceed 500 characters
 */
export function validateCreateBooking(body: unknown): {
  isValid: boolean;
  errors: string[];
  value?: ValidatedBookingInput;
} {
  const errors: string[] = [];

  if (!body || typeof body !== "object") {
    return { isValid: false, errors: ["Request body must be a JSON object"] };
  }

  const b = body as Record<string, unknown>;

  // 1. studioId
  if (typeof b.studioId !== "string" || !b.studioId.trim()) {
    errors.push("Field 'studioId' is required and must be a non-empty string");
  } else if (!isValidObjectId(b.studioId.trim())) {
    errors.push("Field 'studioId' is not a valid 24-character hexadecimal ObjectId");
  }

  // 2. startTime & endTime strings
  if (typeof b.startTime !== "string" || !b.startTime.trim()) {
    errors.push("Field 'startTime' is required and must be an ISO 8601 date string");
  }

  if (typeof b.endTime !== "string" || !b.endTime.trim()) {
    errors.push("Field 'endTime' is required and must be an ISO 8601 date string");
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // 3. Date parsing
  const startDate = new Date(b.startTime as string);
  const endDate = new Date(b.endTime as string);

  if (isNaN(startDate.getTime())) {
    errors.push("Field 'startTime' must be a valid parseable date");
  }

  if (isNaN(endDate.getTime())) {
    errors.push("Field 'endTime' must be a valid parseable date");
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // 4. Timing & Future Check
  const now = new Date();
  const minStartTime = new Date(now.getTime() + 15 * 60 * 1000); // at least 15 minutes ahead

  if (startDate < minStartTime) {
    errors.push("Reservation 'startTime' must be at least 15 minutes in the future");
  }

  if (endDate <= startDate) {
    errors.push("Reservation 'endTime' must be strictly after 'startTime'");
  }

  // 5. Minimum duration & 30-minute increment checks
  const durationMs = endDate.getTime() - startDate.getTime();
  const durationMinutes = durationMs / (60 * 1000);

  if (durationMinutes < 60) {
    errors.push("Minimum booking duration is 1 hour (60 minutes)");
  }

  if (durationMinutes % 30 !== 0) {
    errors.push("Booking duration must be scheduled in 30-minute increments (e.g. 1h, 1.5h, 2h)");
  }

  // Check that start and end minutes are on 00 or 30 mark
  if (startDate.getUTCMinutes() % 30 !== 0 || startDate.getUTCSeconds() !== 0) {
    errors.push("Reservation start time must align to a 30-minute slot (e.g., :00 or :30)");
  }

  if (endDate.getUTCMinutes() % 30 !== 0 || endDate.getUTCSeconds() !== 0) {
    errors.push("Reservation end time must align to a 30-minute slot (e.g., :00 or :30)");
  }

  // 6. Notes validation
  let notes: string | undefined = undefined;
  if (b.notes !== undefined && b.notes !== null) {
    if (typeof b.notes !== "string") {
      errors.push("Field 'notes' must be a string if provided");
    } else if (b.notes.trim().length > 500) {
      errors.push("Field 'notes' cannot exceed 500 characters");
    } else {
      notes = b.notes.trim();
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  const hours = durationMinutes / 60;

  return {
    isValid: true,
    errors: [],
    value: {
      studioObjectId: new ObjectId(b.studioId as string),
      startTime: startDate,
      endTime: endDate,
      hours,
      notes,
    },
  };
}

/**
 * Validates cancellation input
 */
export function validateCancelBooking(body: unknown): {
  isValid: boolean;
  errors: string[];
  reason?: string;
} {
  const errors: string[] = [];
  let reason: string | undefined = undefined;

  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (b.reason !== undefined && b.reason !== null) {
      if (typeof b.reason !== "string") {
        errors.push("Cancellation 'reason' must be a string if provided");
      } else if (b.reason.trim().length > 300) {
        errors.push("Cancellation 'reason' cannot exceed 300 characters");
      } else {
        reason = b.reason.trim();
      }
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [], reason };
}

/**
 * Parses query pagination and filter parameters
 */
export function parseBookingFilters(
  query: Record<string, unknown>
): BookingQueryFilters {
  let page = 1;
  let limit = 10;
  let status: BookingStatus | undefined = undefined;

  if (typeof query.page === "string") {
    const parsedPage = parseInt(query.page, 10);
    if (!isNaN(parsedPage) && parsedPage > 0) {
      page = parsedPage;
    }
  }

  if (typeof query.limit === "string") {
    const parsedLimit = parseInt(query.limit, 10);
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      limit = Math.min(50, parsedLimit);
    }
  }

  if (
    typeof query.status === "string" &&
    ["pending", "confirmed", "completed", "cancelled"].includes(query.status)
  ) {
    status = query.status as BookingStatus;
  }

  return { page, limit, status };
}
