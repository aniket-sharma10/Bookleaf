"use client";

import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import useSWRMutation from "swr/mutation";

import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { TicketStatus } from "@/generated/prisma/enums";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import type { AdminTicketDetail, AiDraft, SentReply } from "@/lib/api-types";
import { STATUS_LABELS } from "@/lib/labels";

import { DraftPanel } from "./draft-panel";
import { TextForm } from "./text-form";

/** A usable draft: one that exists and predates no newer message. */
function freshDraft(ticket: AdminTicketDetail): AiDraft | null {
  return ticket.latestDraft && !ticket.latestDraft.stale
    ? ticket.latestDraft
    : null;
}

/**
 * Reply to the author (MGMT-04), with an AI draft to start from (DRAFT-01).
 * Opening a ticket without a usable draft requests one, once. The draft only
 * fills an empty editor, so it never overwrites what the admin has typed,
 * and nothing is sent without the admin pressing Send (DRAFT-02).
 */
export function ReplyComposer({
  ticket,
  onSent,
}: {
  ticket: AdminTicketDetail;
  onSent: () => Promise<unknown>;
}) {
  const [statusAfter, setStatusAfter] = useState(""); // "" = automatic (MGMT-05)
  const initial = freshDraft(ticket);
  const [body, setBody] = useState(initial?.body ?? "");
  // The draft the editor text started from; sent as aiDraftId (DRAFT-03).
  const [draft, setDraft] = useState<AiDraft | null>(initial);
  const [draftError, setDraftError] = useState<string | null>(null);

  const { trigger, isMutating: drafting } = useSWRMutation(
    `/api/admin/tickets/${ticket.id}/drafts`,
    (url: string) => apiRequest<AiDraft>(url, { method: "POST" }),
  );

  async function requestDraft(replaceText: boolean) {
    setDraftError(null);
    try {
      const fresh = await trigger();
      if (!fresh) return;
      setDraft(fresh);
      // Fill the editor only if it's empty, or the admin chose to replace it.
      setBody((current) =>
        replaceText || current.trim() === "" ? fresh.body : current,
      );
      await onSent(); // refresh the ticket so latestDraft is current
    } catch (error) {
      setDraftError(
        error instanceof ApiClientError
          ? error.message
          : "The AI service is unavailable. Try again later, or continue manually.",
      );
    }
  }

  // Ask for a draft once per opened ticket when there's no usable one.
  const requested = useRef(false);
  useEffect(() => {
    if (requested.current || freshDraft(ticket)) return;
    requested.current = true;
    void requestDraft(false);
    // Runs once per mounted composer (it is keyed by ticket ID).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function regenerate() {
    const edited = draft !== null && body.trim() !== "" && body !== draft.body;
    if (
      edited &&
      !window.confirm("Replace the text in the editor with a new AI draft?")
    ) {
      return;
    }
    void requestDraft(true);
  }

  function changeBody(value: string) {
    setBody(value);
    // Clearing the editor drops the link to the draft.
    if (value.trim() === "") setDraft(null);
  }

  async function send(text: string) {
    await apiRequest<SentReply>(`/api/admin/tickets/${ticket.id}/messages`, {
      method: "POST",
      body: {
        body: text,
        ...(draft ? { aiDraftId: draft.id } : {}),
        ...(statusAfter ? { status: statusAfter } : {}),
      },
    });
    setStatusAfter("");
    setDraft(null);
    await onSent();
  }

  const automatic =
    ticket.status === "OPEN"
      ? "Automatic (Open → In Progress)"
      : `Keep as ${STATUS_LABELS[ticket.status]}`;

  return (
    <section aria-labelledby="reply-heading" className="space-y-3">
      <h2
        id="reply-heading"
        className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
      >
        Reply to the author
      </h2>
      <DraftPanel
        draft={draft}
        drafting={drafting}
        error={draftError}
        onRegenerate={regenerate}
      />
      <TextForm
        id="reply-body"
        label="Your reply"
        placeholder="Write a reply. The author will see it on their ticket page."
        submitLabel="Send reply"
        pendingLabel="Sending…"
        icon={<Send aria-hidden />}
        onSubmit={send}
        value={body}
        onValueChange={changeBody}
        rows={12}
        extra={
          <div className="flex items-center gap-2">
            <Label
              htmlFor="reply-status"
              className="text-sm font-normal text-muted-foreground"
            >
              Status after sending
            </Label>
            <NativeSelect
              id="reply-status"
              size="sm"
              value={statusAfter}
              onChange={(event) => setStatusAfter(event.target.value)}
            >
              <NativeSelectOption value="">{automatic}</NativeSelectOption>
              {Object.values(TicketStatus).map((status) => (
                <NativeSelectOption key={status} value={status}>
                  {STATUS_LABELS[status]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        }
      />
    </section>
  );
}
