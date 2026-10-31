import "server-only";

import type { LoginInput } from "@/lib/schemas/auth";
import type { AuthUser } from "@/server/auth/jwt";
import { verifyPassword } from "@/server/auth/password";
import { getDb } from "@/server/db";
import { UnauthenticatedError } from "@/server/http/errors";

/** The signed-in user as the API returns it (never the token). */
export type CurrentUser = AuthUser & { name: string };

// A cost-12 bcrypt hash of a random value nobody knows. An unknown email is
// compared against it, so every login does the same ~250 ms of bcrypt work
// and response time doesn't reveal which emails have accounts.
const DUMMY_PASSWORD_HASH =
  "$2b$12$sRBr/ArsnVxZgU0/z44/aOuDC/iYZRegdm1oLYwGHn9q4Uvf895de";

// One message for an unknown email and a wrong password alike (AUTH-01).
const INVALID_LOGIN = "Invalid email or password.";

const userSelect = {
  id: true,
  name: true,
  role: true,
  authorId: true,
} as const;

type UserRow = {
  id: string;
  name: string;
  role: "AUTHOR" | "ADMIN";
  authorId: string | null;
};

function toCurrentUser({ id, name, role, authorId }: UserRow): CurrentUser {
  if (role === "ADMIN") return { id, name, role, authorId: null };
  // The database CHECK constraint guarantees every AUTHOR has an authorId.
  if (!authorId) throw new Error(`AUTHOR user ${id} has no authorId.`);
  return { id, name, role, authorId };
}

/** Checks email and password; throws a generic 401 on any mismatch. */
export async function authenticate({
  email,
  password,
}: LoginInput): Promise<CurrentUser> {
  const user = await getDb().user.findUnique({
    where: { email },
    select: { ...userSelect, passwordHash: true },
  });
  const passwordMatches = await verifyPassword(
    password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  if (!user || !passwordMatches) throw new UnauthenticatedError(INVALID_LOGIN);
  return toCurrentUser(user);
}

/** The session's user, with their current name. 401 if the user is gone. */
export async function getCurrentUser(session: AuthUser): Promise<CurrentUser> {
  const user = await getDb().user.findUnique({
    where: { id: session.id },
    select: userSelect,
  });
  if (!user) throw new UnauthenticatedError();
  return toCurrentUser(user);
}
