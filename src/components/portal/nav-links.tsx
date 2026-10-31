"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import type { PortalTone } from "./portal-header";

export type NavItem = {
  href: string;
  label: string;
  /** Only highlight on this exact path (for a portal's home page). */
  exact?: boolean;
};

const linkTone: Record<PortalTone, { active: string; idle: string }> = {
  author: {
    active: "bg-accent text-accent-foreground",
    idle: "text-muted-foreground hover:bg-muted hover:text-foreground",
  },
  admin: {
    active: "bg-background/15 text-background",
    idle: "text-background/70 hover:bg-background/10 hover:text-background",
  },
};

export function NavLinks({
  items,
  tone,
  className,
}: {
  items: NavItem[];
  tone: PortalTone;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <ul className={cn("flex items-center gap-1", className)}>
      {items.map(({ href, label, exact }) => {
        const active = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active ? linkTone[tone].active : linkTone[tone].idle,
              )}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
