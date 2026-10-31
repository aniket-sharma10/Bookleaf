"use client";

import { ArrowLeft, Clock, FileQuestion } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";

import { BrandMark } from "@/components/brand-mark";
import { EmptyState } from "@/components/empty-state";
import { ErrorState, RefreshFailedNotice } from "@/components/error-state";
import { TicketStatusBadge } from "@/components/ticket-status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiClientError, fetcher } from "@/lib/api-client";
import { POLL_MS } from "@/lib/polling";
import type { AuthorTicketDetail, AuthorTicketMessage } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { GENERAL_BOOK_LABEL } from "@/lib/labels";

function BackLink() {
  return (
    <Link
      href="/author/tickets"
      className="mb-6 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <ArrowLeft aria-hidden className="size-4" />
      All tickets
    </Link>
  );
}

function DetailSkeleton() {
  return (
    <div aria-busy aria-label="Loading the ticket" className="space-y-6">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

function Reply({ message }: { message: AuthorTicketMessage }) {
  const fromSupport = message.sender.role === "ADMIN";
  return (
    <li className="flex gap-3">
      {fromSupport ? (
        <BrandMark className="mt-0.5" />
      ) : (
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-semibold">
          You
        </span>
      )}
      <div className="min-w-0 flex-1 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-medium">
            {fromSupport ? "BookLeaf Support" : "You"}
          </span>
          {fromSupport ? (
            <span className="text-muted-foreground">{message.sender.name}</span>
          ) : null}
          <span className="text-xs text-muted-foreground sm:ml-auto">
            {formatDateTime(message.createdAt)}
          </span>
        </p>
        <p className="mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap">
          {message.body}
        </p>
      </div>
    </li>
  );
}

/** One ticket: the original query and the reply thread (TICKET-07). */
export function TicketDetail({ ticketId }: { ticketId: string }) {
  const { data, error, isLoading, mutate } = useSWR<AuthorTicketDetail>(
    `/api/author/tickets/${encodeURIComponent(ticketId)}`,
    fetcher,
    { refreshInterval: POLL_MS.authorTickets },
  );

  if (!data && error instanceof ApiClientError && error.status === 404) {
    return (
      <>
        <BackLink />
        <EmptyState
          icon={FileQuestion}
          title="We couldn't find that ticket"
          description="It may have been mistyped, or it belongs to a different account."
        >
          <Button asChild variant="outline">
            <Link href="/author/tickets">Back to my tickets</Link>
          </Button>
        </EmptyState>
      </>
    );
  }
  if (error && !data) {
    return (
      <>
        <BackLink />
        <ErrorState error={error} onRetry={() => mutate()} />
      </>
    );
  }
  if (isLoading || !data) {
    return (
      <>
        <BackLink />
        <DetailSkeleton />
      </>
    );
  }

  return (
    <>
      <BackLink />
      {error ? <RefreshFailedNotice /> : null}
      <header className="mb-8">
        <div className="flex flex-wrap items-start gap-3">
          <h1 className="flex-1 font-heading text-3xl font-semibold tracking-tight text-balance">
            {data.subject}
          </h1>
          <TicketStatusBadge status={data.status} className="mt-1.5" />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {data.book?.title ?? GENERAL_BOOK_LABEL}
          <span aria-hidden> · </span>
          Raised {formatDateTime(data.createdAt)}
        </p>
      </header>

      <section aria-labelledby="query-heading" className="mb-10">
        <h2
          id="query-heading"
          className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
        >
          Your query
        </h2>
        <div className="rounded-xl bg-card px-5 py-4 text-sm leading-relaxed break-words whitespace-pre-wrap ring-1 ring-foreground/10">
          {data.description}
        </div>
      </section>

      <section aria-labelledby="replies-heading">
        <h2
          id="replies-heading"
          className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
        >
          Replies
        </h2>
        {data.messages.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-dashed bg-card/60 px-5 py-4 text-sm text-muted-foreground">
            <Clock aria-hidden className="mt-0.5 size-4 shrink-0" />
            <p>
              No replies yet. Our support team will reply here, and you&apos;ll
              see their response on this page.
            </p>
          </div>
        ) : (
          <ol className="space-y-4">
            {data.messages.map((message) => (
              <Reply key={message.id} message={message} />
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
