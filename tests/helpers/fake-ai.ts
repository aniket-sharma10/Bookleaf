import {
  AiError,
  type AiErrorKind,
  type GenerateRequest,
  type GenerateResult,
  type StructuredGenerator,
  type TokenUsage,
} from "@/server/ai/provider";

// A scriptable stand-in for the Gemini adapter: tests decide what each call
// returns or throws, and can inspect the requests (prompts) it received.

export type FakeGenerator = StructuredGenerator & {
  calls: GenerateRequest<unknown>[];
};

type Reply = { data: unknown; usage?: Partial<TokenUsage> } | AiErrorKind;

/** Returns the replies in order (the last one repeats). */
export function fakeGenerator(...replies: Reply[]): FakeGenerator {
  const calls: GenerateRequest<unknown>[] = [];
  return {
    calls,
    modelFor: (task) => `fake-${task.toLowerCase()}-model`,
    async generate<T>(request: GenerateRequest<T>): Promise<GenerateResult<T>> {
      calls.push(request as GenerateRequest<unknown>);
      const reply = replies[Math.min(calls.length, replies.length) - 1];
      if (reply === undefined || typeof reply === "string") {
        throw new AiError(reply ?? "PROVIDER_ERROR", `fake ${reply} failure`);
      }
      return {
        // The test supplies data matching the request's schema.
        data: request.schema.parse(reply.data),
        usage: {
          inputTokens: 100,
          outputTokens: 20,
          thinkingTokens: null,
          ...reply.usage,
        },
      };
    },
  };
}
