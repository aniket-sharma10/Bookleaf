import { loadTestDatabaseUrl } from "./helpers/test-database";

// Runs in every test worker before any test file is imported. App code under
// test (src/server/env.ts, getDb) must only ever see the test database, so the
// URL from .env.test overrides anything exported in the shell or set in .env.
process.env.DATABASE_URL = loadTestDatabaseUrl();
process.env.DIRECT_URL = "";

// Fixed, test-only signing secret, so tests never depend on (or read) the real
// AUTH_JWT_SECRET in .env.
process.env.AUTH_JWT_SECRET = "test-only-jwt-secret-not-used-anywhere-else";

// Tests never call the real Gemini API: AI code under test gets a fake
// generator, and with these unset the real one would be disabled anyway.
delete process.env.GEMINI_API_KEY;
delete process.env.GEMINI_CLASSIFY_MODEL;
delete process.env.GEMINI_DRAFT_MODEL;
