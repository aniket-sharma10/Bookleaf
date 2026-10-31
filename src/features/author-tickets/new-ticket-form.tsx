"use client";

import { CircleAlert, LoaderCircle, Paperclip, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import { ErrorState } from "@/components/error-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  ApiClientError,
  apiRequest,
  fetcher,
  type FieldIssue,
} from "@/lib/api-client";
import type { AuthorBooksResponse, AuthorTicket } from "@/lib/api-types";
import { GENERAL_BOOK_LABEL } from "@/lib/labels";
import { createTicketSchema, LIMITS } from "@/lib/schemas/tickets";
import { cn } from "@/lib/utils";

type Field = "bookId" | "subject" | "description";
type FieldErrors = Partial<Record<Field, string>>;

const FIELDS: Field[] = ["bookId", "subject", "description"];
const GENERAL = "general"; // select value for "General / Account Level"

function toFieldErrors(issues: FieldIssue[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const { path, message } of issues) {
    const field = FIELDS.find((name) => name === path);
    if (field && !errors[field]) errors[field] = message;
  }
  return errors;
}

function isInProduction(status: string): boolean {
  return status.toLowerCase().startsWith("in production");
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  ) : null;
}

function CharacterCount({ value, max }: { value: string; max: number }) {
  const length = value.trim().length;
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        length > max ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {length.toLocaleString("en-IN")} / {max.toLocaleString("en-IN")}
    </span>
  );
}

/** Raise a support query (TICKET-01, TICKET-02, TICKET-04). */
export function NewTicketForm() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const formRef = useRef<HTMLFormElement>(null);
  const books = useSWR<AuthorBooksResponse>("/api/author/books", fetcher);

  const [book, setBook] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  function showFieldErrors(errors: FieldErrors) {
    setFieldErrors(errors);
    const first = FIELDS.find((field) => errors[field]);
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    // Check every field at once, so all problems show together.
    const parsed = createTicketSchema.safeParse({
      bookId: book === "" || book === GENERAL ? null : book,
      subject,
      description,
    });
    const errors = parsed.success
      ? {}
      : toFieldErrors(
          parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        );
    // Nothing chosen yet: "General" must be picked deliberately.
    if (book === "") errors.bookId = `Choose a book, or ${GENERAL_BOOK_LABEL}.`;
    if (!parsed.success || book === "") {
      showFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setPending(true);
    try {
      const ticket = await apiRequest<AuthorTicket>("/api/author/tickets", {
        method: "POST",
        body: parsed.data,
      });
      // The list page should show the new ticket straight away.
      void mutate("/api/author/tickets");
      router.push(`/author/tickets/${ticket.id}`);
    } catch (error) {
      setPending(false);
      if (error instanceof ApiClientError && error.details?.length) {
        showFieldErrors(toFieldErrors(error.details));
      } else {
        setFormError(
          error instanceof ApiClientError
            ? error.message
            : "Something went wrong. Please try again.",
        );
      }
    }
  }

  if (books.error) {
    return (
      <ErrorState
        error={books.error}
        title="We couldn't load your books"
        onRetry={() => books.mutate()}
      />
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      aria-busy={pending}
      className="grid max-w-2xl gap-6"
    >
      {formError ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>We couldn&apos;t submit your query</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="bookId">What is this about?</Label>
        {books.data ? (
          <NativeSelect
            id="bookId"
            name="bookId"
            value={book}
            onChange={(event) => setBook(event.target.value)}
            disabled={pending}
            aria-invalid={fieldErrors.bookId ? true : undefined}
            aria-describedby={fieldErrors.bookId ? "bookId-error" : undefined}
            className="w-full [&_select]:h-10"
          >
            <NativeSelectOption value="" disabled>
              Choose a book…
            </NativeSelectOption>
            {books.data.books.map((option) => (
              <NativeSelectOption key={option.id} value={option.id}>
                {option.title}
                {isInProduction(option.status) ? " (in production)" : ""}
              </NativeSelectOption>
            ))}
            <NativeSelectOption value={GENERAL}>
              {GENERAL_BOOK_LABEL}
            </NativeSelectOption>
          </NativeSelect>
        ) : (
          <Skeleton className="h-10 w-full" aria-label="Loading your books" />
        )}
        <FieldError id="bookId-error" message={fieldErrors.bookId} />
      </div>

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <Label htmlFor="subject">Subject</Label>
          <CharacterCount value={subject} max={LIMITS.subject.max} />
        </div>
        <Input
          id="subject"
          name="subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="e.g. Royalty for last quarter not received"
          disabled={pending}
          aria-invalid={fieldErrors.subject ? true : undefined}
          aria-describedby={fieldErrors.subject ? "subject-error" : undefined}
          className="h-10"
        />
        <FieldError id="subject-error" message={fieldErrors.subject} />
      </div>

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <Label htmlFor="description">Details</Label>
          <CharacterCount value={description} max={LIMITS.description.max} />
        </div>
        <Textarea
          id="description"
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={8}
          placeholder="Tell us what happened. Dates, platforms or order numbers help us answer faster."
          disabled={pending}
          aria-invalid={fieldErrors.description ? true : undefined}
          aria-describedby={
            fieldErrors.description ? "description-error" : undefined
          }
          className="min-h-40"
        />
        <FieldError id="description-error" message={fieldErrors.description} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="attachments">
          Attachments{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <label
          htmlFor="attachments"
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-lg border border-dashed bg-card/60 px-4 py-3 text-sm transition-colors hover:bg-muted/60 has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
            pending && "pointer-events-none opacity-50",
          )}
        >
          <Paperclip aria-hidden className="size-4 text-muted-foreground" />
          <span>
            {files.length
              ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
              : "Choose files, such as photos of a printed copy"}
          </span>
          <input
            id="attachments"
            type="file"
            multiple
            className="sr-only"
            aria-describedby="attachments-note"
            onChange={(event) =>
              setFiles(Array.from(event.target.files ?? [], (f) => f.name))
            }
          />
        </label>
        {files.length ? (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {files.map((name, index) => (
              <li key={`${index}-${name}`} className="truncate">
                {name}
              </li>
            ))}
          </ul>
        ) : null}
        <p id="attachments-note" className="text-xs text-muted-foreground">
          Attachments aren&apos;t uploaded in this version. If our team needs
          photos or documents, they&apos;ll ask in their reply.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending || !books.data}>
          {pending ? (
            <LoaderCircle aria-hidden className="animate-spin" />
          ) : (
            <Send aria-hidden />
          )}
          {pending ? "Submitting…" : "Submit query"}
        </Button>
        <Button asChild variant="ghost" size="lg">
          <Link href="/author/tickets">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
