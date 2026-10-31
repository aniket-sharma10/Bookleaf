import { Leaf } from "lucide-react";

import { cn } from "@/lib/utils";

/** The BookLeaf mark: a leaf on a rounded tile. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground",
        className,
      )}
    >
      <Leaf className="size-[55%]" strokeWidth={2.25} />
    </span>
  );
}
