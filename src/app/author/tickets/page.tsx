import type { Metadata } from "next";

import { PageHeading } from "@/components/page-heading";
import {
  RaiseQueryButton,
  TicketList,
} from "@/features/author-tickets/ticket-list";

export const metadata: Metadata = { title: "My tickets" };

export default function MyTicketsPage() {
  return (
    <>
      <PageHeading
        eyebrow="Support"
        title="My tickets"
        description="Queries you've raised with BookLeaf support, most recent activity first."
        actions={<RaiseQueryButton />}
      />
      <TicketList />
    </>
  );
}
