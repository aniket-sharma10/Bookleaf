import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors the "@/*" path alias in tsconfig.json.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws unless resolved with Next's "react-server"
      // condition. Tests run server code directly in Node, so use its no-op
      // build. The guard still applies in the real Next.js bundles.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    // Unit tests sit next to the code (src/**); integration tests live in tests/.
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    // Rebuilds bookleaf_test from the migrations once per run.
    globalSetup: ["tests/global-setup.ts"],
    // Test files share one database, so run them one at a time.
    fileParallelism: false,
    // Points app code under test at the test DB (from .env.test, guarded).
    setupFiles: ["tests/setup-env.ts"],
  },
});
