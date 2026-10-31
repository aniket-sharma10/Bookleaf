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
import { shouldAutoDraft, usableDraft } from "@/lib/drafts";
import { STATUS_LABELS } from "@/lib/labels";

import { DraftPanel } from "./draft-panel";
import { TextForm } from "./text-form";

/**
 * Reply to the author (MGMT-04), with an AI draft to start from (DRAFT-01).
 * The first open of an unanswered ticket requests a draft by itself, once;
 * after that the admin asks for one. A draft never replaces text the admin
 * has typed without asking, and nothing is sent without the admin pressing
 * Send (DRAFT-02).
 */
export function ReplyComposer({
  ticket,
  onSent,
}: {
  ticket: AdminTicketDetail;
  onSent: () => Promise<unknown>;
}) {
  const [statusAfter, setStatusAfter] = useState(""); // "" = automatic (MGMT-05)
  const initial = usableDraft(ticket);
  const [body, setBody] = useState(initial?.body ?? "");
  // The draft the editor text started from; sent as aiDraftId (DRAFT-03).
  const [draft, setDraft] = useState<AiDraft | null>(initial);
  const [draftError, setDraftError] = useState<string | null>(null);

  const { trigger, isMutating: drafting } = useSWRMutation(
    `/api/admin/tickets/${ticket.id}/drafts`,
    (url: string) => apiRequest<AiDraft>(url, { method: "POST" }),
  );

  /**
   * Requests a new draft. It goes into the editor if the editor is empty or
   * still holds `replaceable` (the text the admin agreed to replace), so
   * anything typed while the draft is generated is kept.
   */
  async function requestDraft(replaceable: string) {
    setDraftError(null);
    try {
      const fresh = await trigger();
      if (!fresh) return;
      setDraft(fresh);
      setBody((current) =>
        current.trim() === "" || current === replaceable ? fresh.body : current,
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

  // The automatic draft for a first response. `autoDrafting` is set from the
  // first render, so the panel shows "Drafting…" at once rather than the
  // Draft with AI button.
  const [autoDrafting, setAutoDrafting] = useState(() =>
    shouldAutoDraft(ticket),
  );
  const requested = useRef(false);
  useEffect(() => {
    if (!autoDrafting || requested.current) return;
    requested.current = true;
    void requestDraft("").finally(() => setAutoDrafting(false));
    // Runs once per mounted composer (it is keyed by ticket ID).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Draft with AI, Regenerate and Try again: asks before replacing the admin's own text. */
  function requestNewDraft() {
    const ownText = body.trim() !== "" && body !== draft?.body;
    if (
      ownText &&
      !window.confirm("Replace the text in the editor with a new AI draft?")
    ) {
      return;
    }
    void requestDraft(body);
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
        drafting={drafting || autoDrafting}
        error={draftError}
        onRequestDraft={requestNewDraft}
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
