"use client";

/**
 * Documents page — grouped by source document with collapsible translation
 * sub-rows. Each document group shows its filename, metadata, and actions.
 * Translation sub-rows show language, project, due date, status, and actions.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../stores/authStore";
import { useDashboardStore } from "../stores/dashboardStore";
import { useOrgStats, useProjects } from "../hooks/queries";
import { queryKeys, translationJobsApi, documentsApi } from "../services/api";
import type { GroupedDocument, GroupedDocJob, GroupedDocumentsResponse } from "../services/api";
import { AppShell } from "../components/AppShell";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge, toJobStatus } from "../components/StatusBadge";
import { ConfirmDialog } from "../components/ConfirmDialog";
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

// Due date badge
function DueDateBadge({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return <span className="rounded-full bg-status-errorBg px-2.5 py-0.5 text-[0.6875rem] font-medium text-status-error">Overdue</span>;
  if (diffDays <= 3) return <span className="rounded-full bg-status-warningBg px-2.5 py-0.5 text-[0.6875rem] font-medium text-status-warning">Due soon</span>;
  return <span className="rounded-full bg-brand-bg px-2.5 py-0.5 text-[0.6875rem] font-medium text-brand-muted">{due.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>;
}

// Inline due date editor
function InlineDueDateCell({ jobId, dueDate }: { jobId: number; dueDate: string | null }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  async function handleChange(value: string) {
    setEditing(false);
    try {
      await translationJobsApi.updateDueDate(jobId, value || null);
      void queryClient.invalidateQueries({ queryKey: ["documents-grouped"] });
    } catch (err) { console.error("[due-date]", err); }
  }
  if (editing) {
    return <input type="date" defaultValue={dueDate ?? ""} autoFocus onBlur={(e) => handleChange(e.target.value)} onChange={(e) => handleChange(e.target.value)} className="w-28 rounded-lg border border-brand-border bg-brand-surface px-2 py-1 text-xs text-brand-text outline-none focus:border-brand-accent" />;
  }
  return (
    <button type="button" onClick={() => setEditing(true)} className="cursor-pointer border-none bg-transparent p-0" title="Click to set due date">
      {dueDate ? <DueDateBadge dueDate={dueDate} /> : <span className="text-xs text-brand-subtle hover:text-brand-muted">Set date</span>}
    </button>
  );
}

// Toast
function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 2500); return () => clearTimeout(t); }, [onDismiss]);
  return <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-brand-text px-5 py-2.5 text-sm font-medium text-white shadow-lg transition-opacity">{message}</div>;
}

// ── Document group component ────────────────────────────────────────────────

function DocumentGroup({
  doc,
  onToast,
  onRefresh,
}: {
  doc: GroupedDocument;
  onToast: (msg: string) => void;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const openTranslationModal = useDashboardStore((s) => s.openTranslationModal);
  const [expanded, setExpanded] = useState(true);
  const [confirmAction, setConfirmAction] = useState<"delete_doc" | null>(null);
  const [confirmJobAction, setConfirmJobAction] = useState<{ type: "delete_translation" | "retranslate"; jobId: number } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleDeleteDoc() {
    setLoading(true);
    try {
      await documentsApi.delete(doc.id);
      onToast("Document deleted");
      onRefresh();
    } catch (err) { console.error("[delete-doc]", err); }
    finally { setLoading(false); setConfirmAction(null); }
  }

  async function handleJobAction() {
    if (!confirmJobAction) return;
    setLoading(true);
    try {
      if (confirmJobAction.type === "delete_translation") {
        await translationJobsApi.delete(confirmJobAction.jobId);
        onToast("Translation deleted");
      } else {
        await translationJobsApi.retranslate(confirmJobAction.jobId);
        onToast("Re-translation queued");
      }
      onRefresh();
    } catch (err) { console.error("[job-action]", err); }
    finally { setLoading(false); setConfirmJobAction(null); }
  }

  return (
    <>
      {/* Document header row */}
      <tr className="border-b border-brand-border bg-brand-bg">
        <td colSpan={6} className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="flex h-6 w-6 items-center justify-center rounded border-none bg-transparent text-brand-muted transition-transform"
                style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
              >
                ▶
              </button>
              <span className="text-base">📄</span>
              <span className="text-sm font-semibold text-brand-text">{doc.filename}</span>
              <span className="text-xs text-brand-muted">
                Uploaded {doc.uploaded_at ? formatRelativeDate(doc.uploaded_at) : "—"} · {doc.word_count.toLocaleString()} words · {doc.jobs.length} {doc.jobs.length === 1 ? "translation" : "translations"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openTranslationModal()}
                className="rounded-full px-3 py-1 text-xs font-medium text-brand-muted hover:text-brand-text underline"
              >
                + Add language
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction("delete_doc")}
                className="text-xs font-medium text-status-error hover:underline"
              >
                Delete document
              </button>
            </div>
          </div>
        </td>
      </tr>

      {/* Translation sub-rows */}
      {expanded && doc.jobs.map((job) => (
        <tr
          key={job.id}
          className="group/row cursor-pointer border-b border-brand-border transition-colors hover:bg-brand-bg last:border-0"
          onClick={() => router.push(`/translation-jobs/${job.id}/overview`)}
        >
          <td className="py-3 pl-14 pr-4 text-sm font-medium text-brand-text">
            {(job.source_language ?? "EN").substring(0, 2).toUpperCase()} → {job.target_language.substring(0, 2).toUpperCase()}
          </td>
          <td className="px-4 py-3 text-sm text-brand-muted">
            {job.project_name ?? <span className="italic text-brand-subtle">No project</span>}
          </td>
          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
            <InlineDueDateCell jobId={job.id} dueDate={job.due_date} />
          </td>
          <td className="px-4 py-3 text-xs text-brand-subtle">
            {job.created_at ? formatRelativeDate(job.created_at) : "—"}
          </td>
          <td className="px-4 py-3">
            <StatusBadge status={toJobStatus(job.status)} />
          </td>
          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover/row:opacity-100">
              <button
                type="button"
                onClick={() => setConfirmJobAction({ type: "retranslate", jobId: job.id })}
                className="text-xs text-brand-muted hover:text-brand-text"
                title="Re-translate"
              >
                ↻
              </button>
              <button
                type="button"
                onClick={() => setConfirmJobAction({ type: "delete_translation", jobId: job.id })}
                className="text-xs text-brand-subtle hover:text-status-error"
                title="Delete translation"
              >
                ✕
              </button>
            </div>
          </td>
        </tr>
      ))}

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={confirmAction === "delete_doc"}
        title="Delete this document permanently?"
        description="This will remove the uploaded file and all translations. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { void handleDeleteDoc(); }}
        onCancel={() => setConfirmAction(null)}
        loading={loading}
        variant="destructive"
      />
      <ConfirmDialog
        open={confirmJobAction?.type === "retranslate"}
        title="Re-translate this document?"
        description="The existing translation will be replaced. This cannot be undone."
        confirmLabel="Re-translate"
        onConfirm={() => { void handleJobAction(); }}
        onCancel={() => setConfirmJobAction(null)}
        loading={loading}
      />
      <ConfirmDialog
        open={confirmJobAction?.type === "delete_translation"}
        title="Delete this translation?"
        description="The uploaded document will be kept and can be re-translated."
        confirmLabel="Delete translation"
        onConfirm={() => { void handleJobAction(); }}
        onCancel={() => setConfirmJobAction(null)}
        loading={loading}
      />
    </>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const openTranslationModal = useDashboardStore((s) => s.openTranslationModal);
  const { data: orgStats } = useOrgStats();

  const [page, setPage] = useState(1);
  const [data, setData] = useState<GroupedDocumentsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setIsLoading(true);
    documentsApi.listGrouped(page, 10)
      .then(setData)
      .catch((err: unknown) => console.error("[grouped-docs]", err))
      .finally(() => setIsLoading(false));
  }, [page]);

  useEffect(() => {
    if (hasHydrated && !token) { router.replace("/login"); return; }
    if (token) loadData();
  }, [hasHydrated, token, router, loadData]);

  if (!hasHydrated || !token) return null;

  const docs = data?.documents ?? [];
  const totalDocs = data?.total_documents ?? 0;
  const totalJobs = data?.total_jobs ?? 0;
  const totalPages = Math.ceil(totalDocs / 10) || 1;
  const readyCount = docs.reduce((sum, d) => sum + d.jobs.filter((j) => j.status === "exported" || j.status === "completed" || j.status === "ready_for_export" || j.status === "review_complete").length, 0);

  return (
    <AppShell>
      <div className="px-8 py-8">
        <PageHeader eyebrow="Workspace" title="Documents" />

        {/* Stat tiles */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
            <p className="text-xs font-medium text-brand-muted">Source Documents</p>
            <p className="mt-1 font-display text-2xl font-bold text-brand-text">{totalDocs}</p>
            <p className="mt-0.5 text-[0.6875rem] text-brand-subtle">{totalDocs === 0 ? "No documents yet" : `${totalDocs} uploaded`}</p>
          </div>
          <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
            <p className="text-xs font-medium text-brand-muted">Total Translations</p>
            <p className={`mt-1 font-display text-2xl font-bold ${totalJobs > 0 ? "text-brand-text" : "text-brand-subtle"}`}>{totalJobs}</p>
            <p className="mt-0.5 text-[0.6875rem] text-brand-subtle">Across all documents</p>
          </div>
          <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
            <p className="text-xs font-medium text-brand-muted">Ready to Export</p>
            <p className={`mt-1 font-display text-2xl font-bold ${readyCount > 0 ? "text-status-success" : "text-brand-subtle"}`}>{readyCount}</p>
            <p className="mt-0.5 text-[0.6875rem] text-brand-subtle">Completed translations</p>
          </div>
        </div>

        {/* Summary line */}
        <p className="mb-4 text-sm text-brand-muted">
          {totalDocs} {totalDocs === 1 ? "document" : "documents"} · {(orgStats?.total_words_translated ?? 0).toLocaleString()} words translated · {orgStats?.distinct_languages ?? 0} {(orgStats?.distinct_languages ?? 0) === 1 ? "language" : "languages"}
        </p>

        {isLoading && <p className="text-sm text-brand-muted">Loading…</p>}

        {!isLoading && (<>
          <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-brand-border">
                  {["Language", "Project", "Due Date", "Uploaded", "Status", ""].map((col) => (
                    <th key={col || "_actions"} className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-brand-subtle">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <div className="mx-auto max-w-sm">
                        <div className="mb-3 text-4xl">📄</div>
                        <p className="font-display text-lg font-bold text-brand-text">No documents yet</p>
                        <p className="mt-1 text-sm text-brand-muted">Upload a document to translate it. Supports DOCX, RTF, and TXT files.</p>
                        <button type="button" onClick={() => openTranslationModal()} className="mt-4 rounded-full bg-brand-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-accentHov transition-colors">
                          + New Translation
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  docs.map((doc) => (
                    <DocumentGroup key={doc.id} doc={doc} onToast={setToastMessage} onRefresh={loadData} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalDocs > 10 && (
            <div className="mt-4 flex items-center justify-center gap-4">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-full border border-brand-border bg-brand-surface px-4 py-1.5 text-sm font-medium text-brand-muted hover:bg-brand-bg disabled:opacity-40 transition-colors">Previous</button>
              <span className="text-sm text-brand-muted">Page {page} of {totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-full border border-brand-border bg-brand-surface px-4 py-1.5 text-sm font-medium text-brand-muted hover:bg-brand-bg disabled:opacity-40 transition-colors">Next</button>
            </div>
          )}
        </>)}
      </div>
      <NewTranslationModal projects={[]} />
      {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
    </AppShell>
  );
}
