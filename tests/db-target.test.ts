import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  assertLocalDevDatabase,
  assertPrismaCliTarget,
  DatabaseTargetError,
} from "../prisma/db-target";
import {
  assertTestDatabase,
  loadTestDatabaseUrl,
} from "./helpers/test-database";

const DEV = "postgresql://bookleaf:pw@127.0.0.1:55432/bookleaf_dev";
const TEST = "postgresql://bookleaf:pw@127.0.0.1:55433/bookleaf_test";
// `.invalid` never resolves (RFC 2606), so these can't reach a real server.
const REMOTE = "postgresql://someuser:S3cretPass@db.example.invalid:5432/prod";

const unintended = [
  ["another local Postgres", "postgresql://u:pw@127.0.0.1:5432/bookleaf_dev"],
  [
    "a hosted database",
    "postgresql://u:pw@ep-x.example.invalid/neondb?sslmode=require",
  ],
  ["a different database name", "postgresql://u:pw@127.0.0.1:55432/postgres"],
  [
    "the dev name on the test port",
    "postgresql://u:pw@127.0.0.1:55433/bookleaf_dev",
  ],
  ["a non-Postgres URL", "mysql://u:pw@127.0.0.1:55432/bookleaf_dev"],
];

describe("assertLocalDevDatabase (seed and db:verify)", () => {
  const guard = (url: string | undefined, nodeEnv = "development") =>
    assertLocalDevDatabase(url, { action: "seed", nodeEnv });

  it("accepts the local development database", () => {
    expect(() => guard(DEV)).not.toThrow();
    expect(() =>
      guard("postgres://u:p@localhost:55432/bookleaf_dev"),
    ).not.toThrow();
  });

  it.each([["the test database", TEST], ...unintended])(
    "refuses %s",
    (_label, url) => {
      expect(() => guard(url)).toThrow(DatabaseTargetError);
    },
  );

  it("refuses when NODE_ENV is production, even for the dev URL", () => {
    expect(() => guard(DEV, "production")).toThrow(/NODE_ENV is production/);
  });

  it("refuses a missing or unparseable URL", () => {
    expect(() => guard(undefined)).toThrow(/DATABASE_URL is not set/);
    expect(() => guard("not a url")).toThrow(/not a valid URL/);
  });

  it("never includes credentials in the refusal message", () => {
    expect(() => guard(REMOTE)).toThrow(/db\.example\.invalid:5432\/prod/);
    expect(() => guard(REMOTE)).not.toThrow(/S3cretPass|someuser/);
  });
});

describe("assertPrismaCliTarget (prisma.config.ts)", () => {
  const cli = (
    url: string | undefined,
    argv: string[] = ["node", "prisma", "migrate", "reset", "--force"],
    allowRemote?: string,
  ) => assertPrismaCliTarget({ url, argv, allowRemote });

  it("allows the two local databases and commands without a URL", () => {
    expect(() => cli(DEV)).not.toThrow();
    expect(() => cli(TEST)).not.toThrow();
    expect(() => cli(undefined, ["node", "prisma", "generate"])).not.toThrow();
  });

  it.each(unintended)("refuses %s", (_label, url) => {
    expect(() => cli(url)).toThrow(DatabaseTargetError);
  });

  it("refuses a remote database and explains the opt-in, without credentials", () => {
    expect(() => cli(REMOTE)).toThrow(/PRISMA_ALLOW_REMOTE_DATABASE=true/);
    expect(() => cli(REMOTE)).not.toThrow(/S3cretPass|someuser/);
  });

  it("refuses the --url override in both flag forms", () => {
    const base = ["node", "prisma", "migrate", "dev"];
    expect(() => cli(DEV, [...base, `--url=${REMOTE}`])).toThrow(/--url/);
    expect(() => cli(DEV, [...base, "--url", REMOTE])).toThrow(/--url/);
  });

  it("lets a deliberate opt-in through, and only the exact value 'true'", () => {
    expect(() => cli(REMOTE, undefined, "true")).not.toThrow();
    expect(() => cli(REMOTE, undefined, "1")).toThrow(DatabaseTargetError);
    expect(() => cli(REMOTE, undefined, "yes")).toThrow(DatabaseTargetError);
  });
});

describe("test-database guard (tests/helpers/test-database.ts)", () => {
  const dir = mkdtempSync(join(tmpdir(), "bookleaf-test-env-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const envFile = (name: string, contents: string) => {
    const path = join(dir, name);
    writeFileSync(path, contents);
    return path;
  };

  it("accepts only the local test database, and only in test mode", () => {
    expect(() => assertTestDatabase(TEST, "test")).not.toThrow();
    expect(() => assertTestDatabase(DEV, "test")).toThrow(
      /Refusing to reset or truncate 127\.0\.0\.1:55432\/bookleaf_dev/,
    );
    expect(() => assertTestDatabase(REMOTE, "test")).toThrow(
      DatabaseTargetError,
    );
    expect(() => assertTestDatabase(TEST, "development")).toThrow(
      /NODE_ENV is "development", expected "test"/,
    );
    expect(() => assertTestDatabase(TEST, "production")).toThrow(
      /NODE_ENV is "production"/,
    );
  });

  it.each(unintended)("refuses %s as the test database", (_label, url) => {
    expect(() => assertTestDatabase(url, "test")).toThrow(DatabaseTargetError);
  });

  it("reads the URL from the given .env.test file", () => {
    const path = envFile("ok.env", `DATABASE_URL="${TEST}"\n`);
    expect(loadTestDatabaseUrl(path)).toBe(TEST);
  });

  it("rejects a .env.test that points at the dev or a remote database", () => {
    const dev = envFile("dev.env", `DATABASE_URL="${DEV}"\n`);
    const remote = envFile("remote.env", `DATABASE_URL="${REMOTE}"\n`);
    expect(() => loadTestDatabaseUrl(dev)).toThrow(/bookleaf_dev/);
    expect(() => loadTestDatabaseUrl(remote)).toThrow(DatabaseTargetError);
    expect(() => loadTestDatabaseUrl(remote)).not.toThrow(/S3cretPass/);
  });

  it("explains how to create a missing .env.test or DATABASE_URL", () => {
    expect(() => loadTestDatabaseUrl(join(dir, "absent.env"))).toThrow(
      /cp \.env\.test\.example \.env\.test/,
    );
    const empty = envFile("empty.env", "# no DATABASE_URL\n");
    expect(() => loadTestDatabaseUrl(empty)).toThrow(/DATABASE_URL is not set/);
  });
});

describe("test worker environment (tests/setup-env.ts)", () => {
  it("exposes only the test database to app code under test", () => {
    expect(() =>
      assertTestDatabase(process.env.DATABASE_URL, process.env.NODE_ENV),
    ).not.toThrow();
    expect(process.env.DIRECT_URL).toBe("");
  });
});
