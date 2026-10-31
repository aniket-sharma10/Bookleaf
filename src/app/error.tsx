"use client";

import { RotateCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

// Shown when a page fails unexpectedly. Server errors arrive with a generic
// message (Next.js hides details); `digest` matches the server log entry.
export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest =
    error instanceof Error
      ? (error as Error & { digest?: string }).digest
      : undefined;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <BrandMark className="mb-6 size-10" />
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        This page couldn&apos;t load. Please try again; if it keeps happening,
        come back in a few minutes.
      </p>
      {digest ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Reference: {digest}
        </p>
      ) : null}
      <div className="mt-6 flex gap-3">
        <Button type="button" onClick={() => retry()}>
          <RotateCw aria-hidden />
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Go to BookLeaf</Link>
        </Button>
      </div>
    </main>
  );
}
