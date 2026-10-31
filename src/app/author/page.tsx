import { Library } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
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
      />
      <EmptyState
        icon={Library}
        title="Your account at a glance"
        description="Your books, royalty totals and support queries will appear here."
      />
    </>
  );
}
