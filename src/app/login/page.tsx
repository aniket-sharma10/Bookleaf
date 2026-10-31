import { Clock } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BrandMark } from "@/components/brand-mark";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoginForm } from "@/features/auth/login-form";
import { getUserFromCookies, portalPath } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // Already signed in: go straight to the right portal.
  const user = await getUserFromCookies();
  if (user) redirect(portalPath(user.role));
  // Set by the API client when a request found the session had ended.
  const expired = (await searchParams).expired === "1";

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <BrandMark className="size-10 bg-primary-foreground text-primary" />
          <span className="font-heading text-2xl font-semibold tracking-tight">
            BookLeaf Publishing
          </span>
        </div>

        <div className="relative max-w-md">
          <p className="font-heading text-4xl leading-tight font-medium text-balance">
            Support for every stage of your book&apos;s journey.
          </p>
          <p className="mt-5 text-base text-primary-foreground/80">
            See your books and royalties, raise a query, and hear back from our
            support team, all in one place.
          </p>
        </div>

        <p className="text-sm text-primary-foreground/70">
          Author Support Portal
        </p>

        {/* Decorative rings, echoing the leaf mark. */}
        <svg
          aria-hidden
          viewBox="0 0 400 400"
          className="pointer-events-none absolute -right-28 -bottom-28 size-[26rem] text-primary-foreground/10"
        >
          <circle
            cx="200"
            cy="200"
            r="198"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle
            cx="200"
            cy="200"
            r="140"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle
            cx="200"
            cy="200"
            r="82"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <BrandMark />
            <span className="font-heading text-xl font-semibold tracking-tight">
              BookLeaf
            </span>
          </div>

          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Sign in
          </h1>
          <p className="mt-2 mb-8 text-sm text-muted-foreground">
            Authors and the BookLeaf support team sign in here with their email
            and password.
          </p>

          {expired ? (
            <Alert className="mb-6">
              <Clock aria-hidden />
              <AlertTitle>Your session has ended</AlertTitle>
              <AlertDescription>
                For your security, sessions end after a while. Please sign in
                again.
              </AlertDescription>
            </Alert>
          ) : null}
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
