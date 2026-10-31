import { CircleAlert, LoaderCircle, RotateCw, Sparkles } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { AiDraft } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";

// What the admin needs to review an AI draft (DRAFT-02, DRAFT-05): the
// promises it makes and the facts to check, as the model listed them. They
// are information, not a gate: the admin decides what to send.

function ReviewList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
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

  return (
    <div className="space-y-3 rounded-lg border border-primary/20 bg-accent/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Sparkles aria-hidden className="size-4 text-primary" />
            AI draft
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Drafted {formatDateTime(draft.createdAt)}. It&apos;s in the editor
            below: review and edit it before sending.
          </p>
        </div>
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
      <ReviewList title="Promises in this reply" items={draft.commitments} />
      <ReviewList
        title="Check before sending"
        items={draft.needsVerification}
      />
    </div>
  );
}
