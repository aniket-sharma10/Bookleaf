import { redirect } from "next/navigation";

import { getUserFromCookies, portalPath } from "@/server/auth/guards";

// `/` has no page of its own: send each visitor to where they belong.
export default async function Home() {
  const user = await getUserFromCookies();
  redirect(user ? portalPath(user.role) : "/login");
}
