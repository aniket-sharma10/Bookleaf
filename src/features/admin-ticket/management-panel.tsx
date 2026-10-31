"use client";

import { LoaderCircle, Sparkles, UserCheck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@/generated/prisma/enums";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import type { AdminTicketDetail } from "@/lib/api-types";
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from "@/lib/labels";
import type { UpdateTicketInput } from "@/lib/schemas/tickets";

import { PanelCard } from "./context-panel";

type Field = keyof UpdateTicketInput;

function errorMessage(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : "Couldn't save. Please try again.";
}

/** "AI suggested X" under an override control (AI-03, AI-04). */
function AiHint({
  suggestion,
  current,
  pending,
}: {
  suggestion: string | null;
  current: string | null;
  pending: boolean;
}) {
  if (!suggestion) {
    return (
      <p className="text-xs text-muted-foreground">
        {pending ? "No AI suggestion yet." : "No AI suggestion."}
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1 text-xs text-muted-foreground">
      <Sparkles aria-hidden className="size-3" />
      AI suggested {suggestion}
      {current && current !== suggestion ? " (overridden)" : ""}
    </p>
  );
}

type SelectField = "status" | "category" | "priority";

function Control({
  field,
  label,
  value,
  options,
  hint,
  saving,
  error,
  onChange,
}: {
  field: SelectField;
  label: string;
  value: string | null;
  options: [string, string][];
  hint?: React.ReactNode;
  saving: Field | null;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = `manage-${field}`;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {saving === field ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <LoaderCircle aria-hidden className="size-3 animate-spin" />
            Saving…
          </span>
        ) : null}
      </div>
      <NativeSelect
        id={id}
        value={value ?? ""}
        disabled={saving !== null}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="w-full [&_select]:h-9"
      >
        {value === null ? (
          <NativeSelectOption value="" disabled>
            Not set
          </NativeSelectOption>
        ) : null}
        {options.map(([optionValue, optionLabel]) => (
          <NativeSelectOption key={optionValue} value={optionValue}>
            {optionLabel}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {hint}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Status, category and priority controls plus "Assign to me". Each change is
 * saved straight away with PATCH; the response replaces the cached ticket.
 */
export function ManagementPanel({
  ticket,
  adminId,
  onSaved,
}: {
  ticket: AdminTicketDetail;
  adminId: string;
  onSaved: (ticket: AdminTicketDetail) => void;
}) {
  const [saving, setSaving] = useState<Field | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  async function save(field: Field, changes: UpdateTicketInput) {
    setSaving(field);
    setErrors((current) => ({ ...current, [field]: undefined }));
    try {
      onSaved(
        await apiRequest<AdminTicketDetail>(`/api/admin/tickets/${ticket.id}`, {
          method: "PATCH",
          body: changes,
        }),
      );
    } catch (error) {
      setErrors((current) => ({ ...current, [field]: errorMessage(error) }));
    } finally {
      setSaving(null);
    }
  }

  const aiPending = ticket.classificationStatus === "PENDING";
  const assignedToMe = ticket.assignee?.id === adminId;

  return (
    <PanelCard title="Manage">
      <div className="grid gap-4">
        <Control
          field="status"
          saving={saving}
          error={errors.status}
          onChange={(value) =>
            save("status", { status: value } as UpdateTicketInput)
          }
          label="Status"
          value={ticket.status}
          options={Object.values(TicketStatus).map((s) => [
            s,
            STATUS_LABELS[s],
          ])}
        />
        <Control
          field="category"
          saving={saving}
          error={errors.category}
          onChange={(value) =>
            save("category", { category: value } as UpdateTicketInput)
          }
          label="Category"
          value={ticket.category}
          options={Object.values(TicketCategory).map((c) => [
            c,
            CATEGORY_LABELS[c],
          ])}
          hint={
            <AiHint
              suggestion={
                ticket.aiCategory && CATEGORY_LABELS[ticket.aiCategory]
              }
              current={ticket.category && CATEGORY_LABELS[ticket.category]}
              pending={aiPending}
            />
          }
        />
        <Control
          field="priority"
          saving={saving}
          error={errors.priority}
          onChange={(value) =>
            save("priority", { priority: value } as UpdateTicketInput)
          }
          label="Priority"
          value={ticket.priority}
          options={Object.values(TicketPriority).map((p) => [
            p,
            PRIORITY_LABELS[p],
          ])}
          hint={
            <AiHint
              suggestion={
                ticket.aiPriority && PRIORITY_LABELS[ticket.aiPriority]
              }
              current={ticket.priority && PRIORITY_LABELS[ticket.priority]}
              pending={aiPending}
            />
          }
        />
        {ticket.aiRationale ? (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">AI reasoning: </span>
            {ticket.aiRationale}
          </p>
        ) : null}

        <div className="grid gap-1.5 border-t pt-4">
          <span className="text-sm font-medium">Assignee</span>
          <p className="text-sm">
            {ticket.assignee ? (
              assignedToMe ? (
                <span className="font-medium">You</span>
              ) : (
                ticket.assignee.name
              )
            ) : (
              <span className="text-muted-foreground">Unassigned</span>
            )}
          </p>
          {assignedToMe ? null : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving !== null}
              onClick={() => save("assignToMe", { assignToMe: true })}
              className="justify-self-start"
            >
              {saving === "assignToMe" ? (
                <LoaderCircle aria-hidden className="animate-spin" />
              ) : (
                <UserCheck aria-hidden />
              )}
              Assign to me
            </Button>
          )}
          {errors.assignToMe ? (
            <p role="alert" className="text-xs text-destructive">
              {errors.assignToMe}
            </p>
          ) : null}
        </div>
      </div>
    </PanelCard>
  );
}
