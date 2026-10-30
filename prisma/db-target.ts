// Database-target guards (ADR-0006, ADR-0008). Every tool that writes to a
// database checks the target here before connecting. A target is identified by
// protocol, host, port and database name; credentials are never printed.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** The two local Docker databases from docker-compose.yml. */
export const LOCAL_DATABASES = {
  dev: { port: "55432", name: "bookleaf_dev" },
  test: { port: "55433", name: "bookleaf_test" },
} as const;

export type LocalDatabase = keyof typeof LOCAL_DATABASES;

/** Setting this to "true" lets the Prisma CLI target a non-local database. */
export const ALLOW_REMOTE_ENV = "PRISMA_ALLOW_REMOTE_DATABASE";

export class DatabaseTargetError extends Error {
  override name = "DatabaseTargetError";
}

function parseDatabaseUrl(databaseUrl: string | undefined): URL {
  if (!databaseUrl) {
    throw new DatabaseTargetError(
      "DATABASE_URL is not set. Copy .env.example to .env (see README).",
    );
  }
  try {
    return new URL(databaseUrl);
  } catch {
    throw new DatabaseTargetError("DATABASE_URL is not a valid URL.");
  }
}

/** `host:port/database`, without the username or password. */
function describeTarget(url: URL): string {
  return `${url.hostname}:${url.port || "5432"}${url.pathname}`;
}

function matchLocalDatabase(url: URL): LocalDatabase | null {
  const isPostgres =
    url.protocol === "postgres:" || url.protocol === "postgresql:";
  if (!isPostgres || !LOCAL_HOSTS.has(url.hostname)) return null;
  for (const [key, db] of Object.entries(LOCAL_DATABASES)) {
    if (url.port === db.port && url.pathname === `/${db.name}`) {
      return key as LocalDatabase;
    }
  }
  return null;
}

function describeAllowed(allowed: readonly LocalDatabase[]): string {
  return allowed
    .map(
      (key) =>
        `127.0.0.1:${LOCAL_DATABASES[key].port}/${LOCAL_DATABASES[key].name}`,
    )
    .join(" or ");
}

/** Throws unless the URL points at one of the allowed local databases. */
export function assertLocalDatabase(
  databaseUrl: string | undefined,
  allowed: readonly LocalDatabase[],
  action: string,
): asserts databaseUrl is string {
  const url = parseDatabaseUrl(databaseUrl);
  const match = matchLocalDatabase(url);
  if (!match || !allowed.includes(match)) {
    throw new DatabaseTargetError(
      `Refusing to ${action} ${describeTarget(url)}: only ${describeAllowed(allowed)} is allowed.`,
    );
  }
}

/**
 * Guard for the dataset seed and the read-only dataset verification: the local
 * development database only, and never in production mode.
 */
export function assertLocalDevDatabase(
  databaseUrl: string | undefined,
  {
    action,
    nodeEnv = process.env.NODE_ENV,
  }: { action: string; nodeEnv?: string },
): asserts databaseUrl is string {
  if (nodeEnv === "production") {
    throw new DatabaseTargetError(
      `Refusing to ${action}: NODE_ENV is production.`,
    );
  }
  assertLocalDatabase(databaseUrl, ["dev"], action);
}

/**
 * Guard evaluated by prisma.config.ts for every Prisma CLI command. Unless the
 * remote opt-in is set, the CLI may only reach the two local databases, and
 * the `--url` override (accepted by `migrate dev` and `db push`) is refused
 * because it would bypass this check.
 */
export function assertPrismaCliTarget({
  url,
  argv,
  allowRemote,
}: {
  url: string | undefined;
  argv: readonly string[];
  allowRemote: string | undefined;
}): void {
  if (allowRemote === "true") return;

  if (argv.some((arg) => arg === "--url" || arg.startsWith("--url="))) {
    throw new DatabaseTargetError(
      `Refusing the --url override: set DATABASE_URL instead so the target can be checked, or set ${ALLOW_REMOTE_ENV}=true for a deliberate remote operation.`,
    );
  }
  // Commands such as `prisma generate` need no database; those that do will
  // fail on their own if no URL is configured.
  if (!url) return;

  try {
    assertLocalDatabase(url, ["dev", "test"], "run the Prisma CLI against");
  } catch (error) {
    if (!(error instanceof DatabaseTargetError)) throw error;
    throw new DatabaseTargetError(
      `${error.message} To target another database deliberately, set ${ALLOW_REMOTE_ENV}=true for that one command.`,
    );
  }
}
