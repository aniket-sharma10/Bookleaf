// Database-target guards (architecture §8). Every tool that writes to a
// database checks the target here before connecting. A target is identified by
// protocol, host, port and database name; credentials are never printed.
// The "dev" target is the local Docker dev database or, when DEV_DATABASE_HOST
// is set, the hosted (Neon) development database on exactly that host.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** The two local Docker databases from docker-compose.yml. */
export const LOCAL_DATABASES = {
  dev: { port: "55432", name: "bookleaf_dev" },
  test: { port: "55433", name: "bookleaf_test" },
} as const;

export type LocalDatabase = keyof typeof LOCAL_DATABASES;

/** Names the hosted development database's direct host (set in .env). */
export const DEV_HOST_ENV = "DEV_DATABASE_HOST";

/** Setting this to "true" lets the Prisma CLI target any other database. */
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

function matchDatabase(
  url: URL,
  devHost: string | undefined,
): LocalDatabase | null {
  const isPostgres =
    url.protocol === "postgres:" || url.protocol === "postgresql:";
  if (!isPostgres) return null;
  // A local address can't be registered as the hosted dev host; otherwise
  // every local database (including the test one) would count as "dev".
  if (devHost && !LOCAL_HOSTS.has(devHost) && url.hostname === devHost) {
    return "dev";
  }
  if (!LOCAL_HOSTS.has(url.hostname)) return null;
  for (const [key, db] of Object.entries(LOCAL_DATABASES)) {
    if (url.port === db.port && url.pathname === `/${db.name}`) {
      return key as LocalDatabase;
    }
  }
  return null;
}

function describeAllowed(
  allowed: readonly LocalDatabase[],
  devHost: string | undefined,
): string {
  const targets = allowed.map(
    (key) =>
      `127.0.0.1:${LOCAL_DATABASES[key].port}/${LOCAL_DATABASES[key].name}`,
  );
  if (allowed.includes("dev") && devHost) {
    targets.push(`${devHost} (${DEV_HOST_ENV})`);
  }
  return targets.join(" or ");
}

/** Throws unless the URL points at one of the allowed databases. */
export function assertLocalDatabase(
  databaseUrl: string | undefined,
  allowed: readonly LocalDatabase[],
  action: string,
  devHost: string | undefined = process.env[DEV_HOST_ENV],
): asserts databaseUrl is string {
  const url = parseDatabaseUrl(databaseUrl);
  const match = matchDatabase(url, devHost);
  if (!match || !allowed.includes(match)) {
    throw new DatabaseTargetError(
      `Refusing to ${action} ${describeTarget(url)}: only ${describeAllowed(allowed, devHost)} is allowed.`,
    );
  }
}

/**
 * Guard for the dataset seed and the read-only dataset verification: the
 * development database only (local or the registered Neon host), and never in
 * production mode.
 */
export function assertLocalDevDatabase(
  databaseUrl: string | undefined,
  {
    action,
    nodeEnv = process.env.NODE_ENV,
    devHost = process.env[DEV_HOST_ENV],
  }: { action: string; nodeEnv?: string; devHost?: string },
): asserts databaseUrl is string {
  if (nodeEnv === "production") {
    throw new DatabaseTargetError(
      `Refusing to ${action}: NODE_ENV is production.`,
    );
  }
  assertLocalDatabase(databaseUrl, ["dev"], action, devHost);
}

/**
 * Guard evaluated by prisma.config.ts for every Prisma CLI command. Unless the
 * remote opt-in is set, the CLI may only reach the dev database (local or the
 * registered Neon host) or the local test database, and
 * the `--url` override (accepted by `migrate dev` and `db push`) is refused
 * because it would bypass this check.
 */
export function assertPrismaCliTarget({
  url,
  argv,
  allowRemote,
  devHost,
}: {
  url: string | undefined;
  argv: readonly string[];
  allowRemote: string | undefined;
  devHost: string | undefined;
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
    assertLocalDatabase(
      url,
      ["dev", "test"],
      "run the Prisma CLI against",
      devHost,
    );
  } catch (error) {
    if (!(error instanceof DatabaseTargetError)) throw error;
    throw new DatabaseTargetError(
      `${error.message} To target another database deliberately, set ${ALLOW_REMOTE_ENV}=true for that one command.`,
    );
  }
}
