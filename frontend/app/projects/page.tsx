"use client";

/**
 * Projects page — grouped/containerized view of work. Stat strip, filter bar,
 * and 2-column card grid with hover effects and progress bars.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../stores/authStore";
import { useDashboardStore } from "../stores/dashboardStore";
import { useProjects } from "../hooks/queries";
import { projectsApi } from "../services/api";
import type { ProjectResponse, ProjectStatsResponse } from "../services/api";
import { AppShell } from "../components/AppShell";
import { NewProjectModal } from "../dashboard/NewProjectModal";
import { Icons } from "../components/Icons";
import { getLanguageCode, getLanguageDisplayName } from "../utils/language";

// ── Status badge derivation ─────────────────────────────────────────────────

type ProjectBadge = { label: string; classes: string };

function deriveStatusBadge(p: ProjectResponse, stats: ProjectStatsResponse | undefined): ProjectBadge {
  if (p.document_count === 0) {
    return { label: "No documents", classes: "bg-brand-bg text-brand-subtle" };
  }
  if (stats && stats.total_jobs > 0 && stats.completed_count >= stats.total_jobs) {
    return { label: "Completed", classes: "bg-status-successBg text-status-success" };
  }
  if (p.due_date) {
    const due = new Date(p.due_date);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: "Overdue", classes: "bg-status-errorBg text-status-error" };
    if (diffDays <= 7) return { label: "Due soon", classes: "bg-status-warningBg text-status-warning" };
  }
  return { label: "In progress", classes: "bg-status-infoBg text-status-info" };
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatTile({ label, value, valueClass, meta, progress, divider }: {
  label: string;
  value: string | number;
  valueClass?: string;
  meta: string | null;
  progress?: number;
  divider?: boolean;
}) {
  const isZero = value === 0 || value === "0%" || value === "—";
  return (
    <div className={`px-6 py-5 ${divider ? "border-l border-brand-borderSoft" : ""}`}>
      <p className="m-0 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-subtle">{label}</p>
      <p className={`m-0 mt-2.5 font-display text-[2rem] font-semibold leading-none tracking-display ${isZero ? "text-brand-subtle" : (valueClass ?? "text-brand-text")}`}>
        {value}
      </p>
      {meta && <p className="m-0 mt-2 text-xs text-brand-subtle">{meta}</p>}
      {typeof progress === "number" && (
        <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-brand-sunken">
          <div className="h-full rounded-full bg-brand-text transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

function StatMicro({ value, label, tone = "default" }: {
  value: string | number; label: string; tone?: "default" | "success" | "accent";
}) {
  const zero = value === 0 || value === "0";
  const cls = zero ? "text-brand-subtle"
    : tone === "success" ? "text-emerald-700"
    : tone === "accent" ? "text-brand-accent"
    : "text-brand-text";
  return (
    <div className="text-center">
      <p className={`m-0 font-display text-[1.125rem] font-semibold leading-none ${cls}`}>{value}</p>
      <p className="m-0 mt-1 text-[0.625rem] uppercase tracking-wider text-brand-subtle">{label}</p>
    </div>
  );
}

function ProjectCard({ project, stats, onOpen }: {
  project: ProjectResponse;
  stats: ProjectStatsResponse | undefined;
  onOpen: () => void;
}) {
  const badge = deriveStatusBadge(project, stats);
  const totalJobs = stats?.total_jobs ?? 0;
  const completedCount = stats?.completed_count ?? 0;
  const inReviewCount = stats?.in_review_count ?? 0;
  const totalWords = stats?.total_words ?? 0;
  const pct = totalJobs > 0 ? Math.round((completedCount / totalJobs) * 100) : 0;

  return (
    <button
      onClick={onOpen}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-brand-border bg-brand-surface p-6 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-raised"
    >
      {/* Accent rail on hover */}
      <span className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-brand-accent opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="m-0 line-clamp-1 font-display text-[1.25rem] font-semibold leading-tight tracking-display text-brand-text">
            {project.name}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium ${badge.classes}`}>
          {badge.label}
        </span>
      </div>

      <div className="mt-2 h-10">
        {project.description ? (
          <p className="m-0 line-clamp-2 text-[0.8125rem] leading-relaxed text-brand-muted">{project.description}</p>
        ) : (
          <p className="m-0 text-[0.8125rem] italic text-brand-subtle">No description added</p>
        )}
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
        {project.target_languages.map((l) => (
          <span key={l} className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-sunken/60 px-2 py-0.5 text-[0.6875rem] font-medium text-brand-muted">
            <span className="font-mono text-brand-text">{getLanguageCode(l)}</span>
            <span>{getLanguageDisplayName(l).replace(/\s*\(.+\)$/, "")}</span>
          </span>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2 rounded-xl bg-brand-sunken/50 p-3">
        <StatMicro value={project.document_count} label="Docs" />
        <StatMicro value={totalWords.toLocaleString()} label="Words" />
        <StatMicro value={completedCount} label="Done" tone="success" />
        <StatMicro value={inReviewCount} label="Review" tone="accent" />
      </div>

      <div className="mt-4">
        {project.document_count === 0 ? (
          <p className="m-0 text-[0.6875rem] text-brand-subtle">No documents yet — upload to get started</p>
        ) : (
          <>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[0.6875rem] text-brand-subtle">Progress</span>
              <span className="font-mono text-[0.6875rem] font-medium tabular-nums text-brand-text">{pct}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-brand-sunken">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-accent to-brand-accentHov transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        )}
      </div>
    </button>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const openProjectModal = useDashboardStore((s) => s.openProjectModal);
  const { data: projects } = useProjects();

  const [filter, setFilter] = useState("all");

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

  const filtered = projectList.filter((p) => {
    const s = statsMap[p.id];
    if (filter === "active") return s && s.total_jobs > 0 && s.completed_count < s.total_jobs;
    if (filter === "completed") return s && s.total_jobs > 0 && s.completed_count >= s.total_jobs;
    if (filter === "empty") return p.document_count === 0;
    return true;
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px] px-10 py-10">
        {/* Header */}
        <header className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="m-0 mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-brand-subtle">
              Workspace
            </p>
            <h1 className="m-0 font-display text-[2.5rem] font-semibold leading-[1.05] tracking-display text-brand-text">
              Projects
            </h1>
            <p className="m-0 mt-2.5 max-w-xl text-[0.9375rem] text-brand-muted">
              Containers for documents, target languages, and translation jobs.
            </p>
          </div>
          <button
            onClick={openProjectModal}
            className="flex items-center gap-1.5 rounded-full bg-brand-text px-4 py-2 text-[0.8125rem] font-medium text-white shadow-card transition-all hover:bg-brand-accent"
          >
            <Icons.Plus className="h-3.5 w-3.5" /> New project
          </button>
        </header>

        {/* Stat strip */}
        <section className="mb-8 grid grid-cols-4 gap-0 overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
          <StatTile label="Total projects" value={totalProjects} meta={`${projectList.filter(p => p.document_count > 0).length} active`} />
          <StatTile label="Documents" value={totalDocs} meta={`across ${totalProjects} projects`} divider />
          <StatTile label="In review" value={totalInReview} valueClass="text-brand-accent" meta="awaiting approval" divider />
          <StatTile label="Overall progress" value={`${overallProgress}%`} meta={null} progress={overallProgress} divider />
        </section>

        {/* Filter bar */}
        <div className="mb-5 flex items-center justify-between">
          <div className="inline-flex rounded-full border border-brand-border bg-brand-surface p-0.5 shadow-card">
            {([
              { k: "all", label: `All ${projectList.length}` },
              { k: "active", label: "Active" },
              { k: "completed", label: "Completed" },
              { k: "empty", label: "Empty" },
            ]).map((t) => (
              <button
                key={t.k}
                onClick={() => setFilter(t.k)}
                className={`rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors ${
                  filter === t.k ? "bg-brand-text text-white" : "text-brand-muted hover:text-brand-text"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-brand-subtle">{filtered.length} shown</span>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-2 gap-5">
          {filtered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              stats={statsMap[p.id]}
              onOpen={() => router.push(`/projects/${p.id}`)}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-brand-border bg-brand-surface p-10 text-center shadow-card">
            <p className="m-0 font-display text-lg font-semibold text-brand-text">No projects match</p>
            <p className="m-0 mt-1.5 text-sm text-brand-muted">Try a different filter.</p>
          </div>
        )}
      </div>

      <NewProjectModal />
    </AppShell>
  );
}
