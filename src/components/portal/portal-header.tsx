import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";

import { LogoutButton } from "./logout-button";
import { type NavItem, NavLinks } from "./nav-links";

/** Author portal: light and calm. Admin portal: dark ink "support desk". */
export type PortalTone = "author" | "admin";

const headerTone: Record<
  PortalTone,
  { bar: string; label: string; muted: string; button: string }
> = {
  author: {
    bar: "border-b bg-card/85 text-foreground backdrop-blur",
    label: "bg-accent text-accent-foreground",
    muted: "text-muted-foreground",
    button: "",
  },
  admin: {
    bar: "bg-foreground text-background",
    label: "bg-background/15 text-background",
    muted: "text-background/65",
    button: "text-background hover:bg-background/10 hover:text-background",
  },
};

export function PortalHeader({
  tone,
  portalLabel,
  homeHref,
  nav,
  userName,
  userDetail,
}: {
  tone: PortalTone;
  portalLabel: string;
  homeHref: string;
  nav: NavItem[];
  userName: string;
  userDetail: string;
}) {
  const style = headerTone[tone];
  return (
    <header className={cn("sticky top-0 z-30", style.bar)}>
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link
          href={homeHref}
          className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <BrandMark
            className={
              tone === "admin" ? "ring-1 ring-background/20" : undefined
            }
          />
          <span className="font-heading text-lg font-semibold tracking-tight">
            BookLeaf
          </span>
          <span
            className={cn(
              "hidden rounded-full px-2 py-0.5 text-xs font-medium sm:inline",
              style.label,
            )}
          >
            {portalLabel}
          </span>
        </Link>

        <nav aria-label="Main" className="hidden md:block">
          <NavLinks items={nav} tone={tone} />
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-sm font-medium">{userName}</p>
            <p className={cn("text-xs", style.muted)}>{userDetail}</p>
          </div>
          <LogoutButton className={style.button} />
        </div>
      </div>

      {/* Narrow screens: the nav moves to its own scrollable row. */}
      <nav
        aria-label="Main"
        className="-mt-1 overflow-x-auto px-4 pb-2 sm:px-6 md:hidden"
      >
        <NavLinks items={nav} tone={tone} />
      </nav>
    </header>
  );
}
