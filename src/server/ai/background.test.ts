import { describe, expect, it, vi } from "vitest";

import { scheduleBackground } from "./background";

describe("scheduleBackground", () => {
  it("outside a request, runs the task straight away", async () => {
    const task = vi.fn(async () => "done");
    scheduleBackground("test", task);
    await vi.waitFor(() => expect(task).toHaveBeenCalledTimes(1));
  });

  it("logs a failing task instead of throwing", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      scheduleBackground("boom", async () => {
        throw new Error("boom");
      }),
    ).not.toThrow();
    await vi.waitFor(() => expect(logged).toHaveBeenCalled());
    expect(String(logged.mock.calls[0]![0])).toContain('"boom"');
    logged.mockRestore();
  });
});
