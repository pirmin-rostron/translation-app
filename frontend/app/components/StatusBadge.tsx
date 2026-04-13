/**
 * StatusBadge — single source of truth for translation job status badges.
 * Used in Documents table and Dashboard table. 6 status variants mapped to design tokens.
 */

type JobStatus = "pending" | "processing" | "in_review" | "completed" | "exported" | "failed";

interface StatusBadgeProps {
  status: JobStatus;
}

const STATUS_STYLES: Record<JobStatus, { bg: string; text: string; label: string }> = {
  pending:    { bg: "bg-brand-bg",         text: "text-brand-muted",    label: "Pending" },
  processing: { bg: "bg-status-infoBg",    text: "text-status-info",    label: "Processing" },
  in_review:  { bg: "bg-brand-accentMid",  text: "text-brand-accent",   label: "In Review" },
  completed:  { bg: "bg-status-successBg", text: "text-status-success", label: "Completed" },
  exported:   { bg: "bg-status-successBg", text: "text-status-success", label: "Exported" },
  failed:     { bg: "bg-status-errorBg",   text: "text-status-error",   label: "Failed" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  const isProcessing = status === "processing";

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.6875rem] font-medium ${styles.bg} ${styles.text} ${isProcessing ? "animate-pulse" : ""}`}
    >
      {isProcessing && (
        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {styles.label}
    </span>
  );
}

const PROCESSING_RAW = new Set(["queued", "parsing", "translating", "translation_queued"]);

/** Maps raw backend status strings to the canonical JobStatus for badge rendering. */
export function toJobStatus(rawStatus: string): JobStatus {
  if (PROCESSING_RAW.has(rawStatus)) return "processing";
  if (rawStatus === "in_review" || rawStatus === "review") return "in_review";
  if (rawStatus === "ready_for_export" || rawStatus === "completed") return "completed";
  if (rawStatus === "exported") return "exported";
  if (rawStatus === "translation_failed") return "failed";
  return "pending";
}

export type { JobStatus };
