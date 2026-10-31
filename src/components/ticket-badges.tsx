import { CircleDashed } from "lucide-react";

import type { TicketPriority } from "@/generated/prisma/enums";
import { formatAge, formatDateTime } from "@/lib/format";
import { PRIORITY_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

const PILL =
  "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset";

// Urgency reads hot to cold: Critical red, High orange, Medium blue, Low grey.
const PRIORITY_STYLES: Record<TicketPriority, string> = {
  CRITICAL: "bg-red-100 text-red-900 ring-red-200",
  HIGH: "bg-orange-100 text-orange-900 ring-orange-200",
  MEDIUM: "bg-sky-100 text-sky-900 ring-sky-200",
  LOW: "bg-muted text-muted-foreground ring-border",
};

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <span className={cn(PILL, PRIORITY_STYLES[priority])}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

/** No category or priority yet: an admin should triage it (QUEUE-04). */
export function NeedsTriageBadge() {
  return (
    <span className={cn(PILL, "bg-violet-100 text-violet-900 ring-violet-200")}>
      <CircleDashed aria-hidden className="size-3" />
      Needs triage
    </span>
  );
}

/**
 * How long a ticket has existed; warmer colours the longer it waits.
 * `now` comes from the caller (useMinuteClock), so rendering stays pure.
 */
export function AgeBadge({
  createdAt,
  now,
}: {
  createdAt: string;
  now: number;
}) {
  const hours = (now - Date.parse(createdAt)) / 3_600_000;
  const tone =
    hours >= 7 * 24
      ? "bg-red-50 text-red-800 ring-red-200"
      : hours >= 2 * 24
        ? "bg-amber-50 text-amber-900 ring-amber-200"
        : "bg-card text-muted-foreground ring-border";
  return (
    <span
      className={cn(PILL, "tabular-nums", tone)}
      title={`Raised ${formatDateTime(createdAt)}`}
    >
      <span className="sr-only">Age </span>
      {formatAge(createdAt, now)}
    </span>
  );
}
