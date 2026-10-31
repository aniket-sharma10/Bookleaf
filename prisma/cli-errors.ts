import { Prisma } from "../src/generated/prisma/client";
import { DatasetError } from "./dataset";
import { DatabaseTargetError } from "./db-target";
import { SeedConfigError } from "./users";

/**
 * One-line, safe description of a failure in the seed or verify scripts.
 * Prisma error messages can echo query arguments (i.e. dataset values), so
 * query failures are reported by class or code only. `afterQueryFailure` is
 * appended when a query may have run (e.g. "No changes were committed.").
 */
export function describeCliError(
  error: unknown,
  afterQueryFailure = "",
): string {
  const suffix = afterQueryFailure ? ` ${afterQueryFailure}` : "";
  if (
    error instanceof DatabaseTargetError ||
    error instanceof DatasetError ||
    error instanceof SeedConfigError
  ) {
    return error.message;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P1001") {
      return "Cannot reach the database server. Is it running? Try `npm run db:up`.";
    }
    if (error.code === "P1000") {
      return "Database authentication failed. Check the credentials in DATABASE_URL.";
    }
    return `Database error (Prisma code ${error.code}).${suffix}`;
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return `Prisma rejected the query (details omitted to avoid logging dataset values).${suffix}`;
  }
  return `unexpected ${error instanceof Error ? error.name : "error"}.${suffix}`;
}
