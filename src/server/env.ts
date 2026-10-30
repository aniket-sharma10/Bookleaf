import "server-only";
import { z } from "zod";

// Treat empty strings (e.g. `KEY=` copied from .env.example) as "not set".
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (value) => (value === "" ? undefined : value),
    schema.optional(),
  );
}

const postgresUrl = z
  .string()
  .regex(
    /^postgres(ql)?:\/\/\S+$/,
    "must be a postgres:// or postgresql:// URL",
  );

// Every variable is optional here so the app never fails at startup because a
// not-yet-used integration is unconfigured. Code that needs a value calls
// requireEnv(), which fails with a clear message at the point of use.
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  // Local Docker Postgres in development; the hosted (Neon) pooled URL in production.
  DATABASE_URL: optional(postgresUrl),
  // Non-pooled URL for Prisma migrations against the hosted DB. Not needed locally.
  DIRECT_URL: optional(postgresUrl),
  AUTH_JWT_SECRET: optional(
    z.string().min(32, "must be at least 32 characters"),
  ),
  // Without a key, AI features are disabled and the rest of the app still works.
  GEMINI_API_KEY: optional(z.string()),
  GEMINI_CLASSIFY_MODEL: optional(z.string()),
  GEMINI_DRAFT_MODEL: optional(z.string()),
});

export type Env = z.infer<typeof envSchema>;

export class EnvError extends Error {
  override name = "EnvError";
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    // Report only the variable name and the broken rule — never the value,
    // which may be a secret.
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
    throw new EnvError(
      `Invalid environment variables:\n  - ${problems.join("\n  - ")}`,
    );
  }
  return result.data;
}

let cached: Env | undefined;

/** Validated server environment, parsed on first use. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Returns a variable that the calling feature cannot run without. */
export function requireEnv<K extends keyof Env>(name: K): NonNullable<Env[K]> {
  const value = getEnv()[name];
  if (value === undefined) {
    throw new EnvError(
      `Missing required environment variable ${name}. Set it in .env (see .env.example).`,
    );
  }
  return value as NonNullable<Env[K]>;
}
