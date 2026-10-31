import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { portalPath, type Role } from "@/lib/routes";
import { type CurrentUser, getCurrentUser } from "@/server/services/auth";

import { AUTH_COOKIE } from "./cookie";
import {
  type AdminUser,
  type AuthorUser,
  type AuthUser,
  verifyAuthToken,
} from "./jwt";

export { portalPath };

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
export async function requireUser(role: Role): Promise<AuthUser> {
  const user = await getUserFromCookies();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(portalPath(user.role));
  return user;
}

/**
 * requireUser plus the user's display name, for portal layouts and pages.
 * React's cache() runs it once per request, so a layout and its page share
 * one token check and one database read.
 */
export const requirePortalUser = cache(
  async (role: Role): Promise<CurrentUser> =>
    getCurrentUser(
      role === "AUTHOR"
        ? await requireUser("AUTHOR")
        : await requireUser("ADMIN"),
    ),
);
