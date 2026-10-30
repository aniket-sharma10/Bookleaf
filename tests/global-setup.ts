import { resetTestDatabase } from "./helpers/test-database";

// Runs once before the whole suite: rebuilds bookleaf_test from the migrations
// so every run starts from the same clean, fully migrated schema.
export default function setup(): void {
  resetTestDatabase();
}
