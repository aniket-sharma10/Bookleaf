import type { Metadata } from "next";

import { PageHeading } from "@/components/page-heading";
import { NewTicketForm } from "@/features/author-tickets/new-ticket-form";

export const metadata: Metadata = { title: "Raise a query" };

export default function NewTicketPage() {
  return (
    <>
      <PageHeading
        eyebrow="Support"
        title="Raise a query"
        description="Tell us about a book or your account. Our support team will reply on the ticket page."
      />
      <NewTicketForm />
    </>
  );
}
