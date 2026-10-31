import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** A calm placeholder for a section with nothing to show yet. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed bg-card/60 px-6 py-14 text-center",
        className,
      )}
    >
      <span className="mb-4 inline-flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon aria-hidden className="size-5" />
      </span>
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-pretty text-muted-foreground">
        {description}
      </p>
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}
