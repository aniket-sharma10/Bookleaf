import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeading } from "@/components/page-heading";
import { AdminQueue } from "@/features/admin-queue/queue";
import { requirePortalUser } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Ticket queue" };

export default async function AdminQueuePage() {
  const admin = await requirePortalUser("ADMIN");
  return (
    <>
      <PageHeading
        eyebrow="Support desk"
        title="Ticket queue"
        description="Unresolved author queries: tickets that need triage first, then the most urgent and longest waiting."
      />
      {/* The queue reads its filters from the URL (useSearchParams). */}
      <Suspense>
        <AdminQueue adminId={admin.id} />
      </Suspense>
    </>
  );
}
