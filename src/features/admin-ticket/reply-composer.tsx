"use client";

import { Send } from "lucide-react";
import { useState } from "react";

import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { TicketStatus } from "@/generated/prisma/enums";
import { apiRequest } from "@/lib/api-client";
import type { AdminTicketDetail, SentReply } from "@/lib/api-types";
import { STATUS_LABELS } from "@/lib/labels";

import { TextForm } from "./text-form";

/** Manual reply to the author (MGMT-04), with an optional new status. */
export function ReplyComposer({
  ticket,
  onSent,
}: {
  ticket: AdminTicketDetail;
  onSent: () => Promise<unknown>;
}) {
  // "" = automatic: an Open ticket moves to In Progress (MGMT-05).
  const [statusAfter, setStatusAfter] = useState("");
  const automatic =
    ticket.status === "OPEN"
      ? "Automatic (Open → In Progress)"
      : `Keep as ${STATUS_LABELS[ticket.status]}`;

  async function send(body: string) {
    await apiRequest<SentReply>(`/api/admin/tickets/${ticket.id}/messages`, {
      method: "POST",
      body: statusAfter ? { body, status: statusAfter } : { body },
    });
    setStatusAfter("");
    await onSent();
  }

  return (
    <section aria-labelledby="reply-heading">
      <h2
        id="reply-heading"
        className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
      >
        Reply to the author
      </h2>
      <TextForm
        id="reply-body"
        label="Your reply"
        placeholder="Write a reply. The author will see it on their ticket page."
        submitLabel="Send reply"
        pendingLabel="Sending…"
        icon={<Send aria-hidden />}
        onSubmit={send}
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
