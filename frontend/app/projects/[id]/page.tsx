"use client";

/**
 * Project detail page — shows project metadata, stats, and a documents table
 * with row grouping when a document has multiple translation jobs (fan-out).
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
import { getLanguageDisplayName, getLanguageFlag } from "../../utils/language";

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
  const progressPercent = stats && stats.total_jobs > 0
    ? Math.round((stats.completed_count / stats.total_jobs) * 100)
    : 0;

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
              onClick={() => {/* placeholder for edit */}}
              className="rounded-full px-4 py-2 text-sm font-medium text-brand-muted hover:text-brand-text underline"
            >
              ⚙ Edit project
            </button>
          }
        />

        {/* 2. Meta card */}
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

        {/* 3. Stat cards */}
        {stats && (
          <div className="mb-6 grid grid-cols-4 gap-3">
            <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
              <p className="text-xs font-medium text-brand-muted">Total Jobs</p>
              <p className="mt-1 font-display text-2xl font-bold text-brand-text">{stats.total_jobs}</p>
              <p className="mt-0.5 text-[0.6875rem] text-brand-subtle">{totalDocs} docs × {totalLangs} languages</p>
            </div>
            <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
              <p className="text-xs font-medium text-brand-muted">Completed</p>
              <p className="mt-1 font-display text-2xl font-bold text-status-success">{stats.completed_count}</p>
              <p className="mt-0.5 text-[0.6875rem] text-brand-subtle">Ready to export</p>
            </div>
            <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
              <p className="text-xs font-medium text-brand-muted">In Review</p>
              <p className="mt-1 font-display text-2xl font-bold text-brand-accent">{stats.in_review_count}</p>
              <p className="mt-0.5 text-[0.6875rem] text-brand-subtle">Awaiting approval</p>
            </div>
            <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
              <p className="text-xs font-medium text-brand-muted">Progress</p>
              <p className="mt-1 font-display text-2xl font-bold text-brand-text">{progressPercent}%</p>
              <div className="mt-2 h-[3px] w-full rounded-full bg-brand-border">
                <div
                  className="h-full rounded-full bg-brand-accent transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 4. Documents table */}
        <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface">
          {/* Toolbar */}
          <div className="flex items-center justify-between border-b border-brand-border px-5 py-3">
            <span className="text-sm text-brand-muted">
              {totalDocs} {totalDocs === 1 ? "document" : "documents"} · {stats?.total_jobs ?? 0} translation jobs
            </span>
            <button
              type="button"
              onClick={() => openTranslationModal(projectId)}
              className="rounded-full bg-brand-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-accentHov transition-colors"
            >
              + Upload document
            </button>
          </div>

          {jobs.length === 0 ? (
            <div className="px-8 py-16 text-center">
              <p className="font-display text-lg font-bold text-brand-text">No documents yet.</p>
              <p className="mt-1 text-sm text-brand-muted">Upload a document to start translating.</p>
              <button
                type="button"
                onClick={() => openTranslationModal(projectId)}
                className="mt-4 rounded-full bg-brand-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-accentHov"
              >
                Upload a document
              </button>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-brand-border">
                  {["Document", "Language", "Words", "Status", "Uploaded"].map((col) => (
                    <th
                      key={col}
                      className="px-5 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-brand-subtle"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docGroups.map((group, gi) =>
                  group.jobs.map((job, ji) => {
                    const label = statusLabel(job.status);
                    const isProcessing = PROCESSING_STATUSES.has(job.status);
                    const isFirstInGroup = ji === 0;
                    const rowCount = group.jobs.length;
                    const isMultiLang = rowCount > 1;
                    // Group separator border for non-first groups
                    const groupBorder = gi > 0 && isFirstInGroup ? "border-t-2 border-brand-border" : "";

                    return (
                      <tr
                        key={job.id}
                        className={`${groupBorder} ${
                          isProcessing
                            ? "cursor-not-allowed opacity-60"
                            : "cursor-pointer transition-colors hover:bg-brand-bg"
                        } ${!isFirstInGroup ? "border-t border-brand-border" : ""}`}
                        onClick={() => {
                          if (!isProcessing) router.push(`/translation-jobs/${job.id}/overview`);
                        }}
                      >
                        {/* Document name cell — rowspan for multi-language */}
                        {isFirstInGroup && (
                          <td
                            rowSpan={rowCount}
                            className={`px-5 py-3.5 text-sm font-medium text-brand-text align-top ${
                              isMultiLang ? "border-r-2 border-brand-accentMid" : ""
                            } ${groupBorder}`}
                          >
                            {group.documentName}
                          </td>
                        )}
                        <td className="px-5 py-3.5 text-[0.8125rem] text-brand-muted">
                          {getLanguageFlag(job.source_language)} → {getLanguageFlag(job.target_language)}{" "}
                          {getLanguageDisplayName(job.target_language)}
                        </td>
                        <td className="px-5 py-3.5 text-[0.8125rem] text-brand-muted">
                          {job.progress_total_segments ?? "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.6875rem] font-medium ${statusBadgeClasses(label)}`}>
                            {label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-brand-subtle">
                          {new Date(job.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal — needs projects list for selector */}
      <NewTranslationModal projects={project ? [project] : []} />
    </AppShell>
  );
}
