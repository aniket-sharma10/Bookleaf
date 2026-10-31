import "server-only";

import { getDb } from "@/server/db";
import { type Env, getEnv } from "@/server/env";
import { AiUnavailableError } from "@/server/http/errors";

import { createGeminiGenerator } from "./gemini";
import {
  AiError,
  type AiErrorKind,
  type GenerateRequest,
  type GenerateResult,
  type StructuredGenerator,
  type TokenUsage,
  disabledGenerator,
} from "./provider";

/**
 * The generator for this environment. AI is on only when the key and both
 * model IDs are set; model IDs are never hard-coded, so they can't go stale.
 * Anything missing means AI is off and the rest of the app works as usual.
 */
export function createGeneratorFromEnv(
  env: Pick<
    Env,
    "GEMINI_API_KEY" | "GEMINI_CLASSIFY_MODEL" | "GEMINI_DRAFT_MODEL"
  >,
): StructuredGenerator {
  const apiKey = env.GEMINI_API_KEY;
  const classify = env.GEMINI_CLASSIFY_MODEL;
  const draft = env.GEMINI_DRAFT_MODEL;
  if (!apiKey || !classify || !draft) return disabledGenerator;
  return createGeminiGenerator({
    apiKey,
    models: { CLASSIFY: classify, DRAFT: draft },
  });
}

let cached: StructuredGenerator | undefined;

export function getGenerator(): StructuredGenerator {
  cached ??= createGeneratorFromEnv(getEnv());
  return cached;
}

const NO_USAGE: TokenUsage = {
  inputTokens: null,
  outputTokens: null,
  thinkingTokens: null,
};

/**
 * Runs one AI call and records exactly one AiCallLog row for it, whatever the
 * outcome. The log holds counts and labels only: never prompt text, output,
 * keys or personal data. Rejects with an AiError (unexpected errors become
 * PROVIDER_ERROR) so callers can degrade in one place.
 */
export async function generateLogged<T>(
  generator: StructuredGenerator,
  request: GenerateRequest<T> & {
    promptVersion: string;
    ticketId: string | null;
  },
): Promise<GenerateResult<T>> {
  const { promptVersion, ticketId, ...generateRequest } = request;
  const started = Date.now();
  let outcome: AiError["kind"] | "OK" = "OK";
  let usage = NO_USAGE;
  try {
    const result = await generator.generate(generateRequest);
    usage = result.usage;
    return result;
  } catch (caught) {
    const error =
      caught instanceof AiError
        ? caught
        : new AiError("PROVIDER_ERROR", "Unexpected AI failure.");
    outcome = error.kind;
    usage = error.usage ?? NO_USAGE;
    throw error;
  } finally {
    await logAiCall({
      ticketId,
      kind: request.task,
      model: generator.modelFor(request.task),
      promptVersion,
      outcome,
      ...usage,
      latencyMs: Date.now() - started,
    });
  }
}

type AiCallLogEntry = {
  ticketId: string | null;
  kind: "CLASSIFY" | "DRAFT";
  model: string;
  promptVersion: string;
  outcome: AiError["kind"] | "OK";
  latencyMs: number;
} & TokenUsage;

/** Best effort: a logging failure must never break the AI feature itself. */
async function logAiCall(entry: AiCallLogEntry): Promise<void> {
  try {
    await getDb().aiCallLog.create({ data: entry });
  } catch (error) {
    console.error("Failed to write AiCallLog:", error);
  }
}

const UNAVAILABLE_MESSAGES: Record<AiErrorKind, string> = {
  RATE_LIMITED:
    "The AI service is busy right now. Try again in a minute, or continue manually.",
  TIMEOUT:
    "The AI service took too long to respond. Try again, or continue manually.",
  INVALID_OUTPUT:
    "The AI returned an answer we couldn't use. Try again, or continue manually.",
  PROVIDER_ERROR:
    "The AI service is unavailable. Try again later, or continue manually.",
  DISABLED:
    "AI isn't configured here. You can still triage and reply manually.",
};

/** The 503 AI_UNAVAILABLE an admin sees for a failed AI call (DRAFT-08). */
export function aiUnavailable(kind: AiErrorKind): AiUnavailableError {
  return new AiUnavailableError(UNAVAILABLE_MESSAGES[kind]);
}
