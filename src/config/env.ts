import dotenv from "dotenv";

dotenv.config();

export type SupportedEnv = "development" | "production" | "test";

interface EnvConfig {
  PORT: number;
  NODE_ENV: SupportedEnv;
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
  const validationErrors: string[] = [];

  // 1. NODE_ENV validation
  const rawNodeEnv = process.env.NODE_ENV?.trim() || "development";
  const supportedEnvs: SupportedEnv[] = ["development", "production", "test"];
  if (!supportedEnvs.includes(rawNodeEnv as SupportedEnv)) {
    validationErrors.push(
      `NODE_ENV must be one of: ${supportedEnvs.join(", ")} (received: "${rawNodeEnv}")`
    );
  }
  const NODE_ENV = (supportedEnvs.includes(rawNodeEnv as SupportedEnv)
    ? rawNodeEnv
    : "development") as SupportedEnv;
  const isProduction = NODE_ENV === "production";

  // 2. PORT validation (must be positive integer between 1 and 65535)
  const rawPort = process.env.PORT;
  let PORT = 5000;
  if (rawPort !== undefined && rawPort.trim() !== "") {
    const parsedPort = Number(rawPort);
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      validationErrors.push(
        `PORT must be a valid integer between 1 and 65535 (received: "${rawPort}")`
      );
    } else {
      PORT = parsedPort;
    }
  }

  // 3. Database credentials
  const MONGODB_URI = process.env.MONGODB_URI?.trim();
  const DB_NAME = process.env.DB_NAME?.trim() || "studiospace";
  if (!MONGODB_URI) {
    missingVars.push("MONGODB_URI");
  }

  // 4. BETTER_AUTH_SECRET validation (must be present and at least 32 characters)
  const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET?.trim();
  if (!BETTER_AUTH_SECRET) {
    missingVars.push("BETTER_AUTH_SECRET");
  } else if (BETTER_AUTH_SECRET.length < 32) {
    validationErrors.push(
      `BETTER_AUTH_SECRET must be at least 32 characters long for production security (current length: ${BETTER_AUTH_SECRET.length})`
    );
  }

  // 5. CLIENT_URL validation (required explicitly in production, defaults to localhost in dev/test)
  const rawClientUrl = process.env.CLIENT_URL?.trim();
  let CLIENT_URL = rawClientUrl || "http://localhost:3000";
  if (isProduction && !rawClientUrl) {
    missingVars.push("CLIENT_URL (explicit value required in production)");
  }

  // 6. BETTER_AUTH_URL validation (required explicitly in production, defaults to localhost in dev/test)
  const rawAuthUrl = process.env.BETTER_AUTH_URL?.trim();
  let BETTER_AUTH_URL = rawAuthUrl || `http://localhost:${PORT}`;
  if (isProduction && !rawAuthUrl) {
    missingVars.push("BETTER_AUTH_URL (explicit value required in production)");
  }

  // 7. Google OAuth Credentials validation (both required if either is provided)
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim();
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (Boolean(GOOGLE_CLIENT_ID) !== Boolean(GOOGLE_CLIENT_SECRET)) {
    validationErrors.push(
      "Both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be provided together if Google OAuth is configured."
    );
  }

  // Error reporting
  const allErrors: string[] = [];
  if (missingVars.length > 0) {
    allErrors.push(`Missing required variable(s): ${missingVars.join(", ")}`);
  }
  if (validationErrors.length > 0) {
    allErrors.push(...validationErrors);
  }

  if (allErrors.length > 0) {
    throw new Error(
      `[Env Validation Error]\n  - ${allErrors.join("\n  - ")}\nPlease configure them in your environment or .env file.`
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
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
  };
}

export const env = validateEnv();
