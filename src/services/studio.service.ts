import { ObjectId, Filter } from "mongodb";
import { getDatabase } from "../config/database.js";
import {
  Studio,
  CreateStudioInput,
  UpdateStudioInput,
  StudioQueryFilters,
} from "../models/studio.model.js";
import { isValidObjectId } from "../utils/validation.js";

const COLLECTION_NAME = "studios";

function getCollection() {
  const db = getDatabase();
  return db.collection<Studio>(COLLECTION_NAME);
}

export async function createStudio(input: CreateStudioInput): Promise<Studio> {
  const collection = getCollection();
  const now = new Date();

  const newStudio: Studio = {
    title: input.title,
    category: input.category,
    hourlyRate: input.hourlyRate,
    securityDeposit: input.securityDeposit ?? 0,
    maxCapacity: input.maxCapacity,
    location: input.location,
    address: input.address,
    imageUrl: input.imageUrl || "",
    amenities: input.amenities || [],
    overview: input.overview,
    hostId: input.hostId,
    hostName: input.hostName || "Studio Host",
    hostEmail: input.hostEmail || "",
    rating: input.rating ?? 5.0,
    reviewCount: input.reviewCount ?? 0,
    status: input.status ?? "active",
    bookingLockVersion: 0,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(newStudio as any);
  return {
    ...newStudio,
    _id: result.insertedId,
  };
}

export async function getAllStudios(filters: StudioQueryFilters): Promise<{
  studios: Studio[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const collection = getCollection();
  const query: Filter<Studio> = {};

  // Category filter (case-insensitive exact match)
  if (filters.category) {
    query.category = { $regex: new RegExp(`^${filters.category}$`, "i") } as any;
  }

  // Location / keyword text search
  if (filters.search) {
    const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      { title: { $regex: escaped, $options: "i" } },
      { location: { $regex: escaped, $options: "i" } },
      { address: { $regex: escaped, $options: "i" } },
      { overview: { $regex: escaped, $options: "i" } },
    ] as any;
  }

  // Hourly rate range filter
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const rateFilter: Record<string, number> = {};
    if (filters.minPrice !== undefined) {
      rateFilter.$gte = filters.minPrice;
    }
    if (filters.maxPrice !== undefined) {
      rateFilter.$lte = filters.maxPrice;
    }
    query.hourlyRate = rateFilter as any;
  }

  // Sorting
  let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
  if (filters.sort === "rating") {
    sortOption = { rating: -1, reviewCount: -1 };
  } else if (filters.sort === "price_asc") {
    sortOption = { hourlyRate: 1 };
  } else if (filters.sort === "price_desc") {
    sortOption = { hourlyRate: -1 };
  }

  const skip = (filters.page - 1) * filters.limit;

  const [studios, total] = await Promise.all([
    collection
      .find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(filters.limit)
      .toArray(),
    collection.countDocuments(query),
  ]);

  return {
    studios,
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit) || 1,
  };
}

export async function getStudioById(id: string): Promise<Studio | null> {
  if (!isValidObjectId(id)) {
    return null;
  }

  const collection = getCollection();
  const studio = await collection.findOne({ _id: new ObjectId(id) });
  return studio;
}

export async function updateStudio(
  id: string,
  input: UpdateStudioInput
): Promise<Studio | null> {
  if (!isValidObjectId(id)) {
    return null;
  }

  const collection = getCollection();
  const updateData: Partial<Studio> & { updatedAt: Date } = {
    ...input,
    updatedAt: new Date(),
  };

  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: updateData },
    { returnDocument: "after" }
  );

  return result;
}

export async function deleteStudio(id: string): Promise<boolean> {
  if (!isValidObjectId(id)) {
    return false;
  }

  const collection = getCollection();
  const result = await collection.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}
