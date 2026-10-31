// Client-safe session types and portal routes, shared by the UI and server.

export type Role = "AUTHOR" | "ADMIN";

/** The signed-in user as `/api/auth/login` and `/api/auth/me` return it. */
export type SessionUser = {
  id: string;
  name: string;
  role: Role;
  authorId: string | null;
};

/** Each role's home portal. */
export function portalPath(role: Role): "/author" | "/admin" {
  return role === "AUTHOR" ? "/author" : "/admin";
}
