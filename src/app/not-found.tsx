import type { Metadata } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

// Shown for any URL that doesn't exist.
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <BrandMark className="mb-6 size-10" />
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Go to BookLeaf</Link>
      </Button>
    </main>
  );
}
