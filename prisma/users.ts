import type { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/server/auth/password";
import type { Dataset } from "./dataset";

// Login accounts. The dataset has authors but no users or admins, so the seed
// creates one AUTHOR user per dataset author (same email, linked by authorId)
// plus the support team's ADMIN accounts below. Demo passwords come from env.

export const ADMIN_ACCOUNTS = [
  { email: "support.lead@bookleaf.example", name: "Support Lead" },
  { email: "support.agent@bookleaf.example", name: "Support Agent" },
] as const;

const MIN_PASSWORD_LENGTH = 8;

export class SeedConfigError extends Error {
  override name = "SeedConfigError";
}

export type SeedPasswords = { authorPassword: string; adminPassword: string };

/** Reads the demo passwords; fails before anything is written if missing. */
export function readSeedPasswords(
  env: Record<string, string | undefined> = process.env,
): SeedPasswords {
  const authorPassword = env.SEED_AUTHOR_PASSWORD ?? "";
  const adminPassword = env.SEED_ADMIN_PASSWORD ?? "";
  for (const [name, value] of [
    ["SEED_AUTHOR_PASSWORD", authorPassword],
    ["SEED_ADMIN_PASSWORD", adminPassword],
  ] as const) {
    if (value.length < MIN_PASSWORD_LENGTH) {
      throw new SeedConfigError(
        `${name} must be set to at least ${MIN_PASSWORD_LENGTH} characters (see .env.example).`,
      );
    }
  }
  return { authorPassword, adminPassword };
}

type UserSpec = {
  email: string;
  name: string;
  role: "AUTHOR" | "ADMIN";
  authorId: string | null;
  password: string;
};

function userSpecs(dataset: Dataset, passwords: SeedPasswords): UserSpec[] {
  return [
    ...dataset.authors.map((author) => ({
      email: author.email,
      name: author.name,
      role: "AUTHOR" as const,
      authorId: author.author_id,
      password: passwords.authorPassword,
    })),
    ...ADMIN_ACCOUNTS.map((admin) => ({
      ...admin,
      role: "ADMIN" as const,
      authorId: null,
      password: passwords.adminPassword,
    })),
  ];
}

export type UserSeedSummary = {
  authors: number;
  admins: number;
  passwordsSet: number;
};

/**
 * Upserts every login account by email. Existing password hashes are kept
 * unless `resetPasswords` is true, so re-seeding never logs anyone out of a
 * changed password. Hashing happens before the transaction because bcrypt is
 * deliberately slow.
 */
export async function seedUsers(
  db: PrismaClient,
  dataset: Dataset,
  passwords: SeedPasswords,
  { resetPasswords = false }: { resetPasswords?: boolean } = {},
): Promise<UserSeedSummary> {
  const specs = userSpecs(dataset, passwords);
  const existing = await db.user.findMany({
    where: { email: { in: specs.map((spec) => spec.email) } },
    select: { email: true },
  });
  const existingEmails = new Set(existing.map((user) => user.email));

  const newHashes = new Map<string, string>();
  for (const spec of specs) {
    if (resetPasswords || !existingEmails.has(spec.email)) {
      newHashes.set(spec.email, await hashPassword(spec.password));
    }
  }

  await db.$transaction(
    async (tx) => {
      for (const spec of specs) {
        const profile = {
          name: spec.name,
          role: spec.role,
          authorId: spec.authorId,
        };
        const passwordHash = newHashes.get(spec.email);
        if (existingEmails.has(spec.email)) {
          await tx.user.update({
            where: { email: spec.email },
            data: passwordHash ? { ...profile, passwordHash } : profile,
          });
        } else {
          // Every new account got a hash in the loop above.
          await tx.user.create({
            data: {
              email: spec.email,
              ...profile,
              passwordHash: passwordHash!,
            },
          });
        }
      }
    },
    { timeout: 30_000 },
  );

  return {
    authors: dataset.authors.length,
    admins: ADMIN_ACCOUNTS.length,
    passwordsSet: newHashes.size,
  };
}

const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$/;

/**
 * Read-only check that every dataset author has a linked AUTHOR login, that
 * the admin accounts exist without an author link, and that every stored
 * password is a bcrypt hash. Reports author IDs, never dataset emails.
 */
export async function verifyUsers(
  db: PrismaClient,
  dataset: Dataset,
): Promise<string[]> {
  const users = await db.user.findMany({
    select: { email: true, role: true, authorId: true, passwordHash: true },
  });
  const byEmail = new Map(users.map((user) => [user.email, user]));
  const problems: string[] = [];

  for (const author of dataset.authors) {
    const user = byEmail.get(author.email);
    if (!user) {
      problems.push(`User for author ${author.author_id}: missing`);
    } else if (user.role !== "AUTHOR" || user.authorId !== author.author_id) {
      problems.push(
        `User for author ${author.author_id}: not linked to its author`,
      );
    }
  }
  for (const admin of ADMIN_ACCOUNTS) {
    const user = byEmail.get(admin.email);
    if (!user) {
      problems.push(`Admin ${admin.email}: missing`);
    } else if (user.role !== "ADMIN" || user.authorId !== null) {
      problems.push(`Admin ${admin.email}: wrong role or author link`);
    }
  }
  const unhashed = users.filter((user) => !BCRYPT_HASH.test(user.passwordHash));
  if (unhashed.length > 0) {
    problems.push(
      `${unhashed.length} user(s) have a password that is not a bcrypt hash`,
    );
  }
  return problems;
}
