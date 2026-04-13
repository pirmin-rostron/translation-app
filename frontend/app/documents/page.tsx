"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../stores/authStore";
import { useDashboardStore } from "../stores/dashboardStore";
import { useDashboardTranslations, useOrgStats, useProjects } from "../hooks/queries";
import { queryKeys, translationJobsApi } from "../services/api";
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


// Inline project selector — clicking opens a dropdown to assign/move document to a project
function InlineProjectCell({ jobId, projectId, projectName }: { jobId: number; projectId: number | null; projectName: string | null }) {
  const queryClient = useQueryClient();
  const { data: projects } = useProjects();
  const [editing, setEditing] = useState(false);

  async function handleChange(value: string) {
    setEditing(false);
    const newProjectId = value === "" ? null : Number(value);
    if (newProjectId === projectId) return;
    try {
      await translationJobsApi.updateProject(jobId, newProjectId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.translationJobs.recent() });
    } catch (err) {
      console.error("[project-assign]", err);
    }
  }

  if (editing) {
    return (
      <select
        autoFocus
        defaultValue={projectId != null ? String(projectId) : ""}
        onBlur={(e) => handleChange(e.target.value)}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full rounded-lg border border-brand-border bg-brand-surface px-2 py-1 text-xs text-brand-text outline-none focus:border-brand-accent"
      >
        <option value="">No project (standalone)</option>
        {(projects ?? []).map((p) => (
          <option key={p.id} value={String(p.id)}>{p.name}</option>
        ))}
      </select>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="cursor-pointer border-none bg-transparent p-0 text-left"
      title="Click to assign project"
    >
      {projectName ? (
        <span className="text-sm text-brand-muted">{projectName}</span>
      ) : (
        <span className="text-sm italic text-brand-subtle">No project</span>
      )}
    </button>
  );
}


// Three-dot actions menu for each row
function RowActionsMenu({ jobId }: { jobId: number }) {
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"delete" | "retranslate" | null>(null);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  async function handleConfirm() {
    setLoading(true);
    try {
      if (confirmAction === "delete") {
        await translationJobsApi.delete(jobId);
      } else if (confirmAction === "retranslate") {
        await translationJobsApi.retranslate(jobId);
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.translationJobs.recent() });
    } catch (err) {
      console.error(`[${confirmAction}]`, err);
    } finally {
      setLoading(false);
      setConfirmAction(null);
      setMenuOpen(false);
    }
  }

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          className="rounded-full p-1.5 text-brand-subtle opacity-0 transition-opacity group-hover/row:opacity-100 hover:bg-brand-bg hover:text-brand-text"
          aria-label="Actions"
        >
          ⋯
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-8 z-20 w-44 rounded-xl border border-brand-border bg-brand-surface py-1 shadow-lg">
            <button
              type="button"
              onClick={() => { setMenuOpen(false); setConfirmAction("retranslate"); }}
              className="w-full px-4 py-2 text-left text-sm text-brand-text hover:bg-brand-bg"
            >
              Re-translate
            </button>
            <button
              type="button"
              onClick={() => { setMenuOpen(false); setConfirmAction("delete"); }}
              className="w-full px-4 py-2 text-left text-sm text-status-error hover:bg-brand-bg"
            >
              Delete
            </button>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmAction === "retranslate"}
        title="Re-translate this document?"
        description="The existing translation will be replaced. This cannot be undone."
        confirmLabel="Re-translate"
        onConfirm={() => { void handleConfirm(); }}
        onCancel={() => setConfirmAction(null)}
        loading={loading}
      />
      <ConfirmDialog
        open={confirmAction === "delete"}
        title="Delete this translation?"
        description="This will permanently delete the translation and all associated data. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { void handleConfirm(); }}
        onCancel={() => setConfirmAction(null)}
        loading={loading}
        variant="destructive"
      />
    </>
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
                  {["Document", "Project", "Language", "Due Date", "Uploaded", "Status", ""].map((col) => (
                    <th key={col || "_actions"} className="px-5 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-brand-subtle">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
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
                    <tr key={t.id} className="group/row border-b border-brand-border last:border-0 transition-colors hover:bg-brand-bg">
                      <td className="px-5 py-3.5">
                        <Link href={`/translation-jobs/${t.id}/overview`} className="text-sm font-medium text-brand-text no-underline hover:underline">
                          {t.document_name ?? `Document #${t.id}`}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <InlineProjectCell jobId={t.id} projectId={t.project_id} projectName={t.project_name} />
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
                      <td className="px-5 py-3.5">
                        <RowActionsMenu jobId={t.id} />
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
