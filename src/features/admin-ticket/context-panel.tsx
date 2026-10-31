import { BookStatusBadge } from "@/components/book-status-badge";
import type { AdminTicketDetail } from "@/lib/api-types";
import { formatCount, formatDate, formatInr } from "@/lib/format";
import { GENERAL_BOOK_LABEL } from "@/lib/labels";

// The facts about the author and book that support staff answer from. These
// are the same verified facts the AI draft context will use later.

export function PanelCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
    >
      <h2 className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right break-words tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AuthorCard({
  author,
}: {
  author: AdminTicketDetail["author"];
}) {
  return (
    <PanelCard title="Author">
      <p className="font-medium">{author.name}</p>
      <p className="text-sm">
        <a
          href={`mailto:${author.email}`}
          className="break-all text-primary underline-offset-4 hover:underline"
        >
          {author.email}
        </a>
      </p>
      <p className="text-sm text-muted-foreground">
        {author.city} · ID {author.id}
      </p>
    </PanelCard>
  );
}

export function BookCard({ book }: { book: AdminTicketDetail["book"] }) {
  if (!book) {
    return (
      <PanelCard title="Book">
        <p className="text-sm text-muted-foreground">
          {GENERAL_BOOK_LABEL}: not about a specific book.
        </p>
      </PanelCard>
    );
  }
  return (
    <PanelCard title="Book">
      <p className="font-medium">{book.title}</p>
      <div className="mt-1 mb-3">
        <BookStatusBadge status={book.status} />
      </div>
      <Facts
        rows={[
          ["ISBN", book.isbn],
          ["Published", formatDate(book.publicationDate, "Not yet published")],
          ["MRP", formatInr(book.mrp)],
          ["Copies sold", formatCount(book.totalCopiesSold)],
          ["Royalty earned", formatInr(book.totalRoyaltyEarned)],
          ["Royalty paid", formatInr(book.royaltyPaid)],
          ["Royalty pending", formatInr(book.royaltyPending)],
          [
            "Last payout",
            formatDate(book.lastRoyaltyPayoutDate, "No payout yet"),
          ],
          ["Print partner", book.printPartner ?? "—"],
          [
            "Available on",
            book.availableOn.length ? book.availableOn.join(", ") : "—",
          ],
        ]}
      />
    </PanelCard>
  );
}
