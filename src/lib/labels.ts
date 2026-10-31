import type {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@/generated/prisma/enums";

// Display labels for the database enums (requirements §11). Typed as
// Record<Enum, string>, so adding an enum value fails the build until it has
// a label here.

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  ROYALTY_PAYMENTS: "Royalty & Payments",
  ISBN_METADATA: "ISBN & Metadata Issues",
  PRINTING_QUALITY: "Printing & Quality",
  DISTRIBUTION_AVAILABILITY: "Distribution & Availability",
  BOOK_STATUS_PRODUCTION: "Book Status & Production Updates",
  GENERAL_INQUIRY: "General Inquiry",
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

/** Shown for a ticket that isn't about a specific book (`bookId = null`). */
export const GENERAL_BOOK_LABEL = "General / Account Level";
