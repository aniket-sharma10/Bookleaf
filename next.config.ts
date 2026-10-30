import type { NextConfig } from "next";

// Cache Components (`cacheComponents`) is intentionally left off: every page is
// per-user and authenticated, so there is nothing to cache, and enabling it
// would force Suspense boundaries around cookie reads in the auth layouts.
const nextConfig: NextConfig = {
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
