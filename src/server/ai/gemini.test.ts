import type { GenerateContentResponse } from "@google/genai";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createGeminiGenerator, type GeminiModels } from "./gemini";
import { AiError, type AiErrorKind } from "./provider";

// The adapter with a fake SDK client: no network, every failure path forced.

const schema = z.strictObject({
  category: z.enum(["A", "B"]),
  note: z.string().max(20),
});

const request = {
  task: "CLASSIFY" as const,
  system: "SYSTEM TEXT",
  user: "USER TEXT",
  schema,
};

function response(
  text: string | undefined,
  extra: Partial<Record<string, unknown>> = {},
): GenerateContentResponse {
  return {
    text,
    candidates: [{ finishReason: "STOP" }],
    usageMetadata: {
      promptTokenCount: 120,
      candidatesTokenCount: 30,
      thoughtsTokenCount: 15,
    },
    ...extra,
  } as unknown as GenerateContentResponse;
}

function apiError(status: number): Error {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

function generatorWith(...outcomes: (GenerateContentResponse | Error)[]) {
  const generateContent = vi.fn<GeminiModels["generateContent"]>();
  for (const outcome of outcomes) {
    if (outcome instanceof Error)
      generateContent.mockRejectedValueOnce(outcome);
    else generateContent.mockResolvedValueOnce(outcome);
  }
  const generator = createGeminiGenerator(
    {
      apiKey: "test-key",
      models: { CLASSIFY: "classify-model", DRAFT: "draft-model" },
      retryDelayMs: 0,
    },
    { generateContent },
  );
  return { generator, generateContent };
}

async function kindOf(promise: Promise<unknown>): Promise<AiErrorKind> {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(AiError);
  return (error as AiError).kind;
}

describe("createGeminiGenerator", () => {
  it("sends the verified configuration and returns schema-valid data with token counts", async () => {
    const { generator, generateContent } = generatorWith(
      response('{"category":"A","note":"ok"}'),
    );
    await expect(generator.generate(request)).resolves.toEqual({
      data: { category: "A", note: "ok" },
      usage: { inputTokens: 120, outputTokens: 30, thinkingTokens: 15 },
    });

    const sent = generateContent.mock.calls[0]![0];
    expect(sent.model).toBe("classify-model");
    expect(sent.contents).toBe("USER TEXT");
    expect(sent.config).toMatchObject({
      systemInstruction: "SYSTEM TEXT",
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: "MINIMAL" },
      maxOutputTokens: 1024,
    });
    expect(sent.config?.abortSignal).toBeInstanceOf(AbortSignal);
    // Default temperature (Gemini 3 guidance), and a plain JSON schema.
    expect(sent.config).not.toHaveProperty("temperature");
    const jsonSchema = sent.config?.responseJsonSchema as Record<
      string,
      unknown
    >;
    expect(jsonSchema).not.toHaveProperty("$schema");
    expect(jsonSchema).toMatchObject({
      type: "object",
      required: ["category", "note"],
      additionalProperties: false,
    });
  });

  it("uses the draft model and LOW thinking for drafts", async () => {
    const { generator, generateContent } = generatorWith(
      response('{"category":"B","note":"x"}'),
    );
    await generator.generate({ ...request, task: "DRAFT" });
    const sent = generateContent.mock.calls[0]![0];
    expect(sent.model).toBe("draft-model");
    expect(sent.config).toMatchObject({
      thinkingConfig: { thinkingLevel: "LOW" },
      maxOutputTokens: 4096,
    });
    expect(generator.modelFor("DRAFT")).toBe("draft-model");
  });

  it("reports missing token counts as null", async () => {
    const { generator } = generatorWith(
      response('{"category":"A","note":"ok"}', {
        usageMetadata: { promptTokenCount: 49, candidatesTokenCount: 55 },
      }),
    );
    expect((await generator.generate(request)).usage).toEqual({
      inputTokens: 49,
      outputTokens: 55,
      thinkingTokens: null,
    });
  });

  it("maps 429 to RATE_LIMITED without retrying", async () => {
    const { generator, generateContent } = generatorWith(apiError(429));
    expect(await kindOf(generator.generate(request))).toBe("RATE_LIMITED");
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("retries a 503 once and succeeds", async () => {
    const { generator, generateContent } = generatorWith(
      apiError(503),
      response('{"category":"A","note":"ok"}'),
    );
    await expect(generator.generate(request)).resolves.toMatchObject({
      data: { category: "A" },
    });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("gives up after one retry on 5xx and network errors", async () => {
    const twice503 = generatorWith(apiError(503), apiError(500));
    expect(await kindOf(twice503.generator.generate(request))).toBe(
      "PROVIDER_ERROR",
    );
    expect(twice503.generateContent).toHaveBeenCalledTimes(2);

    const network = generatorWith(
      new TypeError("fetch failed"),
      new TypeError("fetch failed"),
    );
    expect(await kindOf(network.generator.generate(request))).toBe(
      "PROVIDER_ERROR",
    );
    expect(network.generateContent).toHaveBeenCalledTimes(2);
  });

  it("doesn't retry other 4xx errors such as an invalid key", async () => {
    const { generator, generateContent } = generatorWith(apiError(401));
    expect(await kindOf(generator.generate(request))).toBe("PROVIDER_ERROR");
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("uses the per-task timeout, or AI_TIMEOUT_MS when configured", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const { generator } = generatorWith(
      response('{"category":"A","note":"ok"}'),
    );
    await generator.generate(request);
    expect(timeout).toHaveBeenLastCalledWith(15_000);

    const generateContent = vi
      .fn<GeminiModels["generateContent"]>()
      .mockResolvedValue(response('{"category":"A","note":"ok"}'));
    const overridden = createGeminiGenerator(
      { apiKey: "k", models: { CLASSIFY: "c", DRAFT: "d" }, timeoutMs: 1 },
      { generateContent },
    );
    await overridden.generate({ ...request, task: "DRAFT" });
    expect(timeout).toHaveBeenLastCalledWith(1);
    timeout.mockRestore();
  });

  it("maps an aborted request to TIMEOUT", async () => {
    vi.spyOn(AbortSignal, "timeout").mockReturnValueOnce(AbortSignal.abort());
    const { generator } = generatorWith(
      Object.assign(new Error("aborted"), { name: "AbortError" }),
    );
    expect(await kindOf(generator.generate(request))).toBe("TIMEOUT");
  });

  it("rejects unusable output as INVALID_OUTPUT and keeps the token counts", async () => {
    const cases: GenerateContentResponse[] = [
      response("not json"),
      response('{"category":"Z","note":"ok"}'), // not in the enum
      response('{"category":"A","note":"far longer than twenty characters"}'), // bound only Zod enforces
      response('{"category":"A","note":"ok","extra":1}'), // strict object
      response(undefined),
      response('{"category":"A"', {
        candidates: [{ finishReason: "MAX_TOKENS" }],
      }),
      response("{}", { promptFeedback: { blockReason: "SAFETY" } }),
    ];
    for (const bad of cases) {
      const { generator } = generatorWith(bad);
      const error = await generator.generate(request).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AiError);
      expect((error as AiError).kind).toBe("INVALID_OUTPUT");
    }
    const { generator } = generatorWith(response("not json"));
    const error = (await generator
      .generate(request)
      .catch((e: unknown) => e)) as AiError;
    expect(error.usage).toEqual({
      inputTokens: 120,
      outputTokens: 30,
      thinkingTokens: 15,
    });
  });
});
