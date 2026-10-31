"use client";

import { LoaderCircle } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError } from "@/lib/api-client";
import { LIMITS } from "@/lib/schemas/tickets";
import { cn } from "@/lib/utils";

/**
 * A textarea + submit button shared by the reply composer and the internal
 * notes panel. `onSubmit` performs the request; the text is cleared only
 * after it succeeds, so nothing typed is lost on an error.
 */
export function TextForm({
  id,
  label,
  placeholder,
  submitLabel,
  pendingLabel,
  icon,
  extra,
  onSubmit,
  className,
}: {
  id: string;
  label: string;
  placeholder: string;
  submitLabel: string;
  pendingLabel: string;
  icon: React.ReactNode;
  /** Extra controls shown next to the button (e.g. status after sending). */
  extra?: React.ReactNode;
  onSubmit: (body: string) => Promise<void>;
  className?: string;
}) {
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const length = body.trim().length;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (length === 0) {
      setError("Write something first.");
      return;
    }
    if (length > LIMITS.body.max) {
      setError(
        `Keep this under ${LIMITS.body.max.toLocaleString("en-IN")} characters.`,
      );
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSubmit(body);
      setBody("");
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? (caught.details?.[0]?.message ?? caught.message)
          : "Something went wrong. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className={cn("grid gap-2", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <Label htmlFor={id}>{label}</Label>
        <span
          className={cn(
            "text-xs tabular-nums",
            length > LIMITS.body.max
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {length.toLocaleString("en-IN")} /{" "}
          {LIMITS.body.max.toLocaleString("en-IN")}
        </span>
      </div>
      <Textarea
        id={id}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={placeholder}
        rows={5}
        disabled={pending}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="min-h-28 bg-card"
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {extra}
        <Button type="submit" disabled={pending}>
          {pending ? (
            <LoaderCircle aria-hidden className="animate-spin" />
          ) : (
            icon
          )}
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
