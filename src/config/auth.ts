import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { jwt } from "better-auth/plugins";
import type { Db } from "mongodb";
import { getDatabase, isDatabaseConnected } from "./database.js";
import { env } from "./env.js";

// Dummy collection for safe initial index preparation before connectToDatabase() finishes
const dummyCollection = new Proxy({} as any, {
  get() {
    return async () => {};
  },
});

// Lazy database proxy so betterAuth can be initialized at top-level before connectToDatabase() completes
const dbProxy = new Proxy({} as Db, {
  get(_target, prop) {
    if (prop === "collection") {
      return (name: string) => {
        if (!isDatabaseConnected()) {
          return dummyCollection;
        }
        return getDatabase().collection(name);
      };
    }
    const db = getDatabase();
    const value = (db as any)[prop];
    return typeof value === "function" ? value.bind(db) : value;
  },
});

export const auth = betterAuth({
  database: mongodbAdapter(dbProxy),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [
    env.CLIENT_URL,
    "http://localhost:3000",
    "http://localhost:5000",
  ],
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "Creator",
        input: true,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Strictly whitelist allowed roles at registration: only Creator or Host
          if (user.role !== "Host" && user.role !== "Creator") {
            user.role = "Creator";
          }
          return { data: user };
        },
      },
      update: {
        before: async (user) => {
          // Prevent role escalation: strip role from user updates
          if ("role" in user) {
            delete (user as any).role;
          }
          return { data: user };
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 6,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID || "",
      clientSecret: env.GOOGLE_CLIENT_SECRET || "",
      enabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    },
  },
  plugins: [
    jwt({
      jwt: {
        issuer: env.BETTER_AUTH_URL,
        audience: env.CLIENT_URL,
        expirationTime: "7d",
      },
    }),
  ],
  advanced: {
    cookiePrefix: "studiospace",
    useSecureCookies: env.NODE_ENV === "production",
  },
});
