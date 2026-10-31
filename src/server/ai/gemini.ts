import "server-only";
import {
  type GenerateContentResponse,
  GoogleGenAI,
  ThinkingLevel,
} from "@google/genai";
import { z } from "zod";

import {
  AiError,
  type AiTask,
  type GenerateRequest,
  type GenerateResult,
  type StructuredGenerator,
} from "./provider";

// The only module that imports the Gemini SDK (ADR-0003, architecture §6.1).
// Settings verified against @google/genai 2.32.0 and Google's docs:
// - thinking can't be disabled on these models, only reduced, so each task
//   sets the lowest level that does the job;
// - temperature stays at its default (Google strongly recommends 1.0 for
//   Gemini 3 models; lower values can cause looping or degraded output);
// - unenforced schema keywords (e.g. maxLength) are stripped by the API, so
//   Zod enforces every bound after parsing.

type TaskSettings = {
  thinkingLevel: ThinkingLevel;
  /** One overall budget, shared by the first attempt and any retry. */
  timeoutMs: number;
  maxOutputTokens: number;
};

const TASK_SETTINGS: Record<AiTask, TaskSettings> = {
  CLASSIFY: {
    thinkingLevel: ThinkingLevel.MINIMAL,
    timeoutMs: 15_000,
    maxOutputTokens: 1_024,
  },
  DRAFT: {
    thinkingLevel: ThinkingLevel.LOW,
    timeoutMs: 30_000,
    maxOutputTokens: 4_096,
  },
};

/** The part of the SDK client we use; injectable so tests need no network. */
export type GeminiModels = Pick<GoogleGenAI["models"], "generateContent">;

export type GeminiConfig = {
  apiKey: string;
  models: Record<AiTask, string>;
  /** Pause before the single retry; tests set 0. */
  retryDelayMs?: number;
};

/** JSON schema for Gemini: the Zod schema, minus the `$schema` marker. */
function toResponseSchema(schema: z.ZodType): Record<string, unknown> {
  const jsonSchema = { ...(z.toJSONSchema(schema) as Record<string, unknown>) };
  delete jsonSchema.$schema;
  return jsonSchema;
}

/** HTTP status of an SDK error (ApiError has `status`), if any. */
function httpStatus(error: unknown): number | undefined {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
}

/** Maps a failed request to our error kinds; true when one retry may help. */
function classifyFailure(
  error: unknown,
  signal: AbortSignal,
): { error: AiError; retryable: boolean } {
  if (signal.aborted) {
    return {
      error: new AiError("TIMEOUT", "AI request timed out."),
      retryable: false,
    };
  }
  const status = httpStatus(error);
  if (status === 429) {
    // Rate limit or exhausted quota: retrying immediately only burns quota.
    return {
      error: new AiError("RATE_LIMITED", "AI rate limit or quota reached."),
      retryable: false,
    };
  }
  if (status !== undefined && status < 500) {
    // e.g. 400 bad request, 401/403 invalid key: retrying won't help.
    return {
      error: new AiError(
        "PROVIDER_ERROR",
        `AI request rejected (HTTP ${status}).`,
      ),
      retryable: false,
    };
  }
  // 5xx (incl. 503 "high demand") or a network failure: worth one retry.
  return {
    error: new AiError(
      "PROVIDER_ERROR",
      status
        ? `AI provider error (HTTP ${status}).`
        : "AI provider unreachable.",
    ),
    retryable: true,
  };
}

/** Turns a response into schema-valid data, or throws INVALID_OUTPUT. */
function parseResponse<T>(
  response: GenerateContentResponse,
  schema: z.ZodType<T>,
): T {
  if (response.promptFeedback?.blockReason) {
    throw new AiError("INVALID_OUTPUT", "AI request was blocked.");
  }
  const finishReason = response.candidates?.[0]?.finishReason;
  if (finishReason && finishReason !== "STOP") {
    // MAX_TOKENS (truncated JSON), SAFETY, RECITATION, …
    throw new AiError(
      "INVALID_OUTPUT",
      `AI output incomplete (${finishReason}).`,
    );
  }
  const text = response.text;
  if (!text) throw new AiError("INVALID_OUTPUT", "AI returned no output.");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AiError("INVALID_OUTPUT", "AI output was not valid JSON.");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new AiError("INVALID_OUTPUT", "AI output did not match the schema.");
  }
  return parsed.data;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createGeminiGenerator(
  { apiKey, models, retryDelayMs = 1_000 }: GeminiConfig,
  client: GeminiModels = new GoogleGenAI({ apiKey }).models,
): StructuredGenerator {
  return {
    modelFor: (task) => models[task],

    async generate<T>({
      task,
      system,
      user,
      schema,
    }: GenerateRequest<T>): Promise<GenerateResult<T>> {
      const settings = TASK_SETTINGS[task];
      const signal = AbortSignal.timeout(settings.timeoutMs);
      const request = {
        model: models[task],
        contents: user,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseJsonSchema: toResponseSchema(schema),
          thinkingConfig: { thinkingLevel: settings.thinkingLevel },
          maxOutputTokens: settings.maxOutputTokens,
          abortSignal: signal,
        },
      };

      let response: GenerateContentResponse | undefined;
      for (let attempt = 1; response === undefined; attempt++) {
        try {
          response = await client.generateContent(request);
        } catch (caught) {
          const failure = classifyFailure(caught, signal);
          if (!failure.retryable || attempt === 2) throw failure.error;
          await sleep(retryDelayMs);
          if (signal.aborted) {
            throw new AiError("TIMEOUT", "AI request timed out.");
          }
        }
      }

      const metadata = response.usageMetadata;
      const usage = {
        inputTokens: metadata?.promptTokenCount ?? null,
        outputTokens: metadata?.candidatesTokenCount ?? null,
        thinkingTokens: metadata?.thoughtsTokenCount ?? null,
      };
      try {
        return { data: parseResponse(response, schema), usage };
      } catch (error) {
        // Unusable output still cost tokens: keep them for the call log.
        if (error instanceof AiError) error.usage = usage;
        throw error;
      }
    },
  };
}
