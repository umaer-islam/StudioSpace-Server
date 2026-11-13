import dotenv from "dotenv";

dotenv.config();

interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  CLIENT_URL: string;
  MONGODB_URI: string;
  DB_NAME: string;
}

function validateEnv(): EnvConfig {
  const missingVars: string[] = [];

  const PORT = Number(process.env.PORT) || 5000;
  const NODE_ENV = process.env.NODE_ENV || "development";
  const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
  const DB_NAME = process.env.DB_NAME || "studiospace";
  const MONGODB_URI = process.env.MONGODB_URI?.trim();

  if (!MONGODB_URI) {
    missingVars.push("MONGODB_URI");
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
  };
}

export const env = validateEnv();

