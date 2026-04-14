"use client";

/**
 * Documents page — pill-row grouped table. Document parent rows always visible,
 * translation job sub-rows toggle with chevron. No column headers.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { useDashboardStore } from "../stores/dashboardStore";
import { translationJobsApi, documentsApi } from "../services/api";
import type { GroupedDocument, GroupedDocJob, GroupedDocumentsResponse } from "../services/api";
import { AppShell } from "../components/AppShell";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge, toJobStatus } from "../components/StatusBadge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { NewTranslationModal } from "../dashboard/NewTranslationModal";
import { getLanguageCode } from "../utils/language";

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

// Status-based primary action label
function primaryActionLabel(status: string): string {
  if (status === "in_review" || status === "review") return "Open Review →";
  if (status === "exported") return "Download";
  return "View";
}

function primaryActionClasses(status: string): string {
  if (status === "in_review" || status === "review")
    return "rounded-full bg-brand-accent px-3 py-1 text-xs font-medium text-white hover:bg-brand-accentHov transition-colors";
  return "rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-xs font-medium text-brand-muted hover:bg-brand-bg transition-colors";
}

// Toast
function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 2500); return () => clearTimeout(t); }, [onDismiss]);
  return <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-brand-text px-5 py-2.5 text-sm font-medium text-white shadow-lg">{message}</div>;
}

// ── Document group ──────────────────────────────────────────────────────────

function DocumentGroup({
  doc,
  expanded,
  onToggle,
  onToast,
  onRefresh,
}: {
  doc: GroupedDocument;
  expanded: boolean;
  onToggle: () => void;
  onToast: (msg: string) => void;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const openTranslationModal = useDashboardStore((s) => s.openTranslationModal);
  const [confirmAction, setConfirmAction] = useState<{ type: "delete_doc" | "delete_job" | "retranslate"; jobId?: number } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!confirmAction) return;
    setLoading(true);
    try {
      if (confirmAction.type === "delete_doc") {
        await documentsApi.delete(doc.id);
        onToast("Document deleted");
      } else if (confirmAction.type === "delete_job" && confirmAction.jobId) {
        await translationJobsApi.delete(confirmAction.jobId);
        onToast("Translation deleted");
      } else if (confirmAction.type === "retranslate" && confirmAction.jobId) {
        await translationJobsApi.retranslate(confirmAction.jobId);
        onToast("Re-translation queued");
      }
      onRefresh();
    } catch (err) { console.error("[action]", err); }
    finally { setLoading(false); setConfirmAction(null); }
  }

  return (
    <>
      {/* Document parent row — always visible */}
      <div className="flex items-center gap-3 border-b border-brand-border bg-brand-bg px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex h-5 w-5 shrink-0 items-center justify-center border-none bg-transparent text-xs text-brand-muted transition-transform"
          style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
        >▶</button>
        <span className="text-base">📄</span>
        <Link href={`/documents/${doc.id}`} className="text-sm font-semibold text-brand-text no-underline hover:underline">{doc.filename}</Link>
        <span className="text-xs text-brand-muted">
          {doc.word_count.toLocaleString()} words · {doc.uploaded_at ? formatRelativeDate(doc.uploaded_at) : "—"} · {doc.jobs.length} {doc.jobs.length === 1 ? "translation" : "translations"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => openTranslationModal()}
            className="rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-xs font-medium text-brand-muted hover:bg-brand-bg transition-colors"
          >+ Add language</button>
          <button
            type="button"
            onClick={() => setConfirmAction({ type: "delete_doc" })}
            className="rounded-full border border-status-error/30 px-3 py-1 text-xs font-medium text-status-error hover:bg-status-errorBg transition-colors"
          >Delete</button>
        </div>
      </div>

      {/* Job sub-rows — hidden when collapsed */}
      {expanded && doc.jobs.map((job) => (
        <div
          key={job.id}
          className="group/row flex cursor-pointer items-center gap-2 border-b border-brand-border bg-brand-surface px-4 py-2.5 pl-12 transition-colors hover:bg-brand-bg"
          onClick={() => router.push(`/translation-jobs/${job.id}/overview`)}
        >
          {/* Language pill */}
          <span className="rounded-full bg-brand-accentMid px-2.5 py-0.5 text-xs font-medium text-brand-accent">
            {getLanguageCode(job.source_language)} → {getLanguageCode(job.target_language)}
          </span>
          {/* Status pill */}
          <StatusBadge status={toJobStatus(job.status)} />
          {/* Meta */}
          <span className="text-xs text-brand-subtle">
            {job.project_name ?? <span className="italic">No project</span>}
            {" · "}
            {job.created_at ? formatRelativeDate(job.created_at) : "—"}
          </span>
          {/* Right-aligned actions */}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); router.push(`/translation-jobs/${job.id}/overview`); }}
              className={primaryActionClasses(job.status)}
            >
              {primaryActionLabel(job.status)}
            </button>
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/row:opacity-100">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setConfirmAction({ type: "retranslate", jobId: job.id }); }}
                className="rounded-full border border-brand-border px-2.5 py-0.5 text-xs text-brand-muted hover:bg-brand-bg"
                title="Re-translate"
              >↻</button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setConfirmAction({ type: "delete_job", jobId: job.id }); }}
                className="rounded-full border border-status-error/30 px-2.5 py-0.5 text-xs text-status-error hover:bg-status-errorBg"
                title="Delete translation"
              >✕</button>
            </div>
          </div>
        </div>
      ))}

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={confirmAction?.type === "delete_doc"}
        title="Delete this document permanently?"
        description="This will remove the uploaded file and all translations. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { void handleConfirm(); }}
        onCancel={() => setConfirmAction(null)}
        loading={loading}
        variant="destructive"
      />
      <ConfirmDialog
        open={confirmAction?.type === "delete_job"}
        title="Delete this translation?"
        description="The uploaded document will be kept and can be re-translated."
        confirmLabel="Delete translation"
        onConfirm={() => { void handleConfirm(); }}
        onCancel={() => setConfirmAction(null)}
        loading={loading}
      />
      <ConfirmDialog
        open={confirmAction?.type === "retranslate"}
        title="Re-translate this document?"
        description="The existing translation will be replaced. This cannot be undone."
        confirmLabel="Re-translate"
        onConfirm={() => { void handleConfirm(); }}
        onCancel={() => setConfirmAction(null)}
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

  const [page, setPage] = useState(1);
  const [data, setData] = useState<GroupedDocumentsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [collapsedDocs, setCollapsedDocs] = useState<Set<number>>(new Set());

  const loadData = useCallback(() => {
    setIsLoading(true);
    documentsApi.listGrouped(page, 20)
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
  const totalPages = Math.ceil(totalDocs / 20) || 1;
  const readyCount = docs.reduce((sum, d) => sum + d.jobs.filter((j) =>
    j.status === "exported" || j.status === "completed" || j.status === "ready_for_export" || j.status === "review_complete"
  ).length, 0);

  function toggleDoc(docId: number) {
    setCollapsedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId); else next.add(docId);
      return next;
    });
  }

  function toggleAll() {
    if (allCollapsed) {
      setCollapsedDocs(new Set());
      setAllCollapsed(false);
    } else {
      setCollapsedDocs(new Set(docs.map((d) => d.id)));
      setAllCollapsed(true);
    }
  }

  function isExpanded(docId: number) {
    return !collapsedDocs.has(docId);
  }

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

        {isLoading && <p className="text-sm text-brand-muted">Loading…</p>}

        {!isLoading && (<>
          {docs.length === 0 ? (
            <div className="rounded-xl border border-brand-border bg-brand-surface px-8 py-16 text-center">
              <div className="mb-3 text-4xl">📄</div>
              <p className="font-display text-lg font-bold text-brand-text">No documents yet</p>
              <p className="mt-1 text-sm text-brand-muted">Upload a document to translate it. Supports DOCX, RTF, and TXT files.</p>
              <button type="button" onClick={() => openTranslationModal()} className="mt-4 rounded-full bg-brand-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-accentHov transition-colors">
                + New Translation
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-brand-border">
              {/* Toolbar */}
              <div className="flex items-center justify-between border-b border-brand-border bg-brand-surface px-4 py-2.5">
                <span className="text-sm text-brand-muted">{totalDocs} source {totalDocs === 1 ? "document" : "documents"}</span>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs font-medium text-brand-muted hover:text-brand-text"
                >
                  {allCollapsed ? "Expand all" : "Collapse all"}
                </button>
              </div>

              {/* Document groups */}
              {docs.map((doc) => (
                <DocumentGroup
                  key={doc.id}
                  doc={doc}
                  expanded={isExpanded(doc.id)}
                  onToggle={() => toggleDoc(doc.id)}
                  onToast={setToastMessage}
                  onRefresh={loadData}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalDocs > 20 && (
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
