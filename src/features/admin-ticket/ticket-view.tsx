"use client";

import { ArrowLeft, FileQuestion } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";

import { BrandMark } from "@/components/brand-mark";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import {
  AgeBadge,
  NeedsTriageBadge,
  PriorityBadge,
} from "@/components/ticket-badges";
import { TicketStatusBadge } from "@/components/ticket-status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import { ApiClientError, fetcher } from "@/lib/api-client";
import type { AdminTicketDetail, AdminTicketMessage } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { CATEGORY_LABELS, GENERAL_BOOK_LABEL } from "@/lib/labels";

import { AuthorCard, BookCard } from "./context-panel";
import { ManagementPanel } from "./management-panel";

function BackLink() {
  return (
    <Link
      href="/admin"
      className="mb-6 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Ticket queue
    </Link>
  );
}

function SectionHeading({ id, children }: { id: string; children: string }) {
  return (
    <h2
      id={id}
      className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
    >
      {children}
    </h2>
  );
}

function Message({ message }: { message: AdminTicketMessage }) {
  const fromSupport = message.sender.role === "ADMIN";
  return (
    <li className="flex gap-3">
      {fromSupport ? (
        <BrandMark className="mt-0.5" />
      ) : (
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-semibold">
          {message.sender.name.slice(0, 1)}
        </span>
      )}
      <div className="min-w-0 flex-1 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-medium">{message.sender.name}</span>
          <span className="text-muted-foreground">
            {fromSupport ? "BookLeaf Support" : "Author"}
          </span>
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

/** One ticket for support staff: query, thread, context and controls. */
export function AdminTicketView({
  ticketId,
  adminId,
}: {
  ticketId: string;
  adminId: string;
}) {
  const now = useMinuteClock();
  const { data, error, isLoading, mutate } = useSWR<AdminTicketDetail>(
    `/api/admin/tickets/${encodeURIComponent(ticketId)}`,
    fetcher,
  );

  if (error instanceof ApiClientError && error.status === 404) {
    return (
      <>
        <BackLink />
        <EmptyState
          icon={FileQuestion}
          title="We couldn't find that ticket"
          description="Check the link, or go back to the queue."
        />
      </>
    );
  }
  if (error) {
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
        <div aria-busy aria-label="Loading the ticket" className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </>
    );
  }

  return (
    <>
      <BackLink />
      <header className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <TicketStatusBadge status={data.status} />
          {data.priority ? (
            <PriorityBadge priority={data.priority} />
          ) : (
            <NeedsTriageBadge />
          )}
          <AgeBadge createdAt={data.createdAt} now={now} />
        </div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance">
          {data.subject}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {data.author.name}
          <span aria-hidden> · </span>
          {data.book?.title ?? GENERAL_BOOK_LABEL}
          <span aria-hidden> · </span>
          {data.category ? CATEGORY_LABELS[data.category] : "Category not set"}
          <span aria-hidden> · </span>
          Raised {formatDateTime(data.createdAt)}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="query-heading">
            <SectionHeading id="query-heading">
              Author&apos;s query
            </SectionHeading>
            <div className="rounded-xl bg-card px-5 py-4 text-sm leading-relaxed break-words whitespace-pre-wrap ring-1 ring-foreground/10">
              {data.description}
            </div>
          </section>

          <section aria-labelledby="thread-heading">
            <SectionHeading id="thread-heading">Conversation</SectionHeading>
            {data.messages.length === 0 ? (
              <p className="rounded-xl border border-dashed bg-card/60 px-5 py-4 text-sm text-muted-foreground">
                No replies yet. The author is waiting for a first response.
              </p>
            ) : (
              <ol className="space-y-4">
                {data.messages.map((message) => (
                  <Message key={message.id} message={message} />
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="space-y-4" aria-label="Ticket details">
          <ManagementPanel
            ticket={data}
            adminId={adminId}
            onSaved={(ticket) => mutate(ticket, { revalidate: false })}
          />
          <AuthorCard author={data.author} />
          <BookCard book={data.book} />
        </aside>
      </div>
    </>
  );
}
