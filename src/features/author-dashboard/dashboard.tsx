"use client";

import { ArrowRight, Info } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";

import { ErrorState } from "@/components/error-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher } from "@/lib/api-client";
import type { AuthorBooksResponse, AuthorTicket } from "@/lib/api-types";
import { isInProduction } from "@/lib/books";
import { formatCount, formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";

import { BooksSection } from "./books-section";

function StatCard({
  label,
  value,
  detail,
  emphasis = false,
}: {
  label: string;
  value: string;
  detail?: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl p-4 ring-1",
        emphasis
          ? "bg-primary text-primary-foreground ring-primary"
          : "bg-card ring-foreground/10",
      )}
    >
      <p
        className={cn(
          "text-xs font-medium",
          emphasis ? "text-primary-foreground/80" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p className="mt-1 font-heading text-2xl font-semibold tabular-nums">
        {value}
      </p>
      {detail ? (
        <div
          className={cn(
            "mt-1 text-xs",
            emphasis ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy aria-label="Loading your account" className="space-y-10">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((card) => (
          <Skeleton key={card} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}

/** Account summary and books (BOOK-01 to BOOK-07). */
export function AuthorDashboard() {
  const books = useSWR<AuthorBooksResponse>("/api/author/books", fetcher);
  const tickets = useSWR<AuthorTicket[]>("/api/author/tickets", fetcher);

  if (books.error) {
    return (
      <ErrorState
        error={books.error}
        title="We couldn't load your books"
        onRetry={() => books.mutate()}
      />
    );
  }
  if (!books.data) return <DashboardSkeleton />;

  const { totals, payout } = books.data;
  const inProduction = books.data.books.filter((book) =>
    isInProduction(book.status),
  ).length;
  const openQueries = tickets.data?.filter(
    (ticket) => ticket.status === "OPEN" || ticket.status === "IN_PROGRESS",
  ).length;

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard
            label="Books"
            value={formatCount(totals.bookCount)}
            detail={
              inProduction
                ? `${formatCount(totals.bookCount - inProduction)} published · ${formatCount(inProduction)} in production`
                : `${formatCount(totals.totalCopiesSold)} copies sold`
            }
          />
          <StatCard
            label="Royalty earned"
            value={formatInr(totals.totalRoyaltyEarned)}
            detail="All time"
          />
          <StatCard
            label="Royalty paid"
            value={formatInr(totals.royaltyPaid)}
            detail="Paid out to you"
          />
          <StatCard
            label="Royalty pending"
            value={formatInr(totals.royaltyPending)}
            detail="Not yet paid out"
            emphasis
          />
          <StatCard
            label="Open queries"
            value={
              openQueries === undefined
                ? tickets.error
                  ? "—"
                  : "…"
                : formatCount(openQueries)
            }
            detail={
              <Link
                href="/author/tickets"
                className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
              >
                View my tickets
                <ArrowRight aria-hidden className="size-3" />
              </Link>
            }
          />
        </div>

        {payout.belowThreshold ? (
          <Alert>
            <Info aria-hidden />
            <AlertTitle>
              Your pending royalty is below the {formatInr(payout.thresholdInr)}{" "}
              minimum payout
            </AlertTitle>
            <AlertDescription>
              Royalties are paid once at least {formatInr(payout.thresholdInr)}{" "}
              has built up. Your {formatInr(totals.royaltyPending)} will roll
              over to the next quarter&apos;s payout.
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <BooksSection books={books.data.books} totals={totals} />
    </div>
  );
}
