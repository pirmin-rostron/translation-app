"use client";

/**
 * Projects overview page — workspace stat tiles, richer project cards with
 * auto-derived status badges, stats rows, and progress bars.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { useDashboardStore } from "../stores/dashboardStore";
import { useProjects } from "../hooks/queries";
import { projectsApi } from "../services/api";
import type { ProjectResponse, ProjectStatsResponse } from "../services/api";
import { AppShell } from "../components/AppShell";
import { PageHeader } from "../components/PageHeader";
import { getLanguageDisplayName, getLanguageFlag } from "../utils/language";
import { NewProjectModal } from "../dashboard/NewProjectModal";

// ── Status badge logic (auto-derived from project data) ─────────────────────

type ProjectBadge = { label: string; classes: string };

function deriveStatusBadge(p: ProjectResponse, stats: ProjectStatsResponse | undefined): ProjectBadge {
  if (p.document_count === 0) {
    return { label: "No documents", classes: "bg-brand-bg text-brand-subtle" };
  }
  // Completed: all jobs are done
  if (stats && stats.total_jobs > 0 && stats.completed_count >= stats.total_jobs) {
    return { label: "✓ Completed", classes: "bg-status-successBg text-status-success" };
  }
  // Overdue
  if (p.due_date) {
    const due = new Date(p.due_date);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return { label: "Overdue", classes: "bg-status-errorBg text-status-error" };
    }
    if (diffDays <= 7) {
      return { label: "⚠ Due soon", classes: "bg-status-warningBg text-status-warning" };
    }
  }
  return { label: "In progress", classes: "bg-status-infoBg text-status-info" };
}

export default function ProjectsPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const openProjectModal = useDashboardStore((s) => s.openProjectModal);
  const { data: projects, isLoading } = useProjects();

  // Fetch stats for all projects in parallel
  const [statsMap, setStatsMap] = useState<Record<number, ProjectStatsResponse>>({});
  useEffect(() => {
    if (!projects || projects.length === 0) return;
    const fetchAll = async () => {
      const results = await Promise.all(
        projects.map(async (p) => {
          try {
            const s = await projectsApi.stats(p.id);
            return [p.id, s] as const;
          } catch {
            return [p.id, null] as const;
          }
        })
      );
      const map: Record<number, ProjectStatsResponse> = {};
      for (const [id, s] of results) {
        if (s) map[id] = s;
      }
      setStatsMap(map);
    };
    void fetchAll();
  }, [projects]);

  useEffect(() => {
    if (hasHydrated && !token) router.replace("/login");
  }, [hasHydrated, token, router]);

  if (!hasHydrated || !token) return null;

  const projectList = projects ?? [];
  const totalProjects = projectList.length;
  const totalDocs = projectList.reduce((sum, p) => sum + p.document_count, 0);
  const totalInReview = Object.values(statsMap).reduce((sum, s) => sum + s.in_review_count, 0);
  const totalJobs = Object.values(statsMap).reduce((sum, s) => sum + s.total_jobs, 0);
  const totalCompleted = Object.values(statsMap).reduce((sum, s) => sum + s.completed_count, 0);
  const overallProgress = totalJobs > 0 ? Math.round((totalCompleted / totalJobs) * 100) : 0;

  return (
    <AppShell>
      <div className="px-8 py-8">
        <PageHeader
          eyebrow="Workspace"
          title="Projects"
          action={
            <button
              type="button"
              onClick={openProjectModal}
              className="rounded-full bg-brand-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-accentHov transition-colors"
            >
              + New Project
            </button>
          }
        />

        {/* Workspace stat tiles — always shown */}
        <div className="mb-6 grid grid-cols-4 gap-3">
          <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
            <p className="text-xs font-medium text-brand-muted">Total Projects</p>
            <p className="mt-1 font-display text-2xl font-bold text-brand-text">{totalProjects}</p>
            <p className="mt-0.5 text-[0.6875rem] text-brand-subtle">
              {totalProjects === 0 ? "Create your first project" : `${totalProjects} ${totalProjects === 1 ? "project" : "projects"}`}
            </p>
          </div>
          <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
            <p className="text-xs font-medium text-brand-muted">Total Documents</p>
            <p className={`mt-1 font-display text-2xl font-bold ${totalDocs > 0 ? "text-brand-text" : "text-brand-subtle"}`}>{totalDocs}</p>
            <p className="mt-0.5 text-[0.6875rem] text-brand-subtle">
              {totalDocs === 0 ? "No documents yet" : `Across ${totalProjects} projects`}
            </p>
          </div>
          <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
            <p className="text-xs font-medium text-brand-muted">In Review</p>
            <p className={`mt-1 font-display text-2xl font-bold ${totalInReview > 0 ? "text-brand-accent" : "text-brand-subtle"}`}>{totalInReview}</p>
            <p className="mt-0.5 text-[0.6875rem] text-brand-subtle">Awaiting approval</p>
          </div>
          <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
            <p className="text-xs font-medium text-brand-muted">Overall Progress</p>
            <p className={`mt-1 font-display text-2xl font-bold ${overallProgress > 0 ? "text-brand-text" : "text-brand-subtle"}`}>
              {totalJobs > 0 ? `${overallProgress}%` : "—"}
            </p>
            <div className="mt-2 h-[3px] w-full rounded-full bg-brand-border">
              <div className="h-full rounded-full bg-brand-accent transition-all duration-500" style={{ width: `${overallProgress}%` }} />
            </div>
          </div>
        </div>

        {isLoading && <p className="text-sm text-brand-muted">Loading…</p>}

        {/* Section header — always shown */}
        {!isLoading && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-lg font-bold text-brand-text">All Projects</h2>
                <div className="h-0.5 w-8 rounded-sm bg-brand-accent" />
              </div>
              <span className="text-sm text-brand-muted">{totalProjects} {totalProjects === 1 ? "project" : "projects"}</span>
            </div>

            {projectList.length === 0 ? (
              /* Empty state — dashed card */
              <div className="rounded-xl border-2 border-dashed border-brand-border bg-brand-surface px-8 py-16 text-center">
                <div className="mb-3 text-4xl">📁</div>
                <p className="font-display text-lg font-bold text-brand-text">No projects yet</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-brand-muted">
                  Create a project to organise your translations by client, campaign, or topic.
                </p>
                <button
                  type="button"
                  onClick={openProjectModal}
                  className="mt-5 rounded-full bg-brand-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-accentHov transition-colors"
                >
                  + Create first project
                </button>
              </div>
            ) : (
              /* Project cards grid */
              <div className="grid grid-cols-2 gap-4">
                {projectList.map((p) => {
                  const s = statsMap[p.id];
                  const badge = deriveStatusBadge(p, s);
                  const progressPct = s && s.total_jobs > 0 ? Math.round((s.completed_count / s.total_jobs) * 100) : 0;

                  return (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className="group flex flex-col rounded-xl border border-brand-border bg-brand-surface p-6 no-underline transition-colors hover:border-brand-accent"
                    >
                      {/* Header: name + status badge */}
                      <div className="flex items-start justify-between">
                        <p className="font-display text-lg font-semibold text-brand-text group-hover:text-brand-accent">{p.name}</p>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.6875rem] font-medium ${badge.classes}`}>
                          {badge.label}
                        </span>
                      </div>

                      {/* Description — always 2-line height */}
                      <div className="mt-2 h-10">
                        {p.description ? (
                          <p className="line-clamp-2 text-sm text-brand-muted">{p.description}</p>
                        ) : (
                          <p className="text-sm italic text-brand-subtle">No description added</p>
                        )}
                      </div>

                      {/* Language pills */}
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {p.target_languages.map((lang) => (
                          <span key={lang} className="rounded-full bg-brand-accentMid px-2 py-0.5 text-xs font-medium text-brand-accent">
                            {getLanguageFlag(lang)} {getLanguageDisplayName(lang)}
                          </span>
                        ))}
                      </div>

                      {/* Stats row */}
                      <div className="mt-4 grid grid-cols-4 border-t border-brand-border pt-3 text-center">
                        <div>
                          <p className={`font-display text-lg font-bold ${p.document_count > 0 ? "text-brand-text" : "text-brand-subtle"}`}>
                            {p.document_count}
                          </p>
                          <p className="text-[0.6875rem] text-brand-subtle">Documents</p>
                        </div>
                        <div>
                          <p className={`font-display text-lg font-bold ${s && s.total_words > 0 ? "text-brand-text" : "text-brand-subtle"}`}>
                            {(s?.total_words ?? 0).toLocaleString()}
                          </p>
                          <p className="text-[0.6875rem] text-brand-subtle">Words</p>
                        </div>
                        <div>
                          <p className={`font-display text-lg font-bold ${s && s.completed_count > 0 ? "text-status-success" : "text-brand-subtle"}`}>
                            {s?.completed_count ?? 0}
                          </p>
                          <p className="text-[0.6875rem] text-brand-subtle">Completed</p>
                        </div>
                        <div>
                          <p className={`font-display text-lg font-bold ${s && s.in_review_count > 0 ? "text-brand-accent" : "text-brand-subtle"}`}>
                            {s?.in_review_count ?? 0}
                          </p>
                          <p className="text-[0.6875rem] text-brand-subtle">In Review</p>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3">
                        {p.document_count === 0 ? (
                          <p className="text-xs text-brand-subtle">No documents yet — upload to get started</p>
                        ) : (
                          <div>
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-[0.6875rem] text-brand-subtle">Progress</span>
                              <span className="text-[0.6875rem] font-medium text-brand-text">{progressPct}%</span>
                            </div>
                            <div className="h-[3px] w-full rounded-full bg-brand-border">
                              <div className="h-full rounded-full bg-brand-accent transition-all duration-500" style={{ width: `${progressPct}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      <NewProjectModal />
    </AppShell>
  );
}
