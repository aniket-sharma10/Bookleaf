import { Inbox } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";

export const metadata: Metadata = { title: "Ticket queue" };

// Access is checked by the admin layout (and the proxy). This page loads no
// data itself; the queue will come from the admin API.
export default function AdminQueuePage() {
  return (
    <>
      <PageHeading
        eyebrow="Support desk"
        title="Ticket queue"
        description="Author queries, most urgent first."
      />
      <EmptyState
        icon={Inbox}
        title="No tickets in the queue"
        description="New author queries will appear here as they arrive."
      />
    </>
  );
}
