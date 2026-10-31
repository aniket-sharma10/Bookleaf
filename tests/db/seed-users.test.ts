import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { verifyPassword } from "@/server/auth/password";
import { seedDataset } from "../../prisma/dataset";
import {
  ADMIN_ACCOUNTS,
  readSeedPasswords,
  SeedConfigError,
  seedUsers,
  verifyUsers,
} from "../../prisma/users";
import { edgeCaseRawDataset, toDataset } from "../fixtures/synthetic-dataset";
import { connectTestDb, truncateAllTables } from "../helpers/test-db-client";

// Login-account seeding against bookleaf_test, with synthetic data only.
const dataset = toDataset(edgeCaseRawDataset()); // authors A1, A2
const passwords = {
  authorPassword: "author-pass-123",
  adminPassword: "admin-pass-123",
};

let db: PrismaClient;
beforeAll(async () => {
  db = await connectTestDb();
});
beforeEach(async () => {
  await truncateAllTables(db);
  await seedDataset(db, dataset);
});
afterAll(() => db.$disconnect());

describe("seedUsers", () => {
  it("creates one linked AUTHOR login per author plus the admin logins", async () => {
    const summary = await seedUsers(db, dataset, passwords);
    expect(summary).toEqual({ authors: 2, admins: 2, passwordsSet: 4 });

    const users = await db.user.findMany({ orderBy: { email: "asc" } });
    expect(users).toHaveLength(4);
    expect(
      users
        .filter((u) => u.role === "AUTHOR")
        .map((u) => [u.email, u.authorId]),
    ).toEqual(
      expect.arrayContaining([
        ["author@example.test", "A1"],
        ["second@example.test", "A2"],
      ]),
    );
    for (const admin of ADMIN_ACCOUNTS) {
      expect(users.find((u) => u.email === admin.email)).toMatchObject({
        role: "ADMIN",
        authorId: null,
        name: admin.name,
      });
    }
    expect(await verifyUsers(db, dataset)).toEqual([]);
  });

  it("stores only bcrypt hashes that verify against the seeded passwords", async () => {
    await seedUsers(db, dataset, passwords);
    const author = await db.user.findUniqueOrThrow({
      where: { email: "author@example.test" },
    });
    const admin = await db.user.findUniqueOrThrow({
      where: { email: ADMIN_ACCOUNTS[0].email },
    });
    expect(author.passwordHash).not.toContain(passwords.authorPassword);
    expect(author.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    await expect(
      verifyPassword(passwords.authorPassword, author.passwordHash),
    ).resolves.toBe(true);
    await expect(
      verifyPassword(passwords.adminPassword, admin.passwordHash),
    ).resolves.toBe(true);
    await expect(
      verifyPassword(passwords.adminPassword, author.passwordHash),
    ).resolves.toBe(false);
  });

  it("keeps existing password hashes on re-run unless a reset is requested", async () => {
    await seedUsers(db, dataset, passwords);
    const hashesBefore = await db.user.findMany({
      select: { email: true, passwordHash: true },
      orderBy: { email: "asc" },
    });

    const changed = {
      authorPassword: "new-author-1",
      adminPassword: "new-admin-1",
    };
    const rerun = await seedUsers(db, dataset, changed);
    expect(rerun.passwordsSet).toBe(0);
    expect(await db.user.count()).toBe(4); // no duplicates
    expect(
      await db.user.findMany({
        select: { email: true, passwordHash: true },
        orderBy: { email: "asc" },
      }),
    ).toEqual(hashesBefore);

    const reset = await seedUsers(db, dataset, changed, {
      resetPasswords: true,
    });
    expect(reset.passwordsSet).toBe(4);
    const author = await db.user.findUniqueOrThrow({
      where: { email: "author@example.test" },
    });
    await expect(
      verifyPassword("new-author-1", author.passwordHash),
    ).resolves.toBe(true);
  });
});

describe("verifyUsers", () => {
  it("reports missing and wrongly linked logins by author ID, not email", async () => {
    await seedUsers(db, dataset, passwords);
    await db.user.delete({ where: { email: "second@example.test" } });
    await db.user.update({
      where: { email: ADMIN_ACCOUNTS[1].email },
      data: { passwordHash: "plaintext-password" },
    });

    const problems = await verifyUsers(db, dataset);
    expect(problems).toEqual([
      "User for author A2: missing",
      "1 user(s) have a password that is not a bcrypt hash",
    ]);
    expect(problems.join("\n")).not.toMatch(/second@example\.test/);
  });
});

describe("readSeedPasswords", () => {
  it("requires both demo passwords with at least 8 characters", () => {
    expect(
      readSeedPasswords({
        SEED_AUTHOR_PASSWORD: "author-pass-123",
        SEED_ADMIN_PASSWORD: "admin-pass-123",
      }),
    ).toEqual(passwords);
    expect(() =>
      readSeedPasswords({ SEED_ADMIN_PASSWORD: "admin-pass-123" }),
    ).toThrow(/SEED_AUTHOR_PASSWORD must be set/);
    expect(() =>
      readSeedPasswords({
        SEED_AUTHOR_PASSWORD: "author-pass-123",
        SEED_ADMIN_PASSWORD: "short",
      }),
    ).toThrow(SeedConfigError);
  });
});
