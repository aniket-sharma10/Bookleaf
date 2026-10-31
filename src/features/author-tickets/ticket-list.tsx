"use client";

import { ChevronRight, MessageSquareText, Plus } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";

import { EmptyState } from "@/components/empty-state";
import { ErrorState, RefreshFailedNotice } from "@/components/error-state";
import { TicketStatusBadge } from "@/components/ticket-status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher } from "@/lib/api-client";
import { POLL_MS } from "@/lib/polling";
import type { AuthorTicket } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { GENERAL_BOOK_LABEL } from "@/lib/labels";

export function RaiseQueryButton() {
  return (
    <Button asChild size="lg">
      <Link href="/author/tickets/new">
        <Plus aria-hidden />
        Raise a query
      </Link>
    </Button>
  );
}

function ListSkeleton() {
  return (
    <div
      aria-busy
      aria-label="Loading your tickets"
      className="divide-y rounded-xl bg-card ring-1 ring-foreground/10"
    >
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center gap-4 px-5 py-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** The author's tickets, newest activity first (TICKET-06). */
export function TicketList() {
  const { data, error, isLoading, mutate } = useSWR<AuthorTicket[]>(
    "/api/author/tickets",
    fetcher,
    { refreshInterval: POLL_MS.authorTickets },
  );

  if (error && !data) {
    return <ErrorState error={error} onRetry={() => mutate()} />;
  }
  if (isLoading || !data) return <ListSkeleton />;

  if (data.length === 0) {
    return (
      <EmptyState
        icon={MessageSquareText}
        title="No queries yet"
        description="When you raise a query about a book or your account, you can follow its progress and read our replies here."
      >
        <RaiseQueryButton />
      </EmptyState>
    );
  }

  return (
    <>
      {error ? <RefreshFailedNotice /> : null}
      <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {data.map((ticket) => (
          <li key={ticket.id}>
            <Link
              href={`/author/tickets/${ticket.id}`}
              className="group flex items-center gap-4 px-5 py-4 transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{ticket.subject}</p>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {ticket.book?.title ?? GENERAL_BOOK_LABEL}
                  <span aria-hidden> · </span>
                  <span className="whitespace-nowrap">
                    Updated {formatDateTime(ticket.updatedAt)}
                  </span>
                </p>
              </div>
              <TicketStatusBadge status={ticket.status} />
              <ChevronRight
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
