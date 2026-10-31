import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

// Regression: the app must refuse to be framed (clickjacking) on every path.
describe("security headers", () => {
  it("apply to every path and forbid framing", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((rule) => rule.source === "/:path*");
    const headers = Object.fromEntries(
      (all?.headers ?? []).map(({ key, value }) => [key, value]),
    );
    expect(headers).toMatchObject({
      "Content-Security-Policy": "frame-ancestors 'none'",
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
    });
  });
});
