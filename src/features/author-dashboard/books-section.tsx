import { BookOpen } from "lucide-react";

import { BookStatusBadge } from "@/components/book-status-badge";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuthorBook, AuthorBookTotals } from "@/lib/api-types";
import { formatCount, formatDate, formatInr } from "@/lib/format";

// Every field of the author's books (BOOK-01) with the edge cases spelled out
// (BOOK-02/03/04): no publication date yet, no payout yet, zero amounts.
const NOT_PUBLISHED = "Not yet published";
const NO_PAYOUT = "No payout yet";

function BookCard({ book }: { book: AuthorBook }) {
  const rows: [string, string][] = [
    ["Genre", book.genre],
    ["ISBN", book.isbn],
    ["Published", formatDate(book.publicationDate, NOT_PUBLISHED)],
    ["MRP", formatInr(book.mrp)],
    ["Royalty per copy", formatInr(book.authorRoyaltyPerCopy)],
    ["Copies sold", formatCount(book.totalCopiesSold)],
    ["Royalty earned", formatInr(book.totalRoyaltyEarned)],
    ["Royalty paid", formatInr(book.royaltyPaid)],
    ["Royalty pending", formatInr(book.royaltyPending)],
    ["Last payout", formatDate(book.lastRoyaltyPayoutDate, NO_PAYOUT)],
    ["Print partner", book.printPartner ?? "—"],
    [
      "Available on",
      book.availableOn.length ? book.availableOn.join(", ") : "Not listed yet",
    ],
  ];
  return (
    <li className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="mb-3 flex flex-col items-start gap-2">
        <h3 className="font-heading text-lg leading-snug font-semibold">
          {book.title}
        </h3>
        <BookStatusBadge status={book.status} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="break-words tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

function BooksTable({
  books,
  totals,
}: {
  books: AuthorBook[];
  totals: AuthorBookTotals;
}) {
  return (
    <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Book</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Published</TableHead>
            <TableHead className="text-right">MRP</TableHead>
            <TableHead className="text-right">Copies sold</TableHead>
            <TableHead className="text-right">Earned</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Pending</TableHead>
            <TableHead className="pr-4">Last payout</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {books.map((book) => (
            <TableRow key={book.id} className="align-top">
              <TableCell className="max-w-64 py-3 pl-4 whitespace-normal">
                <p className="font-medium">{book.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {book.genre} ·{" "}
                  <span className="whitespace-nowrap">ISBN {book.isbn}</span>
                </p>
                {book.availableOn.length ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    On {book.availableOn.join(", ")}
                  </p>
                ) : null}
              </TableCell>
              <TableCell className="py-3">
                <BookStatusBadge status={book.status} />
                {book.printPartner ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Print partner: {book.printPartner}
                  </p>
                ) : null}
              </TableCell>
              <TableCell className="py-3">
                {formatDate(book.publicationDate, NOT_PUBLISHED)}
              </TableCell>
              <TableCell className="py-3 text-right tabular-nums">
                {formatInr(book.mrp)}
              </TableCell>
              <TableCell className="py-3 text-right tabular-nums">
                {formatCount(book.totalCopiesSold)}
              </TableCell>
              <TableCell className="py-3 text-right tabular-nums">
                {formatInr(book.totalRoyaltyEarned)}
              </TableCell>
              <TableCell className="py-3 text-right tabular-nums">
                {formatInr(book.royaltyPaid)}
              </TableCell>
              <TableCell className="py-3 text-right font-medium tabular-nums">
                {formatInr(book.royaltyPending)}
              </TableCell>
              <TableCell className="py-3 pr-4">
                {formatDate(book.lastRoyaltyPayoutDate, NO_PAYOUT)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="pl-4 font-medium" colSpan={4}>
              Total ({formatCount(totals.bookCount)}{" "}
              {totals.bookCount === 1 ? "book" : "books"})
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCount(totals.totalCopiesSold)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatInr(totals.totalRoyaltyEarned)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatInr(totals.royaltyPaid)}
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {formatInr(totals.royaltyPending)}
            </TableCell>
            <TableCell className="pr-4" />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

export function BooksSection({
  books,
  totals,
}: {
  books: AuthorBook[];
  totals: AuthorBookTotals;
}) {
  return (
    <section
      id="books"
      aria-labelledby="books-heading"
      className="scroll-mt-20"
    >
      <h2
        id="books-heading"
        className="mb-4 font-heading text-2xl font-semibold tracking-tight"
      >
        My books
      </h2>
      {books.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No books yet"
          description="Your books will appear here once they're set up with BookLeaf."
        />
      ) : (
        <>
          <div className="hidden lg:block">
            <BooksTable books={books} totals={totals} />
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:hidden">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
