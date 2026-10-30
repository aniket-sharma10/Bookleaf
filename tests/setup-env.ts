import { loadTestDatabaseUrl } from "./helpers/test-database";

// Runs in every test worker before any test file is imported. App code under
// test (src/server/env.ts, getDb) must only ever see the test database, so the
// URL from .env.test overrides anything exported in the shell or set in .env.
process.env.DATABASE_URL = loadTestDatabaseUrl();
process.env.DIRECT_URL = "";
