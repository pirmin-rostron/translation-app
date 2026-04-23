"use client";

/**
 * Dashboard — "What needs me right now"
 * Autopilot live panel uses real job data. Attention queue shows review jobs
 * with document/project context. Activity feed and some insights metrics
 * require new backend endpoints (see Linear ticket TODOs).
 */

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../stores/authStore";
import { useDashboardStore } from "../stores/dashboardStore";
import { useProjects, useOrgStats, useGlossaryTerms, useDocuments } from "../hooks/queries";
import { translationJobsApi, queryKeys } from "../services/api";
import type { ProjectResponse, PaginatedJobsResponse, TranslationJobListItem } from "../services/api";
import { AppShell } from "../components/AppShell";
import { NewTranslationModal } from "./NewTranslationModal";
import { NewProjectModal } from "./NewProjectModal";
import { Icons } from "../components/Icons";
import { getLanguageCode } from "../utils/language";

// ── Processing status helpers ───────────────────────────────────────────────

const PROCESSING_STATUSES = new Set([
  "queued", "parsing", "translating", "translation_queued",
]);

const REVIEW_STATUSES = new Set(["in_review", "review"]);

function isProcessing(status: string): boolean {
  return PROCESSING_STATUSES.has(status);
}

function jobProgress(j: TranslationJobListItem): number {
  if (!j.progress_total_segments || j.progress_total_segments === 0) return 0;
  return Math.round((j.progress_completed_segments / j.progress_total_segments) * 100);
}

function estimateEta(j: TranslationJobListItem): string {
  const pct = jobProgress(j);
  if (pct >= 95) return "<1 min";
  if (pct >= 70) return "~1 min";
  if (pct >= 40) return "~3 min";
  return "~5 min";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCell({ label, value, hint, accent, divider }: {
  label: string; value: string | number; hint: string; accent?: boolean; divider?: boolean;
}) {
  return (
    <div className={`relative px-6 py-5 ${divider ? "border-l border-brand-borderSoft" : ""}`}>
      <p className="m-0 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-subtle">{label}</p>
      <p className={`m-0 mt-2.5 font-display text-[2.25rem] font-semibold leading-none tracking-display ${accent ? "text-brand-accent" : "text-brand-text"}`}>
        {value}
      </p>
      <p className="m-0 mt-2 text-xs text-brand-subtle">{hint}</p>
    </div>
  );
}

function PanelHeader({ title, subtitle, right }: {
  title: React.ReactNode; subtitle?: string; right?: React.ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
      <div>
        <h2 className="m-0 font-display text-[1.0625rem] font-semibold tracking-display text-brand-text">{title}</h2>
        {subtitle && <p className="m-0 mt-0.5 text-xs text-brand-subtle">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

function EmptyPanelRow({ text }: { text: string }) {
  return <li className="px-5 py-4 text-sm text-brand-subtle">{text}</li>;
}

// ── Skeleton components ───────────────────────────────────────────────────

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-brand-sunken ${className ?? "h-4 w-24"}`} />;
}

function StatsSkeleton() {
  return (
    <section className="mb-8 grid grid-cols-4 gap-0 overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`px-6 py-5 ${i > 0 ? "border-l border-brand-borderSoft" : ""}`}>
          <SkeletonBlock className="mb-3 h-3 w-20" />
          <SkeletonBlock className="mb-2 h-9 w-14" />
          <SkeletonBlock className="h-3 w-16" />
        </div>
      ))}
    </section>
  );
}

function PanelSkeleton() {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
      <div className="px-5 pb-3 pt-4">
        <SkeletonBlock className="mb-2 h-4 w-32" />
        <SkeletonBlock className="h-3 w-48" />
      </div>
      <ul className="m-0 list-none divide-y divide-brand-borderSoft p-0">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center gap-3 px-5 py-4">
            <SkeletonBlock className="h-4 w-full max-w-[200px]" />
            <SkeletonBlock className="ml-auto h-4 w-12" />
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Attention Panel ─────────────────────────────────────────────────────────

function AttentionPanel({ reviewJobs }: { reviewJobs: TranslationJobListItem[] }) {
  const router = useRouter();
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
      <PanelHeader
        title="Needs your attention"
        subtitle="Blocks flagged by Autopilot across all projects"
        right={
          reviewJobs.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-accentSoft px-2.5 py-1 text-xs font-semibold text-brand-accent">
              <Icons.Sparkle className="h-3 w-3" />{reviewJobs.length}
            </span>
          ) : undefined
        }
      />
      <ul className="m-0 list-none divide-y divide-brand-borderSoft p-0">
        {reviewJobs.length === 0 ? (
          <>
            {[
              { name: "Contract_Draft_v2.docx", project: "Legal Q2", pair: "EN → DE" },
              { name: "Product_Brochure.docx", project: "Marketing", pair: "EN → FR" },
              { name: "Terms_of_Service.rtf", project: "Legal Q2", pair: "EN → ES" },
            ].map((stub) => (
              <li key={stub.name} className="flex items-center gap-3 px-5 py-3.5 opacity-40">
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-medium text-brand-subtle">{stub.name}</p>
                  <p className="m-0 mt-0.5 flex items-center gap-2 text-[0.6875rem] text-brand-hint">
                    <span>{stub.project}</span>
                    <span className="font-mono">{stub.pair}</span>
                    <span>—</span>
                  </p>
                </div>
                <Icons.Arrow className="h-4 w-4 shrink-0 text-brand-hint" />
              </li>
            ))}
            <li className="px-5 py-3 text-center text-[0.6875rem] text-brand-subtle">
              Waiting for Autopilot to flag blocks
            </li>
          </>
        ) : (
          reviewJobs.slice(0, 6).map((j) => (
            <li key={j.id}>
              <button
                type="button"
                onClick={() => router.push(`/translation-jobs/${j.id}`)}
                className="group flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-brand-sunken/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-medium text-brand-text">
                    {j.document_name ?? `Job #${j.id}`}
                  </p>
                  <p className="m-0 mt-0.5 flex items-center gap-2 text-[0.6875rem] text-brand-subtle">
                    {j.project_name && <span>{j.project_name}</span>}
                    <span className="font-mono">{getLanguageCode(j.source_language)} → {getLanguageCode(j.target_language)}</span>
                    <span>{timeAgo(j.created_at)}</span>
                  </p>
                </div>
                <Icons.Arrow className="h-4 w-4 shrink-0 text-brand-hint transition-all group-hover:translate-x-0.5 group-hover:text-brand-text" />
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

// ── Autopilot Panel (real data) ─────────────────────────────────────────────

function AutopilotPanel({ processingJobs }: { processingJobs: TranslationJobListItem[] }) {
  const router = useRouter();

  if (processingJobs.length === 0) {
    return (
      <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
        <PanelHeader title="Autopilot" subtitle="No jobs running" />
        <ul className="m-0 list-none p-0">
          <EmptyPanelRow text="All translations are complete or queued." />
        </ul>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-brand-accent/15 bg-brand-surface shadow-card">
      <PanelHeader
        title={
          <span className="flex items-center gap-2">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-accent opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-accent" />
            </span>
            Autopilot running
          </span>
        }
        subtitle={`${processingJobs.length} ${processingJobs.length === 1 ? "job" : "jobs"} · live`}
        right={
          <button
            type="button"
            onClick={() => router.push("/autopilot")}
            className="flex items-center gap-1 text-xs font-medium text-brand-muted transition-colors hover:text-brand-text"
          >
            Open Autopilot <Icons.Arrow className="h-3.5 w-3.5" />
          </button>
        }
      />
      <ul className="relative m-0 list-none px-5 pb-4 pt-0">
        {processingJobs.map((j) => {
          const pct = jobProgress(j);
          const pair = `${getLanguageCode(j.source_language)} → ${getLanguageCode(j.target_language)}`;
          return (
            <li key={j.id} className="grid grid-cols-[1fr_56px_120px_60px] items-center gap-4 border-t border-brand-borderSoft py-3 first:border-t-0">
              <div className="min-w-0">
                <p className="m-0 truncate text-sm font-medium text-brand-text">{j.document_name ?? `Job #${j.id}`}</p>
                <p className="m-0 mt-0.5 font-mono text-[0.6875rem] text-brand-subtle">{pair}</p>
              </div>
              <span className="text-right font-mono text-xs font-medium tabular-nums text-brand-muted">{pct}%</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-brand-sunken">
                <div
                  className="h-full rounded-full bg-brand-accent transition-[width] duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-right text-[0.6875rem] text-brand-subtle">{estimateEta(j)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Pinned Panel ────────────────────────────────────────────────────────────

function PinnedPanel({ recentProjects, allJobs }: { recentProjects: ProjectResponse[]; allJobs: TranslationJobListItem[] }) {
  const router = useRouter();
  const openProjectModal = useDashboardStore((s) => s.openProjectModal);

  // Count review jobs per project
  const reviewByProject = useMemo(() => {
    const map = new Map<number, number>();
    for (const j of allJobs) {
      if (REVIEW_STATUSES.has(j.status) && j.project_id) {
        map.set(j.project_id, (map.get(j.project_id) ?? 0) + 1);
      }
    }
    return map;
  }, [allJobs]);

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
      <PanelHeader
        title="Pinned"
        right={
          <button
            type="button"
            onClick={() => router.push("/projects")}
            className="flex items-center gap-1 text-xs font-medium text-brand-muted transition-colors hover:text-brand-text"
          >
            All projects <Icons.Arrow className="h-3.5 w-3.5" />
          </button>
        }
      />
      <ul className="m-0 list-none divide-y divide-brand-borderSoft p-0">
        {recentProjects.length === 0 ? (
          <li className="px-5 py-6 text-center">
            <p className="m-0 text-sm text-brand-muted">No pinned projects yet</p>
            <p className="m-0 mt-1 text-xs text-brand-subtle">Create a project to get started.</p>
            <button
              type="button"
              onClick={openProjectModal}
              className="mt-3 rounded-full bg-brand-accent px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-accentHov"
            >
              + New project
            </button>
          </li>
        ) : (
          recentProjects.map((p) => {
            const reviewCount = reviewByProject.get(p.id) ?? 0;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className="group flex w-full flex-col gap-2 px-5 py-4 text-left transition-colors hover:bg-brand-sunken/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="m-0 line-clamp-1 text-sm font-medium text-brand-text">{p.name}</p>
                    <div className="flex shrink-0 items-center gap-2">
                      {reviewCount > 0 && (
                        <span className="rounded-full bg-brand-accentMid px-2 py-0.5 text-[0.625rem] font-semibold text-brand-accent">
                          {reviewCount} review
                        </span>
                      )}
                      <Icons.Arrow className="h-4 w-4 text-brand-hint transition-all group-hover:translate-x-0.5 group-hover:text-brand-text" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[0.6875rem] text-brand-subtle">
                    <span>{p.document_count} {p.document_count === 1 ? "doc" : "docs"}</span>
                  </div>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}

// ── Insights Panel (partial real data) ──────────────────────────────────────
// Glossary term count is real. The other three metrics need a new endpoint.
// TODO: PIR-132 — Backend: GET /dashboard/insights-summary

function InsightsPanel({ glossaryCount }: { glossaryCount: number }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
      <PanelHeader title="Linguistic insights" subtitle="This week" />
      <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-brand-borderSoft border-t border-brand-borderSoft">
        <InsightCell label="Glossary terms" value={glossaryCount} hint="total active" />
        <InsightCell label="Term conflicts" value={0} hint="needs review" />
        <InsightCell label="Memory matches" value={0} hint="blocks reused" />
        <InsightCell label="Ambiguity rate" value="0.0%" hint="of all blocks" />
      </div>
    </section>
  );
}

function InsightCell({ label, value, hint }: {
  label: string; value: string | number; hint: string;
}) {
  return (
    <div className="px-5 py-4">
      <p className="m-0 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-subtle">{label}</p>
      <p className="m-0 mt-2 font-display text-[1.625rem] font-semibold leading-none tracking-display text-brand-text">
        {value}
      </p>
      <p className="m-0 mt-1.5 text-[0.6875rem] text-brand-subtle">{hint}</p>
    </div>
  );
}

// ── Activity Panel ──────────────────────────────────────────────────────────
// TODO: Backend: GET /dashboard/activity-feed?limit=10

function ActivityPanel() {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
      <PanelHeader title="Recent activity" subtitle="Last 24 hours" />
      <ul className="m-0 list-none divide-y divide-brand-borderSoft border-t border-brand-borderSoft p-0">
        {[
          { icon: "✓", text: "Translation job completed", detail: "Autopilot" },
          { icon: "⚡", text: "2 ambiguities flagged for review", detail: "Autopilot" },
          { icon: "↻", text: "Memory match applied to 3 blocks", detail: "Autopilot" },
          { icon: "📄", text: "Upload a document to see activity here", detail: "" },
        ].map((item) => (
          <li key={item.text} className="flex items-center gap-3 px-5 py-3 opacity-40">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-sunken text-[0.625rem] text-brand-subtle">
              {item.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-sm text-brand-subtle">{item.text}</p>
            </div>
            {item.detail && (
              <span className="shrink-0 text-[0.6875rem] text-brand-hint">{item.detail}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const openTranslationModal = useDashboardStore((s) => s.openTranslationModal);
  const openProjectModal = useDashboardStore((s) => s.openProjectModal);
  const projectModalOpen = useDashboardStore((s) => s.projectModalOpen);
  const translationModalOpen = useDashboardStore((s) => s.translationModalOpen);
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: documents = [] } = useDocuments();
  const { data: orgStats } = useOrgStats();
  const { data: glossaryTerms } = useGlossaryTerms();

  // Pause polling while a modal is open to prevent re-renders that clear modal inputs
  const anyModalOpen = projectModalOpen || translationModalOpen;

  // Fetch all jobs to derive processing and review counts
  const { data: jobsData, isLoading: jobsLoading } = useQuery<PaginatedJobsResponse>({
    queryKey: [...queryKeys.translationJobs.all(), "dashboard"],
    queryFn: () => translationJobsApi.listPaginated(1, 200),
    staleTime: 10_000,
    refetchInterval: anyModalOpen ? false : 15_000,
  });

  const allJobs = jobsData?.jobs ?? [];
  const isLoading = projectsLoading || jobsLoading;

  const processingJobs = useMemo(
    () => allJobs.filter((j) => isProcessing(j.status)),
    [allJobs],
  );

  const reviewJobs = useMemo(
    () => allJobs.filter((j) => REVIEW_STATUSES.has(j.status)),
    [allJobs],
  );

  const displayName = user?.full_name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "User";

  const totalActiveProjects = projects.filter((p) => p.document_count > 0).length;
  const totalWords = orgStats?.total_words_translated ?? 0;
  const glossaryCount = glossaryTerms?.length ?? 0;

  // Show most recent projects until pinned field is implemented
  const recentProjects = useMemo(
    () => [...projects].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ).slice(0, 3),
    [projects],
  );

  // Build subhead from real data
  const topProjects = useMemo(() => {
    if (reviewJobs.length === 0) return null;
    const projectNames = new Map<string, number>();
    for (const j of reviewJobs) {
      if (j.project_name) {
        projectNames.set(j.project_name, (projectNames.get(j.project_name) ?? 0) + 1);
      }
    }
    return [...projectNames.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([name]) => name);
  }, [reviewJobs]);

  // Full-page empty state — only for brand new users with zero everything
  if (!isLoading && projects.length === 0 && allJobs.length === 0 && documents.length === 0) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-10 py-20 text-center">
          <h1 className="m-0 font-display text-[2.5rem] font-bold tracking-display text-brand-text">
            Welcome to Helvara
          </h1>
          <p className="m-0 mt-3 max-w-md text-[0.9375rem] leading-relaxed text-brand-muted">
            Start by creating your first project — group documents and target languages together.
          </p>
          <button
            type="button"
            onClick={openProjectModal}
            className="mt-6 rounded-full bg-brand-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-accentHov"
          >
            Create your first project
          </button>
        </div>
        <NewProjectModal />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px] px-10 py-10">
        {/* Header */}
        <header className="mb-8 flex items-end justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-brand-border bg-brand-surface px-2.5 py-1 text-[0.6875rem] font-medium text-brand-muted shadow-card">
              {processingJobs.length > 0 ? (
                <>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-accent opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-accent" />
                  </span>
                  <span>{processingJobs.length} Autopilot {processingJobs.length === 1 ? "job" : "jobs"} running</span>
                </>
              ) : (
                <>
                  <span className="flex h-1.5 w-1.5 rounded-full bg-brand-subtle" />
                  <span>Autopilot idle</span>
                </>
              )}
            </div>
            <h1 className="m-0 whitespace-nowrap font-display text-[2.75rem] font-semibold leading-[1.05] tracking-display text-brand-text">
              {getGreeting()}, <span className="italic text-brand-accent">{displayName}</span>
            </h1>
            <p className="m-0 mt-3 max-w-lg text-[0.9375rem] leading-relaxed text-brand-muted">
              {reviewJobs.length === 0
                ? "All caught up — no blocks need your attention."
                : (
                  <>
                    {reviewJobs.length} {reviewJobs.length === 1 ? "job is" : "jobs are"} waiting on you
                    {topProjects && topProjects.length > 0 && (
                      <>
                        {" — mostly in "}
                        {topProjects.map((name, i) => (
                          <span key={name}>
                            {i > 0 && " and "}
                            <span className="font-medium text-brand-text">{name}</span>
                          </span>
                        ))}
                      </>
                    )}
                    .
                  </>
                )
              }
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={openProjectModal}
              className="rounded-full border border-brand-border bg-brand-surface px-4 py-2 text-[0.8125rem] font-medium text-brand-text shadow-card transition-all hover:border-brand-text hover:shadow-raised"
            >
              New project
            </button>
            <button
              type="button"
              onClick={() => openTranslationModal()}
              className="flex items-center gap-1.5 rounded-full bg-brand-text px-4 py-2 text-[0.8125rem] font-medium text-white shadow-card transition-all hover:bg-brand-accent"
            >
              <Icons.Plus className="h-3.5 w-3.5" /> New translation
            </button>
          </div>
        </header>

        {/* Stats row — skeleton while loading */}
        {isLoading ? (
          <StatsSkeleton />
        ) : (
          <section className="mb-8 grid grid-cols-4 gap-0 overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
            <StatCell label="Active projects" value={totalActiveProjects} hint={`of ${projects.length} total`} />
            <StatCell label="In progress" value={processingJobs.length} hint={`${allJobs.length} total jobs`} divider />
            <StatCell label="Needs review" value={reviewJobs.length} hint="across all projects" accent divider />
            <StatCell label="Words this month" value={totalWords > 1000 ? (totalWords / 1000).toFixed(1) + "k" : String(totalWords)} hint="via Autopilot" divider />
          </section>
        )}

        {/* Two-column main */}
        {isLoading ? (
          <div className="grid grid-cols-[1.5fr_1fr] gap-6">
            <div className="flex flex-col gap-6">
              <PanelSkeleton />
              <PanelSkeleton />
            </div>
            <div className="flex flex-col gap-6">
              <PanelSkeleton />
              <PanelSkeleton />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[1.5fr_1fr] gap-6">
            <div className="flex flex-col gap-6">
              <AttentionPanel reviewJobs={reviewJobs} />
              <AutopilotPanel processingJobs={processingJobs} />
            </div>
            <div className="flex flex-col gap-6">
              <PinnedPanel recentProjects={recentProjects} allJobs={allJobs} />
              <InsightsPanel glossaryCount={glossaryCount} />
              <ActivityPanel />
            </div>
          </div>
        )}
      </div>

      <NewTranslationModal projects={projects} />
      <NewProjectModal />
    </AppShell>
  );
}
