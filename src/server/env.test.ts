import { afterEach, describe, expect, it, vi } from "vitest";

import { EnvError, parseEnv } from "./env";

describe("parseEnv", () => {
  it("accepts an empty environment so unconfigured integrations don't block startup", () => {
    const env = parseEnv({});
    expect(env.NODE_ENV).toBe("development");
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.GEMINI_API_KEY).toBeUndefined();
  });

  it("treats empty strings as unset", () => {
    const env = parseEnv({
      DATABASE_URL: "",
      AUTH_JWT_SECRET: "",
      GEMINI_API_KEY: "",
    });
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.AUTH_JWT_SECRET).toBeUndefined();
    expect(env.GEMINI_API_KEY).toBeUndefined();
  });

  it("accepts local and hosted Postgres URLs", () => {
    const env = parseEnv({
      DATABASE_URL: "postgresql://user:pass@127.0.0.1:55432/bookleaf_dev",
      DIRECT_URL: "postgres://user:pass@db.example.com/app?sslmode=require",
    });
    expect(env.DATABASE_URL).toContain("bookleaf_dev");
    expect(env.DIRECT_URL).toContain("sslmode=require");
  });

  it("rejects an invalid DATABASE_URL without echoing its value", () => {
    const secret = "s3cr3t-db-password";
    const parse = () =>
      parseEnv({ DATABASE_URL: `mysql://user:${secret}@host/db` });
    expect(parse).toThrow(EnvError);
    expect(parse).toThrow(/DATABASE_URL: must be a postgres/);
    expect(parse).not.toThrow(new RegExp(secret));
  });

  it("rejects a short AUTH_JWT_SECRET without echoing it", () => {
    const parse = () => parseEnv({ AUTH_JWT_SECRET: "too-short-secret" });
    expect(parse).toThrow(/AUTH_JWT_SECRET: must be at least 32 characters/);
    expect(parse).not.toThrow(/too-short-secret/);
  });

  it("lists every invalid variable in one error", () => {
    const parse = () => parseEnv({ DATABASE_URL: "nope", NODE_ENV: "staging" });
    expect(parse).toThrow(/DATABASE_URL/);
    expect(parse).toThrow(/NODE_ENV/);
  });
});

describe("requireEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // getEnv() caches process.env, so each case loads a fresh module copy.
  async function loadEnvModule() {
    vi.resetModules();
    return import("./env");
  }

  it("throws a readable error naming a missing variable", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { requireEnv } = await loadEnvModule();
    expect(() => requireEnv("DATABASE_URL")).toThrow(
      "Missing required environment variable DATABASE_URL. Set it in .env (see .env.example).",
    );
  });

  it("returns the value when the variable is set", async () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://user:pass@127.0.0.1:55432/bookleaf_dev",
    );
    const { requireEnv } = await loadEnvModule();
    expect(requireEnv("DATABASE_URL")).toBe(
      "postgresql://user:pass@127.0.0.1:55432/bookleaf_dev",
    );
  });

  it("allows GEMINI_API_KEY to be absent (AI disabled)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const { getEnv } = await loadEnvModule();
    expect(getEnv().GEMINI_API_KEY).toBeUndefined();
  });
});
