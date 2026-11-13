import { Router, Request, Response } from "express";
import { pingDatabase } from "../config/database.js";
import { env } from "../config/env.js";

const router = Router();

router.get("/health", async (_req: Request, res: Response) => {
  const isDbHealthy = await pingDatabase();

  const responsePayload = {
    status: isDbHealthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    database: {
      status: isDbHealthy ? "connected" : "disconnected",
      name: env.DB_NAME,
    },
  };

  const statusCode = isDbHealthy ? 200 : 503;
  res.status(statusCode).json(responsePayload);
});

export default router;

