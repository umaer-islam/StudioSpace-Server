import { ObjectId, Filter, TransactionOptions } from "mongodb";
import { getDatabase, getClient } from "../config/database.js";
import {
  Booking,
  BookingStatus,
  ValidatedBookingInput,
  BookingQueryFilters,
} from "../models/booking.model.js";
import { Studio } from "../models/studio.model.js";
import { isValidObjectId } from "../utils/validation.js";

const BOOKINGS_COLLECTION = "bookings";
const STUDIOS_COLLECTION = "studios";

const TRANSACTION_OPTIONS: TransactionOptions = {
  readPreference: "primary",
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority" },
};

function getBookingsCollection() {
  return getDatabase().collection<Booking>(BOOKINGS_COLLECTION);
}

function getStudiosCollection() {
  return getDatabase().collection<Studio>(STUDIOS_COLLECTION);
}

export class BookingConflictError extends Error {
  constructor(message = "The selected time slot overlaps with an existing reservation for this studio.") {
    super(message);
    this.name = "BookingConflictError";
  }
}

export class BookingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingValidationError";
  }
}

export class BookingForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action on this booking.") {
    super(message);
    this.name = "BookingForbiddenError";
  }
}

/**
 * Creates a new booking with strict concurrency serialization via studio mutex
 */
export async function createBooking(
  input: ValidatedBookingInput,
  creator: { id: string; name: string; email: string }
): Promise<Booking> {
  const client = getClient();
  const session = client.startSession();

  try {
    let createdBooking: Booking | null = null;

    await session.withTransaction(async () => {
      const studiosCol = getStudiosCollection();
      const bookingsCol = getBookingsCollection();

      // 1. Acquire document-level mutex lock on the Studio document
      // Incrementing bookingLockVersion forces WiredTiger to serialize concurrent transactions on Studio X
      const studio = await studiosCol.findOneAndUpdate(
        { _id: input.studioObjectId },
        { $inc: { bookingLockVersion: 1 } },
        { session, returnDocument: "after" }
      );

      if (!studio) {
        throw new BookingValidationError("The requested studio does not exist.");
      }

      if (studio.status !== "active") {
        throw new BookingValidationError("This studio is currently not accepting reservations.");
      }

      // 2. Prevent host from booking their own studio listing
      if (studio.hostId && studio.hostId === creator.id) {
        throw new BookingValidationError("Hosts cannot book their own studio listings.");
      }

      // 3. Serialized overlap query against all active bookings
      // Pending bookings older than 24 hours expire automatically and do not block availability
      const pendingExpirationThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const conflictingBooking = await bookingsCol.findOne(
        {
          studioId: input.studioObjectId,
          $or: [
            { status: "confirmed" },
            { status: "pending", createdAt: { $gte: pendingExpirationThreshold } },
          ],
          startTime: { $lt: input.endTime },
          endTime: { $gt: input.startTime },
        },
        { session }
      );

      if (conflictingBooking) {
        throw new BookingConflictError(
          "The selected time slot overlaps with an existing reservation for this studio."
        );
      }

      // 4. Server-side authoritative pricing calculations
      const hourlyRate = studio.hourlyRate;
      const securityDeposit = studio.securityDeposit ?? 0;
      const rentalFee = Math.round(input.hours * hourlyRate);
      const totalPrice = rentalFee + securityDeposit;
      const now = new Date();

      const newBooking: Booking = {
        studioId: input.studioObjectId,
        creatorId: creator.id,
        hostId: studio.hostId || "system",
        startTime: input.startTime,
        endTime: input.endTime,
        hours: input.hours,
        hourlyRate,
        securityDeposit,
        rentalFee,
        totalPrice,
        currency: "BDT",
        studioTitle: studio.title,
        studioLocation: studio.location,
        studioImageUrl: studio.imageUrl || "",
        creatorName: creator.name,
        creatorEmail: creator.email,
        hostName: studio.hostName || "Studio Host",
        hostEmail: studio.hostEmail || "",
        status: "pending",
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
      };

      const insertResult = await bookingsCol.insertOne(newBooking as any, { session });
      createdBooking = {
        ...newBooking,
        _id: insertResult.insertedId,
      };
    }, TRANSACTION_OPTIONS);

    if (!createdBooking) {
      throw new Error("Failed to create booking.");
    }

    return createdBooking;
  } finally {
    await session.endSession();
  }
}

/**
 * Confirms a pending booking (Host-only action)
 */
export async function confirmBooking(
  bookingId: string,
  hostId: string
): Promise<Booking | null> {
  if (!isValidObjectId(bookingId)) {
    throw new BookingValidationError("Invalid booking ID format.");
  }

  const client = getClient();
  const session = client.startSession();

  try {
    let updated: Booking | null = null;

    await session.withTransaction(async () => {
      const bookingsCol = getBookingsCollection();
      const studiosCol = getStudiosCollection();

      const booking = await bookingsCol.findOne(
        { _id: new ObjectId(bookingId) },
        { session }
      );

      if (!booking) {
        return;
      }

      if (booking.hostId !== hostId) {
        throw new BookingForbiddenError("Only the studio host can confirm this booking.");
      }

      if (booking.status !== "pending") {
        throw new BookingValidationError(`Cannot confirm a booking that is currently '${booking.status}'.`);
      }

      // Reject confirmation if pending booking is older than 24 hours
      const pendingExpirationThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (booking.createdAt < pendingExpirationThreshold) {
        throw new BookingValidationError(
          "This reservation request has expired (>24 hours) and can no longer be confirmed."
        );
      }

      // Mutex lock the studio document to serialize availability modification
      await studiosCol.findOneAndUpdate(
        { _id: booking.studioId },
        { $inc: { bookingLockVersion: 1 } },
        { session }
      );

      // Verify no competing booking was confirmed for this time slot
      const existingConflict = await bookingsCol.findOne(
        {
          _id: { $ne: booking._id },
          studioId: booking.studioId,
          status: "confirmed",
          startTime: { $lt: booking.endTime },
          endTime: { $gt: booking.startTime },
        },
        { session }
      );

      if (existingConflict) {
        throw new BookingConflictError(
          "Cannot confirm: this time slot is already occupied by another confirmed reservation."
        );
      }

      const now = new Date();
      const result = await bookingsCol.findOneAndUpdate(
        { _id: booking._id, status: "pending" },
        {
          $set: {
            status: "confirmed",
            updatedAt: now,
          },
        },
        { session, returnDocument: "after" }
      );

      updated = result ? result : null;
    }, TRANSACTION_OPTIONS);

    return updated;
  } finally {
    await session.endSession();
  }
}

/**
 * Cancels a booking (Allowed for either Creator or Host)
 */
export async function cancelBooking(
  bookingId: string,
  userId: string,
  reason?: string
): Promise<Booking | null> {
  if (!isValidObjectId(bookingId)) {
    throw new BookingValidationError("Invalid booking ID format.");
  }

  const client = getClient();
  const session = client.startSession();

  try {
    let updated: Booking | null = null;

    await session.withTransaction(async () => {
      const bookingsCol = getBookingsCollection();
      const studiosCol = getStudiosCollection();

      const booking = await bookingsCol.findOne(
        { _id: new ObjectId(bookingId) },
        { session }
      );

      if (!booking) {
        return;
      }

      // Participant check: only the creator or the host can cancel
      const isCreator = booking.creatorId === userId;
      const isHost = booking.hostId === userId;

      if (!isCreator && !isHost) {
        throw new BookingForbiddenError("You do not have permission to cancel this booking.");
      }

      if (booking.status === "cancelled") {
        throw new BookingValidationError("This booking is already cancelled.");
      }

      if (booking.status === "completed") {
        throw new BookingValidationError("Completed bookings cannot be cancelled.");
      }

      // Mutex lock the studio document to release availability safely
      await studiosCol.findOneAndUpdate(
        { _id: booking.studioId },
        { $inc: { bookingLockVersion: 1 } },
        { session }
      );

      const now = new Date();
      const cancelledBy = isCreator ? "creator" : "host";

      const result = await bookingsCol.findOneAndUpdate(
        { _id: booking._id },
        {
          $set: {
            status: "cancelled",
            cancelledBy,
            cancellationReason: reason || (isCreator ? "Cancelled by creator" : "Declined by host"),
            cancelledAt: now,
            updatedAt: now,
          },
        },
        { session, returnDocument: "after" }
      );

      updated = result ? result : null;
    }, TRANSACTION_OPTIONS);

    return updated;
  } finally {
    await session.endSession();
  }
}

/**
 * Marks a confirmed booking as completed (Host-only action)
 */
export async function completeBooking(
  bookingId: string,
  hostId: string
): Promise<Booking | null> {
  if (!isValidObjectId(bookingId)) {
    throw new BookingValidationError("Invalid booking ID format.");
  }

  const client = getClient();
  const session = client.startSession();

  try {
    let updated: Booking | null = null;

    await session.withTransaction(async () => {
      const bookingsCol = getBookingsCollection();
      const studiosCol = getStudiosCollection();

      const booking = await bookingsCol.findOne(
        { _id: new ObjectId(bookingId) },
        { session }
      );

      if (!booking) {
        return;
      }

      if (booking.hostId !== hostId) {
        throw new BookingForbiddenError("Only the studio host can complete this booking.");
      }

      if (booking.status !== "confirmed") {
        throw new BookingValidationError(
          `Only confirmed bookings can be marked completed. Current status is '${booking.status}'.`
        );
      }

      // Reservation endTime must have passed
      const now = new Date();
      if (now < booking.endTime) {
        throw new BookingValidationError(
          "Cannot complete a booking before its scheduled end time has passed."
        );
      }

      // Mutex lock
      await studiosCol.findOneAndUpdate(
        { _id: booking.studioId },
        { $inc: { bookingLockVersion: 1 } },
        { session }
      );

      const result = await bookingsCol.findOneAndUpdate(
        { _id: booking._id, status: "confirmed" },
        {
          $set: {
            status: "completed",
            updatedAt: now,
          },
        },
        { session, returnDocument: "after" }
      );

      updated = result ? result : null;
    }, TRANSACTION_OPTIONS);

    return updated;
  } finally {
    await session.endSession();
  }
}

/**
 * Gets a single booking ensuring participant privacy
 */
export async function getBookingById(
  bookingId: string,
  userId: string
): Promise<Booking | null> {
  if (!isValidObjectId(bookingId)) {
    return null;
  }

  const bookingsCol = getBookingsCollection();
  const booking = await bookingsCol.findOne({ _id: new ObjectId(bookingId) });

  if (!booking) {
    return null;
  }

  // Must be creator or host
  if (booking.creatorId !== userId && booking.hostId !== userId) {
    throw new BookingForbiddenError("You do not have access to view this booking.");
  }

  return booking;
}

/**
 * Gets creator's bookings (all bookings initiated by this user)
 */
export async function getCreatorBookings(
  creatorId: string,
  filters: BookingQueryFilters
): Promise<{
  bookings: Booking[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const bookingsCol = getBookingsCollection();
  const query: Filter<Booking> = { creatorId };

  if (filters.status) {
    query.status = filters.status;
  }

  const skip = (filters.page - 1) * filters.limit;

  const [bookings, total] = await Promise.all([
    bookingsCol
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filters.limit)
      .toArray(),
    bookingsCol.countDocuments(query),
  ]);

  return {
    bookings,
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit) || 1,
  };
}

/**
 * Gets host's incoming reservations for all their studios
 */
export async function getHostReservations(
  hostId: string,
  filters: BookingQueryFilters
): Promise<{
  bookings: Booking[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const bookingsCol = getBookingsCollection();
  const query: Filter<Booking> = { hostId };

  if (filters.status) {
    query.status = filters.status;
  }

  const skip = (filters.page - 1) * filters.limit;

  const [bookings, total] = await Promise.all([
    bookingsCol
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filters.limit)
      .toArray(),
    bookingsCol.countDocuments(query),
  ]);

  return {
    bookings,
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit) || 1,
  };
}

/**
 * Public availability: Returns only unavailable time ranges without leaking user information
 */
export async function getStudioAvailability(
  studioId: string,
  from?: Date,
  to?: Date
): Promise<{ startTime: Date; endTime: Date; status: BookingStatus }[]> {
  if (!isValidObjectId(studioId)) {
    throw new BookingValidationError("Invalid studio ID format.");
  }

  const bookingsCol = getBookingsCollection();
  const pendingThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const query: Filter<Booking> = {
    studioId: new ObjectId(studioId),
    $or: [
      { status: "confirmed" },
      { status: "pending", createdAt: { $gte: pendingThreshold } },
    ],
  };

  const now = new Date();
  const fromDate = from && from > now ? from : now;

  query.endTime = { $gt: fromDate };
  if (to) {
    query.startTime = { $lt: to };
  }

  const bookings = await bookingsCol
    .find(query, {
      projection: {
        startTime: 1,
        endTime: 1,
        status: 1,
        _id: 0,
      },
    })
    .sort({ startTime: 1 })
    .toArray();

  return bookings.map((b) => ({
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status,
  }));
}

