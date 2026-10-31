import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { z } from "zod";

import type { PrismaClient } from "@/generated/prisma/client";
import { createGeneratorFromEnv, generateLogged } from "@/server/ai/client";
import { AiError } from "@/server/ai/provider";
import { fakeGenerator } from "../helpers/fake-ai";
import { connectTestDb, truncateAllTables } from "../helpers/test-db-client";

// AI entry point: configuration rules and one AiCallLog row per call.

const schema = z.strictObject({ answer: z.string() });
const base = {
  task: "CLASSIFY" as const,
  system: "SYSTEM",
  user: "USER: author@example.test",
  schema,
  promptVersion: "test-v1",
  ticketId: null,
};

let db: PrismaClient;
beforeAll(async () => {
  db = await connectTestDb();
  await truncateAllTables(db);
});
beforeEach(async () => {
  await db.aiCallLog.deleteMany();
});
afterAll(() => db.$disconnect());

describe("createGeneratorFromEnv", () => {
  const full = {
    GEMINI_API_KEY: "key",
    GEMINI_CLASSIFY_MODEL: "classify-model",
    GEMINI_DRAFT_MODEL: "draft-model",
  };

  it("enables AI only when the key and both models are set", () => {
    const enabled = createGeneratorFromEnv(full);
    expect(enabled.modelFor("CLASSIFY")).toBe("classify-model");
    expect(enabled.modelFor("DRAFT")).toBe("draft-model");

    for (const missing of Object.keys(full) as (keyof typeof full)[]) {
      const generator = createGeneratorFromEnv({
        ...full,
        [missing]: undefined,
      });
      expect(generator.modelFor("CLASSIFY"), missing).toBe("disabled");
    }
  });

  it("fails fast as DISABLED when AI is off", async () => {
    const generator = createGeneratorFromEnv({});
    const error = await generator
      .generate({ task: "DRAFT", system: "", user: "", schema })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiError);
    expect((error as AiError).kind).toBe("DISABLED");
  });
});

describe("generateLogged", () => {
  it("logs a successful call with separate token counts and the prompt version", async () => {
    const generator = fakeGenerator({
      data: { answer: "ok" },
      usage: { inputTokens: 80, outputTokens: 12, thinkingTokens: 40 },
    });
    await expect(generateLogged(generator, base)).resolves.toMatchObject({
      data: { answer: "ok" },
    });

    const rows = await db.aiCallLog.findMany();
    expect(rows).toEqual([
      expect.objectContaining({
        kind: "CLASSIFY",
        model: "fake-classify-model",
        promptVersion: "test-v1",
        outcome: "OK",
        inputTokens: 80,
        outputTokens: 12,
        thinkingTokens: 40,
        ticketId: null,
      }),
    ]);
    expect(rows[0]!.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("logs each failure kind and rethrows it as an AiError", async () => {
    for (const kind of [
      "TIMEOUT",
      "RATE_LIMITED",
      "INVALID_OUTPUT",
      "PROVIDER_ERROR",
      "DISABLED",
    ] as const) {
      const error = await generateLogged(fakeGenerator(kind), base).catch(
        (e: unknown) => e,
      );
      expect((error as AiError).kind).toBe(kind);
    }
    const outcomes = (
      await db.aiCallLog.findMany({ orderBy: { createdAt: "asc" } })
    ).map((row) => row.outcome);
    expect(outcomes.sort()).toEqual([
      "DISABLED",
      "INVALID_OUTPUT",
      "PROVIDER_ERROR",
      "RATE_LIMITED",
      "TIMEOUT",
    ]);
  });

  it("turns unexpected errors into PROVIDER_ERROR", async () => {
    const generator = {
      ...fakeGenerator(),
      generate: () => Promise.reject(new Error("boom")),
    };
    const error = await generateLogged(generator, base).catch(
      (e: unknown) => e,
    );
    expect((error as AiError).kind).toBe("PROVIDER_ERROR");
    expect((await db.aiCallLog.findFirstOrThrow()).outcome).toBe(
      "PROVIDER_ERROR",
    );
  });

  it("never stores prompt text or personal data in the log", async () => {
    await generateLogged(
      fakeGenerator({ data: { answer: "secret answer" } }),
      base,
    );
    const row = JSON.stringify(await db.aiCallLog.findFirstOrThrow());
    expect(row).not.toContain("author@example.test");
    expect(row).not.toContain("SYSTEM");
    expect(row).not.toContain("secret answer");
  });

  it("still returns the result if writing the log fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    // An unknown ticket ID breaks the foreign key, so the insert fails.
    await expect(
      generateLogged(fakeGenerator({ data: { answer: "ok" } }), {
        ...base,
        ticketId: "no-such-ticket",
      }),
    ).resolves.toMatchObject({ data: { answer: "ok" } });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
