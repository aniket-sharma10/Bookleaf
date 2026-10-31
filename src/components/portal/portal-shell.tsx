import type { NavItem } from "./nav-links";
import { PortalHeader, type PortalTone } from "./portal-header";

/** Page frame shared by both portals: skip link, header, centred content. */
export function PortalShell({
  children,
  ...header
}: {
  children: React.ReactNode;
  tone: PortalTone;
  portalLabel: string;
  homeHref: string;
  nav: NavItem[];
  userName: string;
  userDetail: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-card px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <PortalHeader {...header} />
      <main
        id="main"
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10"
      >
        {children}
      </main>
    </div>
  );
}
