import { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import * as jose from "jose";
import { auth } from "../config/auth.js";
import { env } from "../config/env.js";
import { getStudioById } from "../services/studio.service.js";
import { isValidObjectId } from "../utils/validation.js";
import { Studio } from "../models/studio.model.js";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "Creator" | "Host";
  image?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      session?: any;
      studio?: Studio;
    }
  }
}

/**
 * requireAuth:
 * Primary: Better Auth session cookie via auth.api.getSession
 * Fallback: Authorization: Bearer <jwt> verified via jose / auth.api.verifyJWT
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // 1. Primary: Better Auth session cookie
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (session && session.user) {
      req.user = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: ((session.user as any).role as "Creator" | "Host") || "Creator",
        image: session.user.image,
      };
      req.session = session.session;
      return next();
    }
  } catch (error) {
    // Better Auth session lookup error, proceed to Bearer fallback
  }

  // 2. Fallback: Authorization Bearer JWT
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (token) {
      try {
        let verifiedPayload: any = null;

        // Try auth.api.verifyJWT first (Better Auth internal JWKS)
        try {
          const result = await auth.api.verifyJWT({ body: { token } });
          if (result && result.payload) {
            verifiedPayload = result.payload;
          }
        } catch {
          // Continue to jose fallback
        }

        // Fallback to jose HMAC verification using BETTER_AUTH_SECRET
        if (!verifiedPayload) {
          try {
            const secret = new TextEncoder().encode(env.BETTER_AUTH_SECRET);
            const { payload } = await jose.jwtVerify(token, secret);
            verifiedPayload = payload;
          } catch {
            // Token signature invalid
          }
        }

        if (verifiedPayload && (verifiedPayload.sub || verifiedPayload.id)) {
          req.user = {
            id: String(verifiedPayload.sub || verifiedPayload.id),
            name: String(verifiedPayload.name || ""),
            email: String(verifiedPayload.email || ""),
            role: (verifiedPayload.role as "Creator" | "Host") || "Creator",
          };
          return next();
        }
      } catch (error) {
        // Bearer token verification failed
      }
    }
  }

  res.status(401).json({
    success: false,
    message: "Authentication required. Please sign in to continue.",
  });
}

/**
 * requireRole:
 * Enforces specific user role (e.g., Host, Creator)
 */
export function requireRole(allowedRoles: ("Creator" | "Host")[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Forbidden: This action requires one of the following roles: ${allowedRoles.join(", ")}`,
      });
      return;
    }

    next();
  };
}

/**
 * verifyStudioOwnership:
 * Ensures the authenticated user is the host who created the studio.
 * Protects system-seeded studios (without hostId) from modification.
 */
export async function verifyStudioOwnership(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

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

    // System-seeded studios lack hostId and are immutable
    if (!studio.hostId) {
      res.status(403).json({
        success: false,
        message: "System studio listings cannot be modified or deleted",
      });
      return;
    }

    // Must be the owner
    if (studio.hostId !== req.user.id) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to modify this studio listing",
      });
      return;
    }

    req.studio = studio;
    next();
  } catch (error) {
    next(error);
  }
}
