"use client";

/**
 * Project detail page — project metadata, stat cards, collapsible document tree
 * with job sub-rows, inline ReviewPeek for in_review/completed jobs.
 * Settings panel is out of scope — not modified here.
 */

import { Fragment, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "../../stores/authStore";
import { useDashboardStore } from "../../stores/dashboardStore";
import { projectsApi, translationJobsApi, documentsApi } from "../../services/api";
import type {
  ProjectDetailResponse,
  ProjectStatsResponse,
  TranslationJobListItem,
} from "../../services/api";
import { AppShell } from "../../components/AppShell";
import { StatusBadge, toJobStatus } from "../../components/StatusBadge";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { NewTranslationModal } from "../../dashboard/NewTranslationModal";
import { ModalOverlay } from "../../dashboard/ModalOverlay";
import { Icons } from "../../components/Icons";
import {
  getLanguageCode,
  getLanguageDisplayName,
  getLanguageFlag,
  PROJECT_LANGUAGE_OPTIONS,
} from "../../utils/language";
import { useReviewBlocks } from "../../hooks/queries";
import type { ReviewBlock as ApiReviewBlock, ReviewSegment } from "../../hooks/queries";

// ── Helpers ─────────────────────────────────────────────────────────────────

const PROCESSING_STATUSES = new Set([
  "queued", "parsing", "translating", "translation_queued",
]);

type DocGroup = {
  documentName: string;
  documentId: number;
  wordCount: number;
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
        documentId: job.document_id,
        wordCount: 0,
        jobs: [job],
      });
    }
  }
  return Array.from(map.values());
}

function jobProgress(j: TranslationJobListItem): number {
  if (!j.progress_total_segments || j.progress_total_segments === 0) return 0;
  return Math.round((j.progress_completed_segments / j.progress_total_segments) * 100);
}

// ── StatTile ────────────────────────────────────────────────────────────────

function StatTile({ label, value, valueClass, meta, progress }: {
  label: string;
  value: string | number;
  valueClass?: string;
  meta: string | null;
  progress?: number;
}) {
  const isZero = value === 0 || value === "0%";
  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
      <p className="m-0 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-subtle">{label}</p>
      <p className={`m-0 mt-2 font-display text-[2rem] font-semibold leading-none tracking-display ${isZero ? "text-brand-subtle" : (valueClass ?? "text-brand-text")}`}>
        {value}
      </p>
      {meta && <p className="m-0 mt-1.5 text-[0.6875rem] text-brand-subtle">{meta}</p>}
      {typeof progress === "number" && (
        <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-brand-sunken">
          <div className="h-full rounded-full bg-brand-accent transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

// ── ReviewPeek ──────────────────────────────────────────────────────────────
// Uses real ReviewBlock/ReviewSegment types from the API.
// Each block has segments — we show block-level source/target and segment-level ambiguity.

function getBlockSourceText(block: ApiReviewBlock): string {
  return block.source_text_display ?? block.text_original ?? "";
}

function getBlockTranslatedText(block: ApiReviewBlock): string {
  return block.translated_text_display ?? block.text_translated ?? "";
}

function blockHasAmbiguity(block: ApiReviewBlock): boolean {
  return block.segments.some((s) => s.ambiguity_detected);
}

function getBlockAmbiguityOptions(block: ApiReviewBlock): Array<{ meaning: string; translation: string }> {
  for (const s of block.segments) {
    if (s.ambiguity_detected && s.ambiguity_options.length > 0) return s.ambiguity_options;
  }
  return [];
}

function getBlockReviewStatus(block: ApiReviewBlock): string {
  const statuses = block.segments.map((s) => s.review_status);
  if (statuses.every((s) => s === "approved")) return "approved";
  if (statuses.some((s) => s === "pending" || s === "unresolved")) return "pending";
  return "pending";
}

function ReviewPeek({ jobId, docName, sourceLang, targetLang }: {
  jobId: number;
  docName: string;
  sourceLang: string;
  targetLang: string;
}) {
  const { data: blocks } = useReviewBlocks(jobId);
  const [activeBlock, setActiveBlock] = useState<number | null>(null);
  const [decisions, setDecisions] = useState<Record<number, { status: string; pick?: number }>>({});
  const router = useRouter();

  if (!blocks || blocks.length === 0) {
    return (
      <div className="border-b border-brand-border bg-brand-bg px-4 py-5 pl-12">
        <p className="m-0 text-sm text-brand-muted">Block-level review available after opening this job.</p>
      </div>
    );
  }

  const decidedCount = blocks.filter((b) =>
    decisions[b.id]?.status === "approved" || getBlockReviewStatus(b) === "approved"
  ).length;

  function approveAll() {
    const next = { ...decisions };
    blocks?.forEach((b) => {
      if (!next[b.id]) next[b.id] = { status: "approved" };
    });
    setDecisions(next);
  }

  return (
    <div className="animate-slidedown border-b border-brand-border bg-brand-bg px-4 py-5 pl-12">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="m-0 text-[0.6875rem] font-semibold uppercase tracking-widest text-brand-accent">Review peek</p>
          <p className="m-0 mt-0.5 font-display text-lg font-semibold text-brand-text">
            {docName} · {getLanguageCode(sourceLang)} → {getLanguageCode(targetLang)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-brand-muted">{decidedCount} / {blocks.length} approved</span>
          <button onClick={approveAll} className="rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-xs font-medium text-brand-muted transition-colors hover:bg-brand-bg">
            Approve remaining
          </button>
          <button onClick={() => router.push(`/translation-jobs/${jobId}`)} className="rounded-full bg-brand-accent px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-accentHov">
            Open full review →
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface">
        {blocks.map((b, i) => {
          const decision = decisions[b.id];
          const isActive = activeBlock === b.id;
          const realStatus = getBlockReviewStatus(b);
          const effectiveStatus = decision?.status ?? realStatus;
          const isAmb = blockHasAmbiguity(b);
          const ambOptions = getBlockAmbiguityOptions(b);
          const borderColor = effectiveStatus === "approved"
            ? "border-l-status-success"
            : isAmb && !decision
              ? "border-l-status-warning"
              : "border-l-transparent";

          return (
            <div
              key={b.id}
              className={`border-b border-brand-border last:border-0 border-l-4 ${borderColor} transition-colors ${
                isActive ? "bg-brand-accentMid/20" : "bg-brand-surface hover:bg-brand-bg"
              }`}
            >
              <button
                onClick={() => setActiveBlock(isActive ? null : b.id)}
                className="w-full cursor-pointer border-0 bg-transparent px-5 py-3.5 text-left"
              >
                <div className="flex items-start gap-3">
                  <span className="pt-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-brand-subtle">B{i + 1}</span>
                  <div className="min-w-0 flex-1 grid grid-cols-2 gap-4">
                    <div>
                      <p className="m-0 mb-1 text-[0.6875rem] font-medium uppercase tracking-wider text-brand-subtle">Source · {getLanguageCode(sourceLang)}</p>
                      <p className="m-0 text-sm leading-relaxed text-brand-text">{getBlockSourceText(b)}</p>
                    </div>
                    <div>
                      <p className="m-0 mb-1 text-[0.6875rem] font-medium uppercase tracking-wider text-brand-accent">Target · {getLanguageCode(targetLang)}</p>
                      <p className="m-0 text-sm leading-relaxed text-brand-text">
                        {decision?.pick !== undefined && ambOptions[decision.pick]
                          ? ambOptions[decision.pick].translation
                          : getBlockTranslatedText(b)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
                    {effectiveStatus === "approved" && (
                      <span className="rounded-full bg-status-successBg px-2.5 py-0.5 text-[0.6875rem] font-medium text-status-success">Approved</span>
                    )}
                    {isAmb && !decision && (
                      <span className="rounded-full bg-status-warningBg px-2.5 py-0.5 text-[0.6875rem] font-medium text-status-warning">Ambiguous</span>
                    )}
                    {effectiveStatus === "pending" && !isAmb && (
                      <span className="rounded-full bg-brand-bg px-2.5 py-0.5 text-[0.6875rem] font-medium text-brand-muted">Pending</span>
                    )}
                  </div>
                </div>
              </button>

              {isActive && (
                <div className="animate-slidedown px-5 pb-4 pl-[3.75rem]">
                  {isAmb && ambOptions.length > 1 && (
                    <div className="mb-3 rounded-xl border border-status-warning/30 bg-status-warningBg p-4">
                      <p className="m-0 mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-widest text-status-warning">Linguistic Insight — Ambiguity</p>
                      <div className="mt-3 space-y-2">
                        {ambOptions.map((opt, idx) => {
                          const selected = (decision?.pick ?? 0) === idx;
                          return (
                            <button
                              key={idx}
                              onClick={(e) => { e.stopPropagation(); setDecisions({ ...decisions, [b.id]: { status: "approved", pick: idx } }); }}
                              className={`block w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                                selected ? "border-brand-accent bg-brand-accentMid/40 text-brand-text" : "border-brand-border bg-brand-surface text-brand-text hover:border-brand-accent/50"
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? "border-brand-accent bg-brand-accent text-white" : "border-brand-border bg-brand-surface"}`}>
                                  {selected && <Icons.Check className="h-2.5 w-2.5" />}
                                </span>
                                <span className="flex-1">
                                  <span className="mr-2 text-[0.6875rem] font-medium uppercase tracking-wider text-brand-subtle">Option {idx + 1}</span>
                                  <span className="text-brand-muted">{opt.meaning}</span> — {opt.translation}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {!isAmb && effectiveStatus !== "approved" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDecisions({ ...decisions, [b.id]: { status: "approved" } }); }}
                        className="rounded-full bg-brand-accent px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-accentHov"
                      >Approve</button>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-full border border-brand-border bg-brand-surface px-4 py-1.5 text-xs font-medium text-brand-muted transition-colors hover:bg-brand-bg"
                      >Edit translation</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── JobRow ───────────────────────────────────────────────────────────────────

function JobRow({ job, docName, expanded, onToggle }: {
  job: TranslationJobListItem;
  docName: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const isProc = PROCESSING_STATUSES.has(job.status);
  const isReview = job.status === "in_review" || job.status === "review";
  const isComplete = job.status === "completed" || job.status === "ready_for_export" || job.status === "review_complete";
  const isExported = job.status === "exported";
  const canPeek = isReview || isComplete;
  const pct = jobProgress(job);

  return (
    <>
      <div
        className={`flex items-center gap-2 border-b border-brand-border bg-brand-surface px-4 py-2.5 pl-12 transition-colors ${
          canPeek ? "cursor-pointer hover:bg-brand-bg" : isProc ? "opacity-60" : ""
        }`}
        onClick={() => canPeek && onToggle()}
      >
        {/* Language pair */}
        <span className="rounded-full bg-brand-accentMid px-2.5 py-0.5 text-xs font-medium text-brand-accent">
          {getLanguageCode(job.source_language)} → {getLanguageCode(job.target_language)}
        </span>
        <span className="text-xs text-brand-muted">
          {getLanguageFlag(job.target_language)} {getLanguageDisplayName(job.target_language)}
        </span>

        {/* Status badge */}
        <StatusBadge status={toJobStatus(job.status)} />

        {/* Progress bar for processing jobs */}
        {isProc && (
          <div className="flex items-center gap-2">
            <div className="h-[3px] w-28 overflow-hidden rounded-full bg-brand-border">
              <div className="h-full rounded-full bg-status-info transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[0.6875rem] text-brand-subtle">{pct}%</span>
          </div>
        )}

        {/* Context-sensitive actions */}
        <div className="ml-auto flex items-center gap-2">
          {canPeek && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              className="text-[0.6875rem] font-medium text-brand-subtle hover:text-brand-text"
            >
              {expanded ? "Hide" : "Peek"}
            </button>
          )}

          {isReview && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); router.push(`/translation-jobs/${job.id}`); }}
              className="rounded-full bg-brand-accent px-3.5 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-accentHov"
            >
              Open review →
            </button>
          )}

          {isComplete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); router.push(`/translation-jobs/${job.id}`); }}
              className="rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-xs font-medium text-brand-muted transition-colors hover:bg-brand-bg"
            >
              View
            </button>
          )}

          {isProc && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); router.push(`/translation-jobs/${job.id}`); }}
              className="rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-xs font-medium text-brand-muted transition-colors hover:bg-brand-bg"
            >
              Monitor
            </button>
          )}

          {isExported && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); router.push(`/translation-jobs/${job.id}`); }}
              className="rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-xs font-medium text-brand-muted transition-colors hover:bg-brand-bg"
            >
              Download
            </button>
          )}
        </div>
      </div>

      {expanded && canPeek && (
        <ReviewPeek
          jobId={job.id}
          docName={docName}
          sourceLang={job.source_language ?? "en"}
          targetLang={job.target_language}
        />
      )}
    </>
  );
}

// ── Edit Project Modal ──────────────────────────────────────────────────────

function EditProjectModal({
  open,
  onClose,
  project,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  project: ProjectDetailResponse;
  onSaved: (updated: ProjectDetailResponse) => void;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [selectedLangs, setSelectedLangs] = useState<Set<string>>(new Set(project.target_languages));
  const [dueDate, setDueDate] = useState(project.due_date ?? "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

      <div className="mb-4">
        <label className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">
          Project name <span className="text-status-error">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none transition-colors focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 placeholder:text-brand-subtle"
          placeholder="Project name"
        />
      </div>

      <div className="mb-4">
        <label className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none transition-colors focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 placeholder:text-brand-subtle"
          placeholder="Optional"
        />
      </div>

      <div className="mb-4">
        <label className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">
          Translate into <span className="text-status-error">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {PROJECT_LANGUAGE_OPTIONS.map((opt) => {
            const sel = selectedLangs.has(opt.code);
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => toggleLang(opt.code)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  sel
                    ? "border-brand-accent bg-brand-accentMid font-semibold text-brand-accent"
                    : "border-brand-border bg-brand-surface text-brand-muted hover:border-brand-accent/40"
                }`}
              >
                {sel && <span className="mr-1">✓</span>}
                {opt.flag} {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-4">
        <label className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">Due date</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none transition-colors focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
        />
      </div>

      {error && <p className="mb-4 text-sm text-status-error">{error}</p>}

      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="cursor-pointer border-0 bg-transparent px-4 py-2 text-sm font-medium text-brand-muted underline hover:text-brand-text">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          className="rounded-full bg-brand-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-accentHov disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save changes
        </button>
      </div>
    </ModalOverlay>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

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
  const [collapsedDocs, setCollapsedDocs] = useState<Set<string>>(new Set());
  const [openReviewJobId, setOpenReviewJobId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [docDeleteTarget, setDocDeleteTarget] = useState<number | null>(null);
  const [docDeleteLoading, setDocDeleteLoading] = useState(false);

  function reloadProjectData() {
    if (!token || Number.isNaN(projectId)) return;
    Promise.all([
      projectsApi.get(projectId),
      translationJobsApi.listByProject(projectId),
      projectsApi.stats(projectId),
    ])
      .then(([proj, jobList, s]) => { setProject(proj); setJobs(jobList); setStats(s); })
      .catch(() => {});
  }

  function toggleDocCollapse(docName: string) {
    setCollapsedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(docName)) next.delete(docName);
      else next.add(docName);
      return next;
    });
  }

  async function handleDeleteDocument(docId: number) {
    setDocDeleteLoading(true);
    try {
      await documentsApi.delete(docId);
      setToastMessage("Document deleted");
      reloadProjectData();
    } catch (err) {
      console.error("[delete-doc]", err);
    } finally {
      setDocDeleteLoading(false);
      setDocDeleteTarget(null);
    }
  }

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
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2500);
    return () => clearTimeout(t);
  }, [toastMessage]);

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
  const progressPct = totalJobs > 0 ? Math.round((completedCount / totalJobs) * 100) : 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1200px] px-8 py-8">
        {/* Breadcrumb */}
        <p className="mb-1 text-xs text-brand-subtle">
          <Link href="/projects" className="text-brand-accent no-underline hover:underline">Projects</Link>
          <span className="text-brand-muted"> › {project.name}</span>
        </p>

        {/* Header */}
        <div className="mb-6 flex items-end justify-between gap-6">
          <div>
            <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-widest text-brand-accent">
              Project
            </p>
            <div className="flex items-center gap-3">
              <h1 className="m-0 font-display text-[2rem] font-bold leading-tight tracking-display text-brand-text">
                {project.name}
              </h1>
              <span className="rounded-full bg-brand-sunken px-2.5 py-0.5 text-[0.6875rem] font-medium text-brand-muted">
                + Pinned
              </span>
            </div>
            {project.description && (
              <p className="mt-2 max-w-xl text-sm text-brand-muted">{project.description}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setEditModalOpen(true)}
              className="rounded-full border border-brand-border bg-brand-surface px-4 py-2 text-sm font-medium text-brand-muted transition-colors hover:bg-brand-bg"
            >
              Edit project
            </button>
            <button
              type="button"
              onClick={() => openTranslationModal(projectId)}
              className="rounded-full bg-brand-text px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-accent"
            >
              + Upload document
            </button>
          </div>
        </div>

        {/* Autopilot banner */}
        {inReviewCount > 0 && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-brand-accent/30 border-l-4 border-l-brand-accent bg-brand-accentMid/30 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-accent text-white">
              <Icons.Sparkle className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="m-0 font-display text-[1.0625rem] font-semibold text-brand-text">Autopilot is handling this project <span className="text-status-success">●</span></p>
              <p className="m-0 mt-1 text-sm text-brand-muted">
                Files are translated and checked automatically. You&apos;ll only be pulled in when Linguistic Insights flag a material ambiguity
                — {inReviewCount} {inReviewCount === 1 ? "block needs" : "blocks need"} your attention right now.
              </p>
            </div>
          </div>
        )}

        {/* Target language pills + due date */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
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
        </div>

        {/* Stat cards */}
        <div className="mb-6 grid grid-cols-4 gap-3">
          <StatTile label="Total Jobs" value={totalJobs} meta={`${totalDocs} docs × ${totalLangs} languages`} />
          <StatTile label="Completed" value={completedCount} valueClass="text-status-success" meta="Ready to export" />
          <StatTile label="Needs Review" value={inReviewCount} valueClass="text-brand-accent" meta="Awaiting you" />
          <StatTile label="Progress" value={`${progressPct}%`} meta={null} progress={progressPct} />
        </div>

        {/* Documents tree */}
        <div className="overflow-hidden rounded-xl border border-brand-border">
          <div className="flex items-center justify-between border-b border-brand-border bg-brand-surface px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-brand-text">Documents</span>
              <span className="text-xs text-brand-muted">{totalDocs} {totalDocs === 1 ? "file" : "files"} · {totalJobs} translation {totalJobs === 1 ? "job" : "jobs"}</span>
            </div>
            <div className="flex items-center gap-3">
              {docGroups.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (collapsedDocs.size === docGroups.length) setCollapsedDocs(new Set());
                    else setCollapsedDocs(new Set(docGroups.map((g) => g.documentName)));
                  }}
                  className="text-xs font-medium text-brand-muted hover:text-brand-text"
                >
                  {collapsedDocs.size === docGroups.length ? "Expand all" : "Collapse all"}
                </button>
              )}
              <button
                type="button"
                onClick={() => openTranslationModal(projectId)}
                className="rounded-full bg-brand-accent px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-accentHov"
              >
                + Upload document
              </button>
            </div>
          </div>

          {jobs.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <p className="m-0 font-display text-lg font-semibold text-brand-text">No documents yet</p>
              <p className="m-0 mt-2 text-sm text-brand-muted">Upload your first document to get started.</p>
              <button
                type="button"
                onClick={() => openTranslationModal(projectId)}
                className="mt-5 rounded-full bg-brand-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-accentHov"
              >
                + Upload document
              </button>
            </div>
          ) : (
            docGroups.map((group) => {
              const isCollapsed = collapsedDocs.has(group.documentName);
              const firstJob = group.jobs[0];
              const docId = firstJob?.document_id;
              return (
                <Fragment key={group.documentName}>
                  <div className="flex items-center gap-3 border-b border-brand-border bg-brand-bg px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleDocCollapse(group.documentName)}
                      className="flex h-5 w-5 shrink-0 items-center justify-center border-none bg-transparent text-xs text-brand-muted transition-transform"
                      style={{ transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)" }}
                    >
                      ▶
                    </button>
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-brand-subtle">
                      <path d="M5 2.5h6l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Z" />
                      <path d="M11 2.5V6.5h4" />
                    </svg>
                    <Link
                      href={`/documents/${firstJob?.document_id ?? 0}`}
                      className="text-sm font-semibold text-brand-text no-underline hover:underline"
                    >
                      {group.documentName}
                    </Link>
                    <span className="text-xs text-brand-muted">
                      {group.jobs.length} {group.jobs.length === 1 ? "translation" : "translations"}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openTranslationModal(projectId)}
                        className="rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-xs font-medium text-brand-muted transition-colors hover:bg-brand-bg"
                      >
                        + Add language
                      </button>
                      {docId && (
                        <button
                          type="button"
                          onClick={() => setDocDeleteTarget(docId)}
                          className="rounded-full border border-status-error/30 px-3 py-1 text-xs font-medium text-status-error transition-colors hover:bg-status-errorBg"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {!isCollapsed && group.jobs.map((job) => (
                    <JobRow
                      key={job.id}
                      job={job}
                      docName={group.documentName}
                      expanded={openReviewJobId === job.id}
                      onToggle={() => setOpenReviewJobId(openReviewJobId === job.id ? null : job.id)}
                    />
                  ))}
                </Fragment>
              );
            })
          )}
        </div>
      </div>

      <NewTranslationModal projects={project ? [project] : []} />
      <EditProjectModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        project={project}
        onSaved={(updated) => setProject(updated)}
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
      <ConfirmDialog
        open={docDeleteTarget !== null}
        title="Delete this document permanently?"
        description="This will remove the uploaded file and all translations. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { if (docDeleteTarget) void handleDeleteDocument(docDeleteTarget); }}
        onCancel={() => setDocDeleteTarget(null)}
        loading={docDeleteLoading}
        variant="destructive"
      />
      {toastMessage && (
        <div className="animate-slideup fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-brand-border bg-brand-surface px-5 py-2.5 text-sm font-medium text-brand-text shadow-lg">
          {toastMessage}
        </div>
      )}
    </AppShell>
  );
}
