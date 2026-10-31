"use client";

import { ChevronLeft, ChevronRight, Inbox, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";

import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import {
  AgeBadge,
  NeedsTriageBadge,
  PriorityBadge,
} from "@/components/ticket-badges";
import { TicketStatusBadge } from "@/components/ticket-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@/generated/prisma/enums";
import { pageFetcher } from "@/lib/api-client";
import type { Page, QueueTicket } from "@/lib/api-types";
import {
  CATEGORY_LABELS,
  GENERAL_BOOK_LABEL,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

// Filters live in the URL (bookmarkable, shareable, Back works) and the same
// parameters go straight to GET /api/admin/tickets.

const ALL_STATUSES = Object.values(TicketStatus);

/** The status select's value for the current URL. */
function statusChoice(params: URLSearchParams): string {
  const statuses = params.getAll("status");
  if (statuses.length === 0) return "";
  if (statuses.length === ALL_STATUSES.length) return "ALL";
  return statuses.length === 1 ? statuses[0]! : "";
}

function needsTriage(ticket: QueueTicket): boolean {
  return ticket.category === null || ticket.priority === null;
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <NativeSelect
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full"
      >
        {children}
      </NativeSelect>
    </div>
  );
}

function ToggleFilter({
  pressed,
  onToggle,
  children,
}: {
  pressed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={pressed ? "default" : "outline"}
      size="sm"
      aria-pressed={pressed}
      onClick={onToggle}
    >
      {children}
    </Button>
  );
}

function Assignee({
  assignee,
  adminId,
}: {
  assignee: QueueTicket["assignee"];
  adminId: string;
}) {
  if (!assignee)
    return <span className="text-muted-foreground">Unassigned</span>;
  return assignee.id === adminId ? (
    <span className="font-medium">You</span>
  ) : (
    <span>{assignee.name}</span>
  );
}

function QueueSkeleton() {
  return (
    <div aria-busy aria-label="Loading the queue" className="space-y-2">
      {[0, 1, 2, 3, 4].map((row) => (
        <Skeleton key={row} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}

/** The support queue (QUEUE-01 to QUEUE-05). */
export function AdminQueue({ adminId }: { adminId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const search = params.toString();
  const { data, error, isLoading, mutate } = useSWR<Page<QueueTicket>>(
    `/api/admin/tickets${search ? `?${search}` : ""}`,
    pageFetcher<QueueTicket>,
    // Keep showing the current rows while a new filter loads.
    { keepPreviousData: true },
  );

  /** Changes some filters; any filter change goes back to page 1. */
  function update(changes: Record<string, string | string[] | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      next.delete(key);
      for (const item of [value ?? []].flat()) if (item) next.append(key, item);
    }
    if (!("page" in changes)) next.delete("page");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  const status = statusChoice(params);
  const assignedToMe = params.get("assignee") === "me";
  const triageOnly = params.get("unclassified") === "true";
  const filtered = search !== "" && search.replace(/(^|&)page=\d+/, "") !== "";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <FilterSelect
            id="filter-status"
            label="Status"
            value={status}
            onChange={(value) =>
              update({
                status: value === "ALL" ? ALL_STATUSES : value ? [value] : null,
              })
            }
          >
            <NativeSelectOption value="">Unresolved</NativeSelectOption>
            {ALL_STATUSES.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {STATUS_LABELS[value]}
              </NativeSelectOption>
            ))}
            <NativeSelectOption value="ALL">All statuses</NativeSelectOption>
          </FilterSelect>
          <FilterSelect
            id="filter-category"
            label="Category"
            value={params.get("category") ?? ""}
            onChange={(value) => update({ category: value || null })}
          >
            <NativeSelectOption value="">All categories</NativeSelectOption>
            {Object.values(TicketCategory).map((value) => (
              <NativeSelectOption key={value} value={value}>
                {CATEGORY_LABELS[value]}
              </NativeSelectOption>
            ))}
          </FilterSelect>
          <FilterSelect
            id="filter-priority"
            label="Priority"
            value={params.get("priority") ?? ""}
            onChange={(value) => update({ priority: value || null })}
          >
            <NativeSelectOption value="">All priorities</NativeSelectOption>
            {Object.values(TicketPriority).map((value) => (
              <NativeSelectOption key={value} value={value}>
                {PRIORITY_LABELS[value]}
              </NativeSelectOption>
            ))}
          </FilterSelect>
          <div className="grid gap-1.5">
            <Label
              htmlFor="filter-from"
              className="text-xs text-muted-foreground"
            >
              Raised from
            </Label>
            <Input
              id="filter-from"
              type="date"
              value={params.get("from") ?? ""}
              max={params.get("to") ?? undefined}
              onChange={(event) => update({ from: event.target.value || null })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label
              htmlFor="filter-to"
              className="text-xs text-muted-foreground"
            >
              Raised to
            </Label>
            <Input
              id="filter-to"
              type="date"
              value={params.get("to") ?? ""}
              min={params.get("from") ?? undefined}
              onChange={(event) => update({ to: event.target.value || null })}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleFilter
            pressed={assignedToMe}
            onToggle={() => update({ assignee: assignedToMe ? null : "me" })}
          >
            Assigned to me
          </ToggleFilter>
          <ToggleFilter
            pressed={triageOnly}
            onToggle={() =>
              update({ unclassified: triageOnly ? null : "true" })
            }
          >
            Needs triage
          </ToggleFilter>
          {filtered ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => router.replace(pathname, { scroll: false })}
            >
              <X aria-hidden />
              Clear filters
            </Button>
          ) : null}
          {data ? (
            <p
              className="ml-auto text-sm text-muted-foreground"
              aria-live="polite"
            >
              {data.total} {data.total === 1 ? "ticket" : "tickets"}
            </p>
          ) : null}
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : isLoading || !data ? (
        <QueueSkeleton />
      ) : data.data.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={
            filtered
              ? "No tickets match these filters"
              : "No tickets in the queue"
          }
          description={
            filtered
              ? "Try removing a filter, or widen the date range."
              : "New author queries will appear here as they arrive."
          }
        />
      ) : (
        <>
          <QueueTable tickets={data.data} adminId={adminId} />
          <Pagination
            page={data}
            onPage={(page) => update({ page: String(page) })}
          />
        </>
      )}
    </div>
  );
}

function QueueTable({
  tickets,
  adminId,
}: {
  tickets: QueueTicket[];
  adminId: string;
}) {
  const now = useMinuteClock();
  return (
    <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <li
        aria-hidden
        className="hidden grid-cols-[7rem_minmax(0,1fr)_12rem_7rem_8rem_4rem] gap-4 bg-muted/50 px-4 py-2.5 text-xs font-medium text-muted-foreground lg:grid"
      >
        <span>Priority</span>
        <span>Ticket</span>
        <span>Category</span>
        <span>Status</span>
        <span>Assignee</span>
        <span className="text-right">Age</span>
      </li>
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <Link
            href={`/admin/tickets/${ticket.id}`}
            className="grid gap-2 px-4 py-3 text-sm transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset lg:grid-cols-[7rem_minmax(0,1fr)_12rem_7rem_8rem_4rem] lg:items-center lg:gap-4"
          >
            <span className="flex flex-wrap items-center gap-2 lg:block">
              {ticket.priority ? (
                <PriorityBadge priority={ticket.priority} />
              ) : (
                <NeedsTriageBadge />
              )}
              <span className="flex items-center gap-2 lg:hidden">
                <TicketStatusBadge status={ticket.status} />
                <AgeBadge createdAt={ticket.createdAt} now={now} />
              </span>
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {ticket.subject}
              </span>
              <span className="block truncate text-muted-foreground">
                {ticket.author.name}
                <span aria-hidden> · </span>
                {ticket.book?.title ?? GENERAL_BOOK_LABEL}
              </span>
            </span>
            <span
              className={cn(
                "truncate",
                ticket.category ? "" : "text-muted-foreground",
              )}
              title={
                ticket.category ? CATEGORY_LABELS[ticket.category] : undefined
              }
            >
              <span className="text-muted-foreground lg:hidden">
                Category:{" "}
              </span>
              {ticket.category
                ? CATEGORY_LABELS[ticket.category]
                : needsTriage(ticket)
                  ? "Not set"
                  : "—"}
            </span>
            <span className="hidden lg:block">
              <TicketStatusBadge status={ticket.status} />
            </span>
            <span className="truncate">
              <span className="text-muted-foreground lg:hidden">
                Assignee:{" "}
              </span>
              <Assignee assignee={ticket.assignee} adminId={adminId} />
            </span>
            <span className="hidden text-right lg:block">
              <AgeBadge createdAt={ticket.createdAt} now={now} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Pagination({
  page,
  onPage,
}: {
  page: Page<QueueTicket>;
  onPage: (page: number) => void;
}) {
  const first = (page.page - 1) * page.pageSize + 1;
  const last = Math.min(page.page * page.pageSize, page.total);
  const pages = Math.max(1, Math.ceil(page.total / page.pageSize));
  if (pages === 1) return null;
  return (
    <nav
      aria-label="Queue pages"
      className="flex items-center justify-between gap-4 text-sm"
    >
      <p className="text-muted-foreground">
        {first}–{last} of {page.total}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page.page <= 1}
          onClick={() => onPage(page.page - 1)}
        >
          <ChevronLeft aria-hidden />
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page.page >= pages}
          onClick={() => onPage(page.page + 1)}
        >
          Next
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
