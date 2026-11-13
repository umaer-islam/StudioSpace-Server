import dotenv from "dotenv";

dotenv.config();

interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  CLIENT_URL: string;
  MONGODB_URI: string;
  DB_NAME: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

function validateEnv(): EnvConfig {
  const missingVars: string[] = [];

  const PORT = Number(process.env.PORT) || 5000;
  const NODE_ENV = process.env.NODE_ENV || "development";
  const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
  const DB_NAME = process.env.DB_NAME || "studiospace";
  const MONGODB_URI = process.env.MONGODB_URI?.trim();
  const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET?.trim();
  const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL?.trim() || `http://localhost:${PORT}`;

  if (!MONGODB_URI) {
    missingVars.push("MONGODB_URI");
  }

  if (!BETTER_AUTH_SECRET) {
    missingVars.push("BETTER_AUTH_SECRET");
  }

  if (missingVars.length > 0) {
    throw new Error(
      `[Env Validation Error] Missing required environment variable(s): ${missingVars.join(", ")}. Please configure them in your .env file.`
    );
  }

  return {
    PORT,
    NODE_ENV,
    CLIENT_URL,
    MONGODB_URI: MONGODB_URI as string,
    DB_NAME,
    BETTER_AUTH_SECRET: BETTER_AUTH_SECRET as string,
    BETTER_AUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID?.trim(),
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET?.trim(),
  };
}

export const env = validateEnv();
