"use client";

import { Lock, NotebookPen } from "lucide-react";

import { apiRequest } from "@/lib/api-client";
import type { AdminTicketDetail, InternalNote } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";

import { TextForm } from "./text-form";

/**
 * Team-only notes (MGMT-02). Styled apart from the author conversation, so
 * nobody mistakes a note for a reply.
 */
export function InternalNotes({
  ticket,
  onAdded,
}: {
  ticket: AdminTicketDetail;
  onAdded: () => Promise<unknown>;
}) {
  async function add(body: string) {
    await apiRequest<InternalNote>(`/api/admin/tickets/${ticket.id}/notes`, {
      method: "POST",
      body: { body },
    });
    await onAdded();
  }

  return (
    <section
      aria-labelledby="notes-heading"
      className="rounded-xl border border-amber-200 bg-amber-50/70 p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2
          id="notes-heading"
          className="text-xs font-semibold tracking-wider text-amber-900 uppercase"
        >
          Internal notes
        </h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200 ring-inset">
          <Lock aria-hidden className="size-3" />
          Only visible to BookLeaf team
        </span>
      </div>

      {ticket.notes.length === 0 ? (
        <p className="mb-4 text-sm text-amber-900/80">
          No notes yet. Use notes for context the author shouldn&apos;t see.
        </p>
      ) : (
        <ol className="mb-4 space-y-3">
          {ticket.notes.map((note) => (
            <li
              key={note.id}
              className="rounded-lg bg-card/80 px-3 py-2 text-sm ring-1 ring-amber-200"
            >
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{note.createdBy.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(note.createdAt)}
                </span>
              </p>
              <p className="mt-1 break-words whitespace-pre-wrap">
                {note.body}
              </p>
            </li>
          ))}
        </ol>
      )}

      <TextForm
        id="note-body"
        label="Add a note"
        placeholder="e.g. Checked the payout file: bank details missing."
        submitLabel="Add note"
        pendingLabel="Saving…"
        icon={<NotebookPen aria-hidden />}
        onSubmit={add}
      />
    </section>
  );
}
