import app from "./app.js";
import { env } from "./config/env.js";
import { connectToDatabase, closeDatabaseConnection } from "./config/database.js";
import type { Server } from "http";

let server: Server;

async function bootstrap() {
  try {
    await connectToDatabase();
  } catch (error) {
    console.error(
      "[Database] Initial connection attempt failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    if (env.NODE_ENV === "production") {
      console.error(
        "[Fatal] Exiting process because database connection is required in production."
      );
      process.exit(1);
    }
    console.warn(
      "[Server] Starting HTTP server in degraded mode. /api/health will report database connectivity status."
    );
  }

  server = app.listen(env.PORT, () => {
    console.log(
      `[Server] StudioSpace API running on http://localhost:${env.PORT} in ${env.NODE_ENV} mode`
    );
  });
}

async function shutdown(signal: string) {
  console.log(`\n[Server] Received ${signal}. Gracefully shutting down...`);
  if (server) {
    server.close(async () => {
      console.log("[Server] HTTP server closed.");
      await closeDatabaseConnection();
      process.exit(0);
    });
  } else {
    await closeDatabaseConnection();
    process.exit(0);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

bootstrap();
