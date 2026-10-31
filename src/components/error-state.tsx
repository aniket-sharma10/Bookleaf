"use client";

import { CircleAlert, RotateCw } from "lucide-react";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api-client";

/** A failed load, with a way forward: retry, or sign in again on 401. */
export function ErrorState({
  error,
  onRetry,
  title = "We couldn't load this",
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  if (error instanceof ApiClientError && error.status === 401) {
    return (
      <Alert>
        <CircleAlert aria-hidden />
        <AlertTitle>Your session has ended</AlertTitle>
        <AlertDescription>
          <p>
            For your security, sessions end after a while.{" "}
            <Link href="/login">Sign in again</Link> to continue.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  const message =
    error instanceof ApiClientError
      ? error.message
      : "Something went wrong. Please try again.";
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        {onRetry ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-3 text-foreground"
          >
            <RotateCw aria-hidden />
            Try again
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Shown when a background refresh fails but earlier data is still on screen:
 * keep the page (and anything being typed) and let SWR retry by itself.
 */
export function RefreshFailedNotice() {
  return (
    <p
      role="status"
      className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
    >
      Couldn&apos;t refresh just now, so this may be out of date. Retrying
      automatically.
    </p>
  );
}
