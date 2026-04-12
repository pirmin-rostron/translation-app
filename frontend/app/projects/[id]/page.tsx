"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useDashboardStore } from "../../stores/dashboardStore";
import { projectsApi, translationJobsApi } from "../../services/api";
import type { ProjectDetailResponse, TranslationJobListItem } from "../../services/api";
import { NewTranslationModal } from "../../dashboard/NewTranslationModal";
import { getLanguageDisplayName } from "../../utils/language";

const PROCESSING_STATUSES = new Set(["queued", "parsing", "translating", "translation_queued"]);

function statusLabel(status: string): string {
  if (PROCESSING_STATUSES.has(status)) return "Translating…";
  if (status === "in_review" || status === "review") return "In Review";
  if (status === "completed" || status === "exported") return "Completed";
  if (status === "ready_for_export") return "Ready for Export";
  if (status === "translation_failed") return "Failed";
  return "Pending";
}

function statusBadgeClasses(label: string): string {
  switch (label) {
    case "In Review":
      return "bg-brand-accent/[0.12] text-brand-accent";
    case "Completed":
    case "Ready for Export":
      return "bg-green-50 text-green-700";
    case "Failed":
      return "bg-status-errorBg text-status-error";
    case "Translating…":
      return "bg-brand-bg text-brand-muted animate-pulse";
    default:
      return "bg-brand-bg text-brand-muted";
  }
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
    ])
      .then(([proj, jobList]) => {
        setProject(proj);
        setJobs(jobList);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load project"))
      .finally(() => setLoading(false));
  }, [projectId, token]);

  if (!hasHydrated || !token) return null;
  if (loading) return <div className="min-h-screen bg-brand-bg pt-20 px-6">Loading…</div>;
  if (error) return <div className="min-h-screen bg-brand-bg pt-20 px-6 text-status-error">{error}</div>;
  if (!project) return <div className="min-h-screen bg-brand-bg pt-20 px-6 text-status-error">Project not found</div>;

  return (
    <div className="min-h-screen bg-brand-bg pt-20">
      <div className="mx-auto max-w-[1100px] px-10 py-12">
        <Link href="/dashboard" className="mb-6 inline-block text-sm text-brand-subtle hover:text-brand-text no-underline">
          ← Back to dashboard
        </Link>

        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <p className="mb-2 font-sans text-[0.6875rem] font-medium uppercase tracking-widest text-brand-accent">
              PROJECT
            </p>
            <h1 className="font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold leading-[1.1] tracking-tight text-brand-text">
              {project.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {project.target_languages.map((lang) => (
                <span key={lang} className="rounded-full bg-brand-accentMid px-3 py-1 text-xs font-medium text-brand-accent">
                  {getLanguageDisplayName(lang)}
                </span>
              ))}
              <span className="rounded-full bg-brand-bg px-3 py-1 text-xs font-medium text-brand-muted">
                {project.default_tone.charAt(0).toUpperCase() + project.default_tone.slice(1)} tone
              </span>
              <span className="text-xs text-brand-subtle">
                {project.document_count} {project.document_count === 1 ? "document" : "documents"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openTranslationModal(projectId)}
            className="shrink-0 rounded-full bg-brand-accent px-5 py-2 font-sans text-sm font-medium text-white hover:bg-brand-accentHov"
          >
            + New Translation
          </button>
        </div>

        {/* Translation Jobs */}
        <div>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="font-display text-lg font-bold text-brand-text">Translations</h2>
            <div className="h-0.5 w-8 rounded-sm bg-brand-accent" />
          </div>

          {jobs.length === 0 ? (
            <div className="rounded-lg border border-brand-border bg-brand-surface px-8 py-16 text-center">
              <p className="font-display text-lg font-bold text-brand-text">No translations yet</p>
              <p className="mt-1 font-sans text-sm text-brand-muted">
                Upload a document to get started.
              </p>
              <button
                type="button"
                onClick={() => openTranslationModal(projectId)}
                className="mt-4 rounded-full bg-brand-accent px-5 py-2 font-sans text-sm font-medium text-white hover:bg-brand-accentHov"
              >
                Upload a document
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-brand-border bg-brand-surface">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-brand-border">
                    {["Document", "Language", "Status", "Created"].map((col) => (
                      <th
                        key={col}
                        className="px-5 py-3 text-left font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-brand-subtle"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => {
                    const label = statusLabel(job.status);
                    const isProcessing = PROCESSING_STATUSES.has(job.status);
                    return (
                      <tr
                        key={job.id}
                        className={isProcessing
                          ? "cursor-not-allowed opacity-60"
                          : "cursor-pointer transition-colors hover:bg-brand-bg"
                        }
                      >
                        <td className="px-5 py-3.5 font-sans text-sm font-medium text-brand-text">
                          {isProcessing ? (
                            job.document_name ?? `Job #${job.id}`
                          ) : (
                            <Link
                              href={`/translation-jobs/${job.id}/overview`}
                              className="text-brand-text no-underline hover:underline"
                            >
                              {job.document_name ?? `Job #${job.id}`}
                            </Link>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-sans text-[0.8125rem] text-brand-muted">
                          {(job.source_language ?? "EN").substring(0, 2).toUpperCase()} → {job.target_language.substring(0, 2).toUpperCase()}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 font-sans text-[0.6875rem] font-medium ${statusBadgeClasses(label)}`}>
                            {label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-sans text-xs text-brand-subtle">
                          {new Date(job.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal — needs projects list for selector */}
      <NewTranslationModal projects={project ? [project] : []} />
    </div>
  );
}
