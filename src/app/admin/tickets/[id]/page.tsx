import type { Metadata } from "next";

import { AdminTicketView } from "@/features/admin-ticket/ticket-view";
import { requirePortalUser } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Ticket" };

export default async function AdminTicketPage({
  params,
}: PageProps<"/admin/tickets/[id]">) {
  const [{ id }, admin] = await Promise.all([
    params,
    requirePortalUser("ADMIN"),
  ]);
  return <AdminTicketView ticketId={id} adminId={admin.id} />;
}
