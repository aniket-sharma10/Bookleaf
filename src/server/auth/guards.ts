import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_COOKIE } from "./cookie";
import {
  type AdminUser,
  type AuthorUser,
  type AuthUser,
  verifyAuthToken,
} from "./jwt";

/** Each role's home portal. */
export function portalPath(role: AuthUser["role"]): "/author" | "/admin" {
  return role === "AUTHOR" ? "/author" : "/admin";
}

/** The signed-in user in a server component or layout, or null. */
export async function getUserFromCookies(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  return verifyAuthToken(cookieStore.get(AUTH_COOKIE)?.value);
}

/**
 * Page guard for portal layouts (UX only; API routes enforce access
 * themselves via withApi). Logged-out visitors go to /login; a signed-in user
 * in the other portal is sent to their own.
 */
export async function requireUser(role: "AUTHOR"): Promise<AuthorUser>;
export async function requireUser(role: "ADMIN"): Promise<AdminUser>;
export async function requireUser(role: AuthUser["role"]): Promise<AuthUser> {
  const user = await getUserFromCookies();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(portalPath(user.role));
  return user;
}
