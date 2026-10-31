import {
  CircleAlert,
  ClipboardCheck,
  Handshake,
  LoaderCircle,
  RotateCw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { AiDraft } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";

// What the admin needs to review an AI draft (DRAFT-02, DRAFT-05). The
// lists are information, not a gate: the admin decides what to send.

function Checklist({
  icon,
  title,
  hint,
  items,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  items: string[];
  tone?: "neutral" | "warning";
}) {
  if (items.length === 0) return null;
  return (
    <div
      className={
        tone === "warning"
          ? "rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950"
          : "rounded-lg border bg-card p-3"
      }
    >
      <p className="flex items-center gap-1.5 text-sm font-medium">
        {icon}
        {title}
      </p>
      <p className="mt-0.5 text-xs opacity-80">{hint}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {items.map((item, index) => (
          <li key={`${index}-${item}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function DraftPanel({
  draft,
  drafting,
  error,
  onRegenerate,
}: {
  draft: AiDraft | null;
  drafting: boolean;
  error: string | null;
  onRegenerate: () => void;
}) {
  if (drafting) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 rounded-lg border border-dashed bg-card/60 px-4 py-3 text-sm text-muted-foreground"
      >
        <LoaderCircle aria-hidden className="size-4 animate-spin" />
        Drafting a reply with AI… You can start writing meanwhile; your text
        won&apos;t be replaced.
      </div>
    );
  }

  if (error) {
    return (
      <Alert>
        <CircleAlert aria-hidden />
        <AlertTitle>AI draft unavailable — write a reply manually</AlertTitle>
        <AlertDescription>
          <p>{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            className="mt-2 text-foreground"
          >
            <RotateCw aria-hidden />
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!draft) return null;

  const nothingFlagged =
    draft.commitments.length === 0 &&
    draft.needsVerification.length === 0 &&
    draft.warnings.length === 0;

  return (
    <div className="space-y-3 rounded-xl border border-primary/20 bg-accent/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Sparkles aria-hidden className="size-4 text-primary" />
          AI draft in the editor below — review and edit before sending
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRegenerate}
        >
          <RotateCw aria-hidden />
          Regenerate
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Drafted {formatDateTime(draft.createdAt)}
        {draft.stale ? " · written before the latest message" : ""}
      </p>

      <Checklist
        icon={<TriangleAlert aria-hidden className="size-4" />}
        title="Warnings"
        hint="Automatic checks found something the facts don't support."
        items={draft.warnings}
        tone="warning"
      />
      <Checklist
        icon={<Handshake aria-hidden className="size-4" />}
        title="This reply promises"
        hint="Only send if BookLeaf will really do these."
        items={draft.commitments}
      />
      <Checklist
        icon={<ClipboardCheck aria-hidden className="size-4" />}
        title="Check before sending"
        hint="The AI couldn't verify these from the data."
        items={draft.needsVerification}
      />
      {nothingFlagged ? (
        <p className="text-sm text-muted-foreground">
          No promises, checks or warnings flagged for this draft.
        </p>
      ) : null}
    </div>
  );
}
