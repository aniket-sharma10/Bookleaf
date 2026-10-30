// The dataset seed may only write to the local development database
// (the bookleaf-db-dev container). Anything else — the test database, another
// local Postgres, or a hosted/production database — is refused before any
// connection is opened.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
export const DEV_DATABASE = { port: "55432", name: "bookleaf_dev" } as const;

export class SeedTargetError extends Error {
  override name = "SeedTargetError";
}

export function assertLocalDevDatabase(
  databaseUrl: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): asserts databaseUrl is string {
  if (nodeEnv === "production") {
    throw new SeedTargetError("Refusing to seed: NODE_ENV is production.");
  }
  if (!databaseUrl) {
    throw new SeedTargetError(
      "DATABASE_URL is not set. Copy .env.example to .env (see README).",
    );
  }

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new SeedTargetError("DATABASE_URL is not a valid URL.");
  }

  // Describe the target without the username or password.
  const target = `${url.hostname}:${url.port || "5432"}${url.pathname}`;
  const isDevDatabase =
    (url.protocol === "postgres:" || url.protocol === "postgresql:") &&
    LOCAL_HOSTS.has(url.hostname) &&
    url.port === DEV_DATABASE.port &&
    url.pathname === `/${DEV_DATABASE.name}`;

  if (!isDevDatabase) {
    throw new SeedTargetError(
      `Refusing to seed ${target}: the dataset seed only writes to the local ` +
        `development database (127.0.0.1:${DEV_DATABASE.port}/${DEV_DATABASE.name}).`,
    );
  }
}
