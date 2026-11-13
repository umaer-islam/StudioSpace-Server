import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { env } from "./config/env.js";
import healthRoutes from "./routes/health.routes.js";
import studioRoutes from "./routes/studio.routes.js";

const app = express();

// Middleware
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json());

// Routes
app.use("/api", healthRoutes);
app.use("/api", studioRoutes);

// Centralized 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Resource not found",
  });
});

// Centralized error handler
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
