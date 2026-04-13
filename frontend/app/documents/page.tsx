"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../stores/authStore";
import { useDashboardStore } from "../stores/dashboardStore";
import { useDashboardTranslations, useOrgStats } from "../hooks/queries";
import { queryKeys, translationJobsApi } from "../services/api";
import { AppShell } from "../components/AppShell";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge, toJobStatus } from "../components/StatusBadge";
import { NewTranslationModal } from "../dashboard/NewTranslationModal";

function formatRelativeDate(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

// Due date badge — color-coded by urgency
function DueDateBadge({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return <span className="rounded-full bg-status-errorBg px-2.5 py-0.5 text-[0.6875rem] font-medium text-status-error">Overdue</span>;
  }
  if (diffDays <= 3) {
    return <span className="rounded-full bg-status-warningBg px-2.5 py-0.5 text-[0.6875rem] font-medium text-status-warning">Due soon</span>;
  }
  return (
    <span className="rounded-full bg-brand-bg px-2.5 py-0.5 text-[0.6875rem] font-medium text-brand-muted">
      {due.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
    </span>
  );
}

// Inline due date editor — clicking the badge/cell opens a date picker
function InlineDueDateCell({ jobId, dueDate }: { jobId: number; dueDate: string | null }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);

  async function handleChange(value: string) {
    setEditing(false);
    const newDate = value || null;
    try {
      await translationJobsApi.updateDueDate(jobId, newDate);
      void queryClient.invalidateQueries({ queryKey: queryKeys.translationJobs.recent() });
    } catch (err) {
      console.error("[due-date update]", err);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        defaultValue={dueDate ?? ""}
        autoFocus
        onBlur={(e) => handleChange(e.target.value)}
        onChange={(e) => handleChange(e.target.value)}
        className="w-28 rounded-lg border border-brand-border bg-brand-surface px-2 py-1 text-xs text-brand-text outline-none focus:border-brand-accent"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="cursor-pointer border-none bg-transparent p-0"
      title="Click to set due date"
    >
      {dueDate ? (
        <DueDateBadge dueDate={dueDate} />
      ) : (
        <span className="text-xs text-brand-subtle hover:text-brand-muted">Set date</span>
      )}
    </button>
  );
}


export default function DocumentsPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const openTranslationModal = useDashboardStore((s) => s.openTranslationModal);
  const { data: translations, isLoading } = useDashboardTranslations();
  const { data: orgStats } = useOrgStats();

  useEffect(() => {
    if (hasHydrated && !token) router.replace("/login");
  }, [hasHydrated, token, router]);

  if (!hasHydrated || !token) return null;

  const jobs = translations ?? [];
  const totalDocs = jobs.length;
  const inReviewCount = jobs.filter((t) => t.raw_status === "in_review" || t.raw_status === "review").length;
  const completedCount = jobs.filter((t) => t.raw_status === "exported" || t.raw_status === "completed" || t.raw_status === "ready_for_export" || t.raw_status === "review_complete").length;

  return (
    <AppShell>
      <div className="px-8 py-8">
        <PageHeader eyebrow="Workspace" title="Documents" />

        {/* Stat tiles */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
            <p className="text-xs font-medium text-brand-muted">Total Documents</p>
            <p className="mt-1 font-display text-2xl font-bold text-brand-text">{totalDocs}</p>
            <p className="mt-0.5 text-[0.6875rem] text-brand-subtle">
              {totalDocs === 0 ? "No documents yet" : `${totalDocs} ${totalDocs === 1 ? "document" : "documents"}`}
            </p>
          </div>
          <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
            <p className="text-xs font-medium text-brand-muted">In Review</p>
            <p className={`mt-1 font-display text-2xl font-bold ${inReviewCount > 0 ? "text-brand-accent" : "text-brand-subtle"}`}>{inReviewCount}</p>
            <p className="mt-0.5 text-[0.6875rem] text-brand-subtle">Awaiting approval</p>
          </div>
          <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
            <p className="text-xs font-medium text-brand-muted">Completed</p>
            <p className={`mt-1 font-display text-2xl font-bold ${completedCount > 0 ? "text-status-success" : "text-brand-subtle"}`}>{completedCount}</p>
            <p className="mt-0.5 text-[0.6875rem] text-brand-subtle">Ready to export</p>
          </div>
        </div>

        {/* Summary line */}
        <p className="mb-4 text-sm text-brand-muted">
          {totalDocs} {totalDocs === 1 ? "document" : "documents"} · {(orgStats?.total_words_translated ?? 0).toLocaleString()} words translated · {orgStats?.distinct_languages ?? 0} {(orgStats?.distinct_languages ?? 0) === 1 ? "language" : "languages"}
        </p>

        {isLoading && <p className="text-sm text-brand-muted">Loading…</p>}

        {/* Table — headers always visible */}
        {!isLoading && (
          <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-brand-border">
                  {["Document", "Project", "Language", "Due Date", "Uploaded", "Status"].map((col) => (
                    <th key={col} className="px-5 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-brand-subtle">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <div className="mx-auto max-w-sm">
                        <div className="mb-3 text-4xl">📄</div>
                        <p className="font-display text-lg font-bold text-brand-text">No documents yet</p>
                        <p className="mt-1 text-sm text-brand-muted">
                          Upload a document to translate it. Supports DOCX, RTF, and TXT files.
                        </p>
                        <button
                          type="button"
                          onClick={() => openTranslationModal()}
                          className="mt-4 rounded-full bg-brand-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-accentHov transition-colors"
                        >
                          + New Translation
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  jobs.map((t) => (
                    <tr key={t.id} className="border-b border-brand-border last:border-0 transition-colors hover:bg-brand-bg">
                      <td className="px-5 py-3.5">
                        <Link href={`/translation-jobs/${t.id}/overview`} className="text-sm font-medium text-brand-text no-underline hover:underline">
                          {t.document_name ?? `Document #${t.id}`}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-brand-muted">
                        {t.project_name ?? <span className="italic text-brand-subtle">No project</span>}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-brand-muted">
                        {t.source_language} → {t.target_language}
                      </td>
                      <td className="px-5 py-3.5">
                        <InlineDueDateCell jobId={t.id} dueDate={t.due_date} />
                      </td>
                      <td className="px-5 py-3.5 text-xs text-brand-subtle">
                        {t.created_at ? formatRelativeDate(t.created_at) : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={toJobStatus(t.raw_status)} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <NewTranslationModal projects={[]} />
    </AppShell>
  );
}
