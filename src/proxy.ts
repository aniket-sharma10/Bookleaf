import { type NextRequest, NextResponse } from "next/server";

import { portalPath } from "@/lib/routes";
import { AUTH_COOKIE } from "@/server/auth/cookie";
import { verifyAuthToken } from "@/server/auth/jwt";

/**
 * UX redirects only (architecture §5): send logged-out visitors to /login and
 * signed-in users to their own portal before a portal page renders. It checks
 * the token without touching the database. Security does not depend on it:
 * portal layouts check again, and every API route enforces access itself.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const user = await verifyAuthToken(request.cookies.get(AUTH_COOKIE)?.value);
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const home = portalPath(user.role);
  const { pathname } = request.nextUrl;
  if (pathname !== home && !pathname.startsWith(`${home}/`)) {
    return NextResponse.redirect(new URL(home, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/author/:path*", "/admin/:path*"],
};
