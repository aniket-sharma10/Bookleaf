import type { Metadata } from "next";

import { TicketDetail } from "@/features/author-tickets/ticket-detail";

export const metadata: Metadata = { title: "Ticket" };

export default async function TicketPage({
  params,
}: PageProps<"/author/tickets/[id]">) {
  const { id } = await params;
  return <TicketDetail ticketId={id} />;
}
