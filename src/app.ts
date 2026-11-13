import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./config/auth.js";
import { env } from "./config/env.js";
import healthRoutes from "./routes/health.routes.js";
import studioRoutes from "./routes/studio.routes.js";
import bookingRoutes from "./routes/booking.routes.js";

const app = express();

// 1. CORS configuration
app.use(
  cors({
    origin: [
      env.CLIENT_URL,
      ...(env.NODE_ENV === "development" ? ["http://localhost:3000"] : []),
    ],
    credentials: true,
  })
);

// 2. Better Auth handler (Mounted BEFORE express.json())
app.all("/api/auth/*", toNodeHandler(auth));

// 3. JSON parser for remaining application routes
app.use(express.json());

// 4. Application routes
app.use("/api", healthRoutes);
app.use("/api", studioRoutes);
app.use("/api", bookingRoutes);

// 5. Centralized 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Resource not found",
  });
});

// 6. Centralized error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[Server Error]:", err.message);

  res.status(500).json({
    success: false,
    message:
      env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal server error",
  });
});

export default app;
