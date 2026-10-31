import type {
  ClassificationStatus,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@/generated/prisma/enums";

// Response shapes of the app's own API, shared by the services that build
// them and the UI that reads them. Dates are strings: calendar dates as
// `YYYY-MM-DD`, timestamps as ISO 8601.

/** GET /api/author/books: one book, every field except the owner ID. */
export type AuthorBook = {
  id: string;
  title: string;
  isbn: string;
  genre: string;
  /** Null while the book is in production. */
  publicationDate: string | null;
  /** Free text, verbatim from the dataset (e.g. "In Production - Typesetting"). */
  status: string;
  mrp: number | null;
  authorRoyaltyPerCopy: number | null;
  totalCopiesSold: number;
  totalRoyaltyEarned: number;
  royaltyPaid: number;
  royaltyPending: number;
  /** Null when nothing has been paid out yet. */
  lastRoyaltyPayoutDate: string | null;
  printPartner: string | null;
  availableOn: string[];
};

export type AuthorBookTotals = {
  bookCount: number;
  totalCopiesSold: number;
  totalRoyaltyEarned: number;
  royaltyPaid: number;
  royaltyPending: number;
};

export type AuthorBooksResponse = {
  books: AuthorBook[];
  totals: AuthorBookTotals;
  payout: {
    /** Minimum payout (KB): smaller pending amounts roll over a quarter. */
    thresholdInr: number;
    /** Some royalty is pending, but less than the threshold (BOOK-07). */
    belowThreshold: boolean;
  };
};

/**
 * A ticket as its author sees it. Never includes priority, category, AI
 * fields, assignee, internal notes or drafts (TICKET-08).
 */
export type AuthorTicket = {
  id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  /** Null for "General / Account Level". */
  book: { id: string; title: string } | null;
  createdAt: string;
  updatedAt: string;
};

/** A reply on the author's ticket thread (only author-visible messages). */
export type AuthorTicketMessage = {
  id: string;
  body: string;
  sender: { name: string; role: "AUTHOR" | "ADMIN" };
  createdAt: string;
};

/** GET /api/author/tickets/:id: the ticket and its reply thread, oldest first. */
export type AuthorTicketDetail = AuthorTicket & {
  messages: AuthorTicketMessage[];
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/** GET /api/admin/tickets: one row of the support queue (QUEUE-01). */
export type QueueTicket = {
  id: string;
  subject: string;
  status: TicketStatus;
  /** Effective values; null until AI or an admin sets them ("Needs triage"). */
  category: TicketCategory | null;
  priority: TicketPriority | null;
  classificationStatus: ClassificationStatus;
  author: { id: string; name: string };
  book: { id: string; title: string } | null;
  assignee: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

/** List envelope: `{ data, page, pageSize, total }` (architecture §4). */
export type Page<T> = {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
};

/** A message on the thread, as admins see it. */
export type AdminTicketMessage = {
  id: string;
  body: string;
  sender: { id: string; name: string; role: "AUTHOR" | "ADMIN" };
  /** The AI draft this reply started from, if any. */
  aiDraftId: string | null;
  createdAt: string;
};

/** An internal note: visible to the BookLeaf team only (MGMT-02). */
export type InternalNote = {
  id: string;
  body: string;
  createdBy: { id: string; name: string };
  createdAt: string;
};

/** GET /api/admin/tickets/:id: everything an admin needs on one ticket. */
export type AdminTicketDetail = {
  id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  category: TicketCategory | null;
  priority: TicketPriority | null;
  /** The AI's original suggestion, kept even after an admin override. */
  aiCategory: TicketCategory | null;
  aiPriority: TicketPriority | null;
  aiRationale: string | null;
  classificationStatus: ClassificationStatus;
  classifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; email: string; city: string };
  book: AuthorBook | null;
  assignee: { id: string; name: string } | null;
  messages: AdminTicketMessage[];
  notes: InternalNote[];
  /** The current AI draft; always null until AI drafting exists. */
  latestDraft: null;
};
