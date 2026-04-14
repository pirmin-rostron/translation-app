"use client";

/**
 * Project detail page — shows project metadata, stats, and a documents table
 * with row grouping when a document has multiple translation jobs (fan-out).
 * Skeleton (meta card, stat tiles, table headers) always visible even when empty.
 */

import { AppShell } from "../../components/AppShell";
import { PageHeader } from "../../components/PageHeader";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useDashboardStore } from "../../stores/dashboardStore";
import { projectsApi, translationJobsApi } from "../../services/api";
import type { ProjectDetailResponse, ProjectStatsResponse, TranslationJobListItem } from "../../services/api";
import { NewTranslationModal } from "../../dashboard/NewTranslationModal";
import { ModalOverlay } from "../../dashboard/ModalOverlay";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { getLanguageDisplayName, getLanguageFlag, PROJECT_LANGUAGE_OPTIONS } from "../../utils/language";

const PROCESSING_STATUSES = new Set(["queued", "parsing", "translating", "translation_queued"]);

function statusLabel(status: string): string {
  if (PROCESSING_STATUSES.has(status)) return "Translating…";
  if (status === "in_review" || status === "review") return "In Review";
  if (status === "completed" || status === "exported") return "Completed";
  if (status === "ready_for_export" || status === "review_complete") return "Ready for Export";
  if (status === "translation_failed") return "Failed";
  return "Pending";
}

function statusBadgeClasses(label: string): string {
  switch (label) {
    case "In Review":
      return "bg-brand-accent/[0.12] text-brand-accent";
    case "Completed":
    case "Ready for Export":
      return "bg-status-successBg text-status-success";
    case "Failed":
      return "bg-status-errorBg text-status-error";
    case "Translating…":
      return "bg-brand-bg text-brand-muted animate-pulse";
    default:
      return "bg-brand-bg text-brand-muted";
  }
}

// Group jobs by document_id so we can render rowspan for multi-language docs
type DocGroup = {
  documentName: string;
  jobs: TranslationJobListItem[];
};

function groupByDocument(jobs: TranslationJobListItem[]): DocGroup[] {
  const map = new Map<number, DocGroup>();
  for (const job of jobs) {
    const existing = map.get(job.document_id);
    if (existing) {
      existing.jobs.push(job);
    } else {
      map.set(job.document_id, {
        documentName: job.document_name ?? `Document #${job.document_id}`,
        jobs: [job],
      });
    }
  }
  return Array.from(map.values());
}

// ── Edit Project Modal ──────────────────────────────────────────────────────

function EditProjectModal({
  open,
  onClose,
  project,
  onSaved,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  project: ProjectDetailResponse;
  onSaved: (updated: ProjectDetailResponse) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [selectedLangs, setSelectedLangs] = useState<Set<string>>(new Set(project.target_languages));
  const [dueDate, setDueDate] = useState(project.due_date ?? "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Sync form when project prop changes (e.g. after save)
  useEffect(() => {
    if (open) {
      setName(project.name);
      setDescription(project.description ?? "");
      setSelectedLangs(new Set(project.target_languages));
      setDueDate(project.due_date ?? "");
      setError("");
      setSubmitting(false);
    }
  }, [open, project]);

  function toggleLang(code: string) {
    setSelectedLangs((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  const canSubmit = name.trim().length > 0 && selectedLangs.size > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      await projectsApi.update(project.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        target_languages: Array.from(selectedLangs),
        due_date: dueDate || undefined,
      });
      // Re-fetch full project detail to get updated documents list too
      const refreshed = await projectsApi.get(project.id);
      onSaved(refreshed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project");
      setSubmitting(false);
    }
  }

  return (
    <ModalOverlay open={open} onClose={onClose}>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="m-0 font-display text-lg font-bold text-brand-text">Edit Project</h2>
          <p className="mt-1 text-sm text-brand-muted">Update project settings</p>
        </div>
        <button type="button" onClick={onClose} className="border-none bg-transparent p-1 text-xl text-brand-subtle">×</button>
      </div>

      {/* Project name */}
      <div className="mb-4">
        <label className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">
          Project name <span className="text-status-error">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 placeholder:text-brand-subtle transition-colors"
        />
      </div>

      {/* Description */}
      <div className="mb-4">
        <label className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          rows={2}
          className="w-full resize-none rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 placeholder:text-brand-subtle transition-colors"
        />
      </div>

      {/* Target languages */}
      <div className="mb-4">
        <label className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">
          Translate into <span className="text-status-error">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {PROJECT_LANGUAGE_OPTIONS.map((lang) => {
            const selected = selectedLangs.has(lang.code);
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => toggleLang(lang.code)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selected
                    ? "border border-brand-accent bg-brand-accentMid font-semibold text-brand-accent"
                    : "border border-brand-border bg-brand-surface text-brand-muted hover:border-brand-accent/40"
                }`}
              >
                {selected && <span className="mr-1">✓</span>}
                {lang.flag} {lang.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Due date */}
      <div className="mb-4">
        <label className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">Due date</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 transition-colors"
        />
      </div>

      {error && <p className="mb-4 text-[0.8125rem] text-status-error">{error}</p>}

      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-medium text-brand-muted hover:text-brand-text underline">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded-full bg-brand-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-accentHov disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {submitting ? "Saving…" : "Save changes"}
        </button>
      </div>

      {/* Destructive action */}
      <div className="mt-6 border-t border-brand-border pt-4">
        <button
          type="button"
          onClick={() => { onClose(); onDelete(); }}
          className="text-sm font-medium text-status-error hover:underline"
        >
          Delete project
        </button>
      </div>
    </ModalOverlay>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const openTranslationModal = useDashboardStore((s) => s.openTranslationModal);
  const projectId = Number(params.id);

  const [project, setProject] = useState<ProjectDetailResponse | null>(null);
  const [jobs, setJobs] = useState<TranslationJobListItem[]>([]);
  const [stats, setStats] = useState<ProjectStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteProject() {
    setDeleting(true);
    try {
      await projectsApi.delete(projectId);
      router.replace("/projects");
    } catch (err) {
      console.error("[delete-project]", err);
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  }

  useEffect(() => {
    if (hasHydrated && !token) router.replace("/login");
  }, [hasHydrated, token, router]);

  useEffect(() => {
    if (!token || Number.isNaN(projectId)) return;
    Promise.all([
      projectsApi.get(projectId),
      translationJobsApi.listByProject(projectId),
      projectsApi.stats(projectId),
    ])
      .then(([proj, jobList, s]) => {
        setProject(proj);
        setJobs(jobList);
        setStats(s);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load project"))
      .finally(() => setLoading(false));
  }, [projectId, token]);

  if (!hasHydrated || !token) return null;
  if (loading) return <AppShell><div className="px-8 py-10 text-brand-muted">Loading…</div></AppShell>;
  if (error) return <AppShell><div className="px-8 py-10 text-status-error">{error}</div></AppShell>;
  if (!project) return <AppShell><div className="px-8 py-10 text-status-error">Project not found</div></AppShell>;

  const docGroups = groupByDocument(jobs);
  const totalDocs = project.document_count;
  const totalLangs = project.target_languages.length;
  const totalJobs = stats?.total_jobs ?? 0;
  const completedCount = stats?.completed_count ?? 0;
  const inReviewCount = stats?.in_review_count ?? 0;
  const progressPercent = totalJobs > 0 ? Math.round((completedCount / totalJobs) * 100) : 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1100px] px-8 py-8">
        {/* 1. PageHeader */}
        <PageHeader
          eyebrow="Project"
          title={project.name}
          action={
            <button
              type="button"
              onClick={() => setEditModalOpen(true)}
              className="rounded-full px-4 py-2 text-sm font-medium text-brand-muted hover:text-brand-text underline"
            >
              ⚙ Edit project
            </button>
          }
        />

        {/* 2. Meta card — always shown */}
        <div className="mb-5 rounded-xl border border-brand-border bg-brand-surface px-6 py-5">
          {project.description && (
            <p className="mb-3 text-sm text-brand-muted">{project.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {project.target_languages.map((lang) => (
              <span key={lang} className="rounded-full bg-brand-accentMid px-3 py-1 text-xs font-medium text-brand-accent">
                {getLanguageFlag(lang)} {getLanguageDisplayName(lang)}
              </span>
            ))}
            {project.due_date && (
              <span className="rounded-full bg-status-warningBg px-3 py-1 text-xs font-medium text-status-warning">
                Due {new Date(project.due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
            <span className="rounded-full bg-brand-bg px-2.5 py-0.5 text-[0.6875rem] font-medium text-brand-muted">
              {totalDocs} {totalDocs === 1 ? "document" : "documents"}
            </span>
          </div>
        </div>

        {/* 3. Stat cards — always shown with zeros */}
        <div className="mb-6 grid grid-cols-4 gap-3">
          <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
            <p className="text-xs font-medium text-brand-muted">Total Jobs</p>
            <p className={`mt-1 font-display text-2xl font-bold ${totalJobs > 0 ? "text-brand-text" : "text-brand-subtle"}`}>{totalJobs}</p>
            <p className="mt-0.5 text-[0.6875rem] text-brand-subtle">{totalDocs} docs × {totalLangs} languages</p>
          </div>
          <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
            <p className="text-xs font-medium text-brand-muted">Completed</p>
            <p className={`mt-1 font-display text-2xl font-bold ${completedCount > 0 ? "text-status-success" : "text-brand-subtle"}`}>{completedCount}</p>
            <p className="mt-0.5 text-[0.6875rem] text-brand-subtle">Ready to export</p>
          </div>
          <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
            <p className="text-xs font-medium text-brand-muted">In Review</p>
            <p className={`mt-1 font-display text-2xl font-bold ${inReviewCount > 0 ? "text-brand-accent" : "text-brand-subtle"}`}>{inReviewCount}</p>
            <p className="mt-0.5 text-[0.6875rem] text-brand-subtle">Awaiting approval</p>
          </div>
          <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
            <p className="text-xs font-medium text-brand-muted">Progress</p>
            <p className={`mt-1 font-display text-2xl font-bold ${progressPercent > 0 ? "text-brand-text" : "text-brand-subtle"}`}>{progressPercent}%</p>
            <div className="mt-2 h-[3px] w-full rounded-full bg-brand-border">
              <div
                className="h-full rounded-full bg-brand-accent transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* 4. Documents table — headers always visible */}
        <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface">
          {/* Toolbar */}
          <div className="flex items-center justify-between border-b border-brand-border px-5 py-3">
            <span className="text-sm text-brand-muted">
              {totalDocs} {totalDocs === 1 ? "document" : "documents"} · {totalJobs} translation jobs
            </span>
            <button
              type="button"
              onClick={() => openTranslationModal(projectId)}
              className="rounded-full bg-brand-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-accentHov transition-colors"
            >
              + Upload document
            </button>
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-brand-border">
                {["Document", "Language", "Words", "Status", "Uploaded"].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-brand-subtle"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                /* Teal callout empty state */
                <tr>
                  <td colSpan={5} className="p-4">
                    <div className="rounded-xl border border-brand-accent/30 bg-brand-accentMid/30 p-6 text-center">
                      <p className="font-display text-lg font-semibold text-brand-text">Ready for your first document</p>
                      <p className="mx-auto mt-2 max-w-md text-sm text-brand-muted">
                        Every file you upload will be automatically translated into{" "}
                        {project.target_languages.map((lang, i) => (
                          <span key={lang}>
                            {i > 0 && (i === project.target_languages.length - 1 ? " and " : ", ")}
                            {getLanguageFlag(lang)} {getLanguageDisplayName(lang)}
                          </span>
                        ))}.
                      </p>
                      <button
                        type="button"
                        onClick={() => openTranslationModal(projectId)}
                        className="mt-4 rounded-full bg-brand-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-accentHov transition-colors"
                      >
                        + Upload document
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                docGroups.map((group, gi) =>
                  group.jobs.map((job, ji) => {
                    const label = statusLabel(job.status);
                    const isProc = PROCESSING_STATUSES.has(job.status);
                    const isFirstInGroup = ji === 0;
                    const rowCount = group.jobs.length;
                    const isMultiLang = rowCount > 1;
                    const groupBorder = gi > 0 && isFirstInGroup ? "border-t-2 border-brand-border" : "";

                    return (
                      <tr
                        key={job.id}
                        className={`${groupBorder} ${
                          isProc
                            ? "cursor-not-allowed opacity-60"
                            : "cursor-pointer transition-colors hover:bg-brand-bg"
                        } ${!isFirstInGroup ? "border-t border-brand-border" : ""}`}
                        onClick={() => {
                          if (!isProc) router.push(`/translation-jobs/${job.id}/overview`);
                        }}
                      >
                        {/* Document name cell — rowspan for multi-language */}
                        {isFirstInGroup && (
                          <td
                            rowSpan={rowCount}
                            className={`align-middle px-4 py-3.5 text-sm font-medium text-brand-text ${
                              isMultiLang ? "border-r-2 border-brand-accentMid" : ""
                            } ${groupBorder}`}
                          >
                            {group.documentName}
                          </td>
                        )}
                        <td className="px-4 py-3.5 text-[0.8125rem] text-brand-muted">
                          {getLanguageFlag(job.source_language)} → {getLanguageFlag(job.target_language)}{" "}
                          {getLanguageDisplayName(job.target_language)}
                        </td>
                        <td className="px-4 py-3.5 text-[0.8125rem] text-brand-muted">
                          {job.progress_total_segments ?? "—"}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.6875rem] font-medium ${statusBadgeClasses(label)}`}>
                            {label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-brand-subtle">
                          {new Date(job.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal — needs projects list for selector */}
      <NewTranslationModal projects={project ? [project] : []} />
      <EditProjectModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        project={project}
        onSaved={(updated) => setProject(updated)}
        onDelete={() => setDeleteConfirmOpen(true)}
      />
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete this project?"
        description="This will remove the project but keep all associated documents as standalone translations. This cannot be undone."
        confirmLabel="Delete project"
        onConfirm={() => { void handleDeleteProject(); }}
        onCancel={() => setDeleteConfirmOpen(false)}
        loading={deleting}
        variant="destructive"
      />
    </AppShell>
  );
}
