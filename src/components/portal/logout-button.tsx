"use client";

import { LoaderCircle, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function logOut() {
    setPending(true);
    setFailed(false);
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch (error) {
      // 401 means the session had already ended, so the user is signed out
      // anyway. Anything else left the cookie in place: say so and stay.
      if (!(error instanceof ApiClientError && error.status === 401)) {
        setPending(false);
        setFailed(true);
        return;
      }
    }
    router.replace("/login");
    // Drop cached portal pages so Back can't show them after sign-out.
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {failed ? (
        <span role="status" className="text-xs">
          Couldn&apos;t sign out. Try again.
        </span>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={logOut}
        disabled={pending}
        className={cn(className)}
      >
        {pending ? (
          <LoaderCircle aria-hidden className="animate-spin" />
        ) : (
          <LogOut aria-hidden />
        )}
        {pending ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}
