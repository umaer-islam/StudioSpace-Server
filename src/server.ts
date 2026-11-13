import app from "./app.js";
import { env } from "./config/env.js";
import { connectToDatabase, closeDatabaseConnection } from "./config/database.js";
import type { Server } from "http";

let server: Server;

async function bootstrap() {
  try {
    // Connect to database before starting HTTP listener
    await connectToDatabase();

    server = app.listen(env.PORT, () => {
      console.log(`[Server] StudioSpace API running on http://localhost:${env.PORT} in ${env.NODE_ENV} mode`);
    });
  } catch (error) {
    console.error("[Server] Fatal error during startup:", error instanceof Error ? error.message : "Unknown error");
    process.exit(1);
  }
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

