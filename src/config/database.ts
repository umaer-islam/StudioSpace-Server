import dns from "node:dns";
import { MongoClient, Db, ServerApiVersion } from "mongodb";
import { env } from "./env.js";

// Ensure DNS SRV records resolve cleanly in Windows/local router environments
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // Fall back to system DNS
}

let client: MongoClient | null = null;
let dbInstance: Db | null = null;

export async function connectToDatabase(): Promise<Db> {
  if (dbInstance && client) {
    return dbInstance;
  }

  try {
    client = new MongoClient(env.MONGODB_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });

    await client.connect();
    dbInstance = client.db(env.DB_NAME);

    // Verify connection with a ping
    await dbInstance.command({ ping: 1 });
    console.log(`[Database] Successfully connected to MongoDB Atlas database: ${env.DB_NAME}`);

    return dbInstance;
  } catch (error) {
    console.error("[Database] Connection to MongoDB failed:", error instanceof Error ? error.message : "Unknown error");
    client = null;
    dbInstance = null;
    throw error;
  }
}

export function getDatabase(): Db {
  if (!dbInstance) {
    throw new Error("[Database] Database is not connected. Call connectToDatabase() first.");
  }
  return dbInstance;
}

export async function pingDatabase(): Promise<boolean> {
  try {
    if (!client || !dbInstance) {
      return false;
    }
    await dbInstance.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

export async function closeDatabaseConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    dbInstance = null;
    console.log("[Database] MongoDB connection closed.");
  }
}
