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
