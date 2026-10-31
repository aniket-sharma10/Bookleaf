import "server-only";
import { after } from "next/server";

/**
 * Runs a task after the response has been sent (architecture §6.5). On
 * Vercel, after() keeps the function alive until the task settles, so a new
 * ticket's 201 never waits for the AI. A failure is logged, never thrown:
 * the request it follows has already succeeded.
 */
export function scheduleBackground(
  name: string,
  task: () => Promise<unknown>,
): void {
  const run = async () => {
    try {
      await task();
    } catch (error) {
      console.error(`Background task "${name}" failed:`, error);
    }
  };
  try {
    after(run);
  } catch {
    // after() only works inside a request (route handler, server action).
    // Anywhere else (e.g. a script), run the task now without waiting.
    void run();
  }
}
