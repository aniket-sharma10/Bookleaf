import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { requireEnv } from "@/server/env";

// Next.js dev hot reloads re-evaluate modules; keeping the client on globalThis
// stops each reload from opening a new connection pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Shared Prisma client, created on first use so that importing this module
 * never fails when DATABASE_URL is not configured.
 */
export function getDb(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg({
      connectionString: requireEnv("DATABASE_URL"),
    });
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.prisma;
}
