import type { TicketStatus } from "@/generated/prisma/enums";
import { STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

// One colour per status, used everywhere a ticket status is shown.
const STATUS_STYLES: Record<TicketStatus, string> = {
  OPEN: "bg-amber-100 text-amber-900 ring-amber-200",
  IN_PROGRESS: "bg-sky-100 text-sky-900 ring-sky-200",
  RESOLVED: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  CLOSED: "bg-muted text-muted-foreground ring-border",
};

export function TicketStatusBadge({
  status,
  className,
}: {
  status: TicketStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        STATUS_STYLES[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
