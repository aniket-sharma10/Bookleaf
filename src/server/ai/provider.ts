import "server-only";
import type { z } from "zod";

// The provider boundary (ADR-0002). Prompts, schemas and services depend only
// on this file; `gemini.ts` is the one implementation, and tests use a fake.

/** The two AI jobs; each has its own model and limits. */
export type AiTask = "CLASSIFY" | "DRAFT";

/** Why an AI call failed. The app degrades on every one of these. */
export type AiErrorKind =
  "TIMEOUT" | "RATE_LIMITED" | "INVALID_OUTPUT" | "PROVIDER_ERROR" | "DISABLED";

export class AiError extends Error {
  /** Tokens the provider still charged for (e.g. output that failed validation). */
  usage?: TokenUsage;

  constructor(
    readonly kind: AiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "AiError";
  }
}

/** Token counts as reported by the provider; null when not reported. */
export type TokenUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  /** Reasoning tokens, billed with output but counted separately. */
  thinkingTokens: number | null;
};

export type GenerateRequest<T> = {
  task: AiTask;
  /** System instructions: our own text only, never user content. */
  system: string;
  /** The user turn: data blocks built by our code (ticket text is redacted). */
  user: string;
  /** Output contract: sent as a JSON schema and enforced with Zod. */
  schema: z.ZodType<T>;
};

export type GenerateResult<T> = { data: T; usage: TokenUsage };

export interface StructuredGenerator {
  /** The model used for a task, for logging ("disabled" when AI is off). */
  modelFor(task: AiTask): string;
  /** Resolves with schema-valid data, or rejects with an AiError. */
  generate<T>(request: GenerateRequest<T>): Promise<GenerateResult<T>>;
}

/** Used when AI isn't configured: every call fails fast as DISABLED. */
export const disabledGenerator: StructuredGenerator = {
  modelFor: () => "disabled",
  generate: () =>
    Promise.reject(new AiError("DISABLED", "AI is not configured.")),
};
