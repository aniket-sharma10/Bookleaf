import { isInProduction, productionStage } from "@/lib/books";
import { cn } from "@/lib/utils";

/** "Published & Live" in green; in-production books in amber with the stage. */
export function BookStatusBadge({ status }: { status: string }) {
  const inProduction = isInProduction(status);
  const stage = productionStage(status);
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
        inProduction
          ? "bg-amber-100 text-amber-900 ring-amber-200"
          : "bg-emerald-100 text-emerald-900 ring-emerald-200",
      )}
      title={status}
    >
      <span className="truncate">
        {inProduction ? `In production${stage ? ` · ${stage}` : ""}` : status}
      </span>
    </span>
  );
}
