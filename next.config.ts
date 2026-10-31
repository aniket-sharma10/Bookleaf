import type { NextConfig } from "next";

// Sent on every response. No page is meant to be embedded, so framing is
// refused outright (clickjacking), rather than relying only on the SameSite
// cookie keeping framed pages logged out. nosniff stops browsers guessing
// content types.
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

// Cache Components (`cacheComponents`) is intentionally left off: every page is
// per-user and authenticated, so there is nothing to cache, and enabling it
// would force Suspense boundaries around cookie reads in the auth layouts.
const nextConfig: NextConfig = {
  headers: async () => [{ source: "/:path*", headers: SECURITY_HEADERS }],
  // Don't auto-generate AGENTS.md on `next dev`; CLAUDE.md already points agents
  // at the version-matched docs in node_modules/next/dist/docs/.
  agentRules: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
