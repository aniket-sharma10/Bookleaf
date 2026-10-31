import type { NavItem } from "@/components/portal/nav-links";
import { PortalShell } from "@/components/portal/portal-shell";
import { requirePortalUser } from "@/server/auth/guards";

const ADMIN_NAV: NavItem[] = [{ href: "/admin", label: "Ticket queue" }];

// Redirects logged-out and author visitors (UX only; the APIs enforce access).
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requirePortalUser("ADMIN");
  return (
    <PortalShell
      tone="admin"
      portalLabel="Support desk"
      homeHref="/admin"
      nav={ADMIN_NAV}
      userName={user.name}
      userDetail="Support team"
    >
      {children}
    </PortalShell>
  );
}
