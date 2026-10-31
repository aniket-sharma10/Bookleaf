import type { NavItem } from "@/components/portal/nav-links";
import { PortalShell } from "@/components/portal/portal-shell";
import { requirePortalUser } from "@/server/auth/guards";

const AUTHOR_NAV: NavItem[] = [
  { href: "/author", label: "Dashboard", exact: true },
  { href: "/author/tickets", label: "My tickets" },
];

// Redirects logged-out and admin visitors (UX only; the APIs enforce access).
export default async function AuthorLayout({
  children,
}: LayoutProps<"/author">) {
  const user = await requirePortalUser("AUTHOR");
  return (
    <PortalShell
      tone="author"
      portalLabel="Author portal"
      homeHref="/author"
      nav={AUTHOR_NAV}
      userName={user.name}
      userDetail="Author account"
    >
      {children}
    </PortalShell>
  );
}
