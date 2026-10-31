import type { Metadata } from "next";

import { PageHeading } from "@/components/page-heading";
import { AuthorDashboard } from "@/features/author-dashboard/dashboard";
import { RaiseQueryButton } from "@/features/author-tickets/ticket-list";
import { requirePortalUser } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AuthorDashboardPage() {
  const user = await requirePortalUser("AUTHOR");
  return (
    <>
      <PageHeading
        eyebrow="Dashboard"
        title={`Welcome, ${user.name}`}
        description="Your books, royalties and support queries with BookLeaf."
        actions={<RaiseQueryButton />}
      />
      <AuthorDashboard />
    </>
  );
}
