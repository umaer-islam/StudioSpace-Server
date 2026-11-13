import { ObjectId } from "mongodb";

export type StudioCategory =
  | "Photo Studio"
  | "Film Stage"
  | "Podcast Lounge"
  | "Music Suite"
  | "Workshop"
  | string;

export type StudioStatus = "active" | "inactive" | "maintenance";

export interface Studio {
  _id?: ObjectId;
  title: string;
  category: StudioCategory;
  hourlyRate: number;
  securityDeposit: number;
  maxCapacity: number;
  location: string;
  address: string;
  imageUrl: string;
  amenities: string[];
  overview: string;
  hostName: string;
  hostEmail: string;
  rating: number;
  reviewCount: number;
  status: StudioStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStudioInput {
  title: string;
  category: StudioCategory;
  hourlyRate: number;
  securityDeposit?: number;
  maxCapacity: number;
  location: string;
  address: string;
  imageUrl?: string;
  amenities?: string[];
  overview: string;
  hostName: string;
  hostEmail: string;
  rating?: number;
  reviewCount?: number;
  status?: StudioStatus;
}

export interface UpdateStudioInput {
  title?: string;
  category?: StudioCategory;
  hourlyRate?: number;
  securityDeposit?: number;
  maxCapacity?: number;
  location?: string;
  address?: string;
  imageUrl?: string;
  amenities?: string[];
  overview?: string;
  hostName?: string;
  hostEmail?: string;
  status?: StudioStatus;
}

export interface StudioQueryFilters {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "newest" | "rating" | "price_asc" | "price_desc";
  page: number;
  limit: number;
}

export function validateCreateStudio(body: unknown): {
  isValid: boolean;
  errors: string[];
  value?: CreateStudioInput;
} {
  const errors: string[] = [];
  if (!body || typeof body !== "object") {
    return { isValid: false, errors: ["Request body must be a JSON object"] };
  }

  const b = body as Record<string, unknown>;

  if (typeof b.title !== "string" || !b.title.trim()) {
    errors.push("Field 'title' is required and must be a non-empty string");
  }

  if (typeof b.category !== "string" || !b.category.trim()) {
    errors.push("Field 'category' is required and must be a non-empty string");
  }

  if (typeof b.hourlyRate !== "number" || isNaN(b.hourlyRate) || b.hourlyRate <= 0) {
    errors.push("Field 'hourlyRate' is required and must be a positive number");
  }

  if (b.securityDeposit !== undefined && (typeof b.securityDeposit !== "number" || isNaN(b.securityDeposit) || b.securityDeposit < 0)) {
    errors.push("Field 'securityDeposit' must be a non-negative number if provided");
  }

  if (typeof b.maxCapacity !== "number" || !Number.isInteger(b.maxCapacity) || b.maxCapacity <= 0) {
    errors.push("Field 'maxCapacity' is required and must be a positive integer");
  }

  if (typeof b.location !== "string" || !b.location.trim()) {
    errors.push("Field 'location' is required and must be a non-empty string");
  }

  if (typeof b.address !== "string" || !b.address.trim()) {
    errors.push("Field 'address' is required and must be a non-empty string");
  }

  if (typeof b.overview !== "string" || !b.overview.trim()) {
    errors.push("Field 'overview' is required and must be a non-empty string");
  }

  if (typeof b.hostName !== "string" || !b.hostName.trim()) {
    errors.push("Field 'hostName' is required and must be a non-empty string");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (typeof b.hostEmail !== "string" || !emailRegex.test(b.hostEmail.trim())) {
    errors.push("Field 'hostEmail' is required and must be a valid email address");
  }

  if (b.amenities !== undefined && (!Array.isArray(b.amenities) || !b.amenities.every(a => typeof a === "string"))) {
    errors.push("Field 'amenities' must be an array of strings if provided");
  }

  if (b.status !== undefined && !["active", "inactive", "maintenance"].includes(String(b.status))) {
    errors.push("Field 'status' must be one of: 'active', 'inactive', 'maintenance'");
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  const validated: CreateStudioInput = {
    title: (b.title as string).trim(),
    category: (b.category as string).trim(),
    hourlyRate: Number(b.hourlyRate),
    securityDeposit: b.securityDeposit !== undefined ? Number(b.securityDeposit) : 0,
    maxCapacity: Number(b.maxCapacity),
    location: (b.location as string).trim(),
    address: (b.address as string).trim(),
    imageUrl: typeof b.imageUrl === "string" ? b.imageUrl.trim() : "",
    amenities: Array.isArray(b.amenities) ? b.amenities.map(a => String(a).trim()) : [],
    overview: (b.overview as string).trim(),
    hostName: (b.hostName as string).trim(),
    hostEmail: (b.hostEmail as string).trim().toLowerCase(),
    rating: typeof b.rating === "number" && !isNaN(b.rating) ? Math.min(5, Math.max(0, b.rating)) : 5.0,
    reviewCount: typeof b.reviewCount === "number" && !isNaN(b.reviewCount) ? Math.max(0, b.reviewCount) : 0,
    status: (b.status as StudioStatus) || "active",
  };

  return { isValid: true, errors: [], value: validated };
}

export function validateUpdateStudio(body: unknown): {
  isValid: boolean;
  errors: string[];
  value?: UpdateStudioInput;
} {
  const errors: string[] = [];
  if (!body || typeof body !== "object") {
    return { isValid: false, errors: ["Request body must be a JSON object"] };
  }

  const b = body as Record<string, unknown>;
  const keys = Object.keys(b);
  if (keys.length === 0) {
    return { isValid: false, errors: ["At least one field must be provided for update"] };
  }

  const validated: UpdateStudioInput = {};

  if (b.title !== undefined) {
    if (typeof b.title !== "string" || !b.title.trim()) {
      errors.push("Field 'title' must be a non-empty string");
    } else {
      validated.title = b.title.trim();
    }
  }

  if (b.category !== undefined) {
    if (typeof b.category !== "string" || !b.category.trim()) {
      errors.push("Field 'category' must be a non-empty string");
    } else {
      validated.category = b.category.trim();
    }
  }

  if (b.hourlyRate !== undefined) {
    if (typeof b.hourlyRate !== "number" || isNaN(b.hourlyRate) || b.hourlyRate <= 0) {
      errors.push("Field 'hourlyRate' must be a positive number");
    } else {
      validated.hourlyRate = Number(b.hourlyRate);
    }
  }

  if (b.securityDeposit !== undefined) {
    if (typeof b.securityDeposit !== "number" || isNaN(b.securityDeposit) || b.securityDeposit < 0) {
      errors.push("Field 'securityDeposit' must be a non-negative number");
    } else {
      validated.securityDeposit = Number(b.securityDeposit);
    }
  }

  if (b.maxCapacity !== undefined) {
    if (typeof b.maxCapacity !== "number" || !Number.isInteger(b.maxCapacity) || b.maxCapacity <= 0) {
      errors.push("Field 'maxCapacity' must be a positive integer");
    } else {
      validated.maxCapacity = Number(b.maxCapacity);
    }
  }

  if (b.location !== undefined) {
    if (typeof b.location !== "string" || !b.location.trim()) {
      errors.push("Field 'location' must be a non-empty string");
    } else {
      validated.location = b.location.trim();
    }
  }

  if (b.address !== undefined) {
    if (typeof b.address !== "string" || !b.address.trim()) {
      errors.push("Field 'address' must be a non-empty string");
    } else {
      validated.address = b.address.trim();
    }
  }

  if (b.imageUrl !== undefined) {
    if (typeof b.imageUrl !== "string") {
      errors.push("Field 'imageUrl' must be a string");
    } else {
      validated.imageUrl = b.imageUrl.trim();
    }
  }

  if (b.amenities !== undefined) {
    if (!Array.isArray(b.amenities) || !b.amenities.every(a => typeof a === "string")) {
      errors.push("Field 'amenities' must be an array of strings");
    } else {
      validated.amenities = b.amenities.map(a => String(a).trim());
    }
  }

  if (b.overview !== undefined) {
    if (typeof b.overview !== "string" || !b.overview.trim()) {
      errors.push("Field 'overview' must be a non-empty string");
    } else {
      validated.overview = b.overview.trim();
    }
  }

  if (b.hostName !== undefined) {
    if (typeof b.hostName !== "string" || !b.hostName.trim()) {
      errors.push("Field 'hostName' must be a non-empty string");
    } else {
      validated.hostName = b.hostName.trim();
    }
  }

  if (b.hostEmail !== undefined) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof b.hostEmail !== "string" || !emailRegex.test(b.hostEmail.trim())) {
      errors.push("Field 'hostEmail' must be a valid email address");
    } else {
      validated.hostEmail = b.hostEmail.trim().toLowerCase();
    }
  }

  if (b.status !== undefined) {
    if (!["active", "inactive", "maintenance"].includes(String(b.status))) {
      errors.push("Field 'status' must be one of: 'active', 'inactive', 'maintenance'");
    } else {
      validated.status = b.status as StudioStatus;
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [], value: validated };
}

export function parseStudioFilters(query: Record<string, unknown>): StudioQueryFilters {
  const search = typeof query.search === "string" && query.search.trim() ? query.search.trim() : undefined;
  const category = typeof query.category === "string" && query.category.trim() ? query.category.trim() : undefined;

  let minPrice: number | undefined;
  if (query.minPrice !== undefined && query.minPrice !== "") {
    const parsed = Number(query.minPrice);
    if (!isNaN(parsed) && parsed >= 0) {
      minPrice = parsed;
    }
  }

  let maxPrice: number | undefined;
  if (query.maxPrice !== undefined && query.maxPrice !== "") {
    const parsed = Number(query.maxPrice);
    if (!isNaN(parsed) && parsed >= 0) {
      maxPrice = parsed;
    }
  }

  let sort: "newest" | "rating" | "price_asc" | "price_desc" = "newest";
  if (typeof query.sort === "string") {
    if (["newest", "rating", "price_asc", "price_desc"].includes(query.sort)) {
      sort = query.sort as "newest" | "rating" | "price_asc" | "price_desc";
    }
  }

  let page = 1;
  if (query.page !== undefined) {
    const parsed = parseInt(String(query.page), 10);
    if (!isNaN(parsed) && parsed > 0) {
      page = parsed;
    }
  }

  let limit = 10;
  if (query.limit !== undefined) {
    const parsed = parseInt(String(query.limit), 10);
    if (!isNaN(parsed) && parsed > 0) {
      limit = Math.min(50, parsed); // Cap at 50 to prevent unbounded queries
    }
  }

  return {
    search,
    category,
    minPrice,
    maxPrice,
    sort,
    page,
    limit,
  };
}
