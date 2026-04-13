"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { useDashboardStore } from "../stores/dashboardStore";
import { useDashboardTranslations, useTier, useProjects, useOrgStats, useUpcomingDeadlines } from "../hooks/queries";
import type { DashboardTranslation } from "../hooks/queries";
import { AppShell } from "../components/AppShell";
import { NewTranslationModal } from "./NewTranslationModal";
import { NewProjectModal } from "./NewProjectModal";
import { StatusBadge as StatusBadgeComponent, toJobStatus } from "../components/StatusBadge";
import { getLanguageDisplayName, getLanguageFlag } from "../utils/language";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFirstName(fullName: string | null | undefined, email: string): string {
  if (fullName) return fullName.split(" ")[0];
  return email.split("@")[0];
}

function formatRelativeTime(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Processing status helpers ──────────────────────────────────────────────

const PROCESSING_STATUSES = new Set([
  "queued",
  "parsing",
  "translating",
  "translation_queued",
]);

function isProcessing(rawStatus: string): boolean {
  return PROCESSING_STATUSES.has(rawStatus);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, subtitle, href }: { label: string; value: string; subtitle: string; href: string }) {
  return (
    <Link href={href} className="group rounded-xl border border-brand-border bg-brand-surface p-6 no-underline transition-colors hover:border-t-2 hover:border-t-brand-accent">
      <p className="mb-2 font-sans text-[0.6875rem] font-medium uppercase tracking-widest text-brand-accent">
        {label}
      </p>
      <p className="mb-1 font-display text-[2.5rem] font-bold leading-[1.1] text-brand-accent">
        {value}
      </p>
      <p className="font-sans text-xs text-brand-accent">
        {subtitle}
      </p>
    </Link>
  );
}


function QualityPill({ score }: { score: number | null }) {
  if (score == null || score < 0) {
    return <span className="rounded-full bg-brand-bg px-2.5 py-0.5 text-[0.6875rem] font-medium text-brand-subtle">—</span>;
  }
  if (score >= 90) {
    return <span className="rounded-full bg-status-successBg px-2.5 py-0.5 text-[0.6875rem] font-medium text-status-success">Excellent</span>;
  }
  if (score >= 70) {
    return <span className="rounded-full bg-brand-accentMid px-2.5 py-0.5 text-[0.6875rem] font-medium text-brand-accent">Good</span>;
  }
  if (score >= 50) {
    return <span className="rounded-full bg-status-warningBg px-2.5 py-0.5 text-[0.6875rem] font-medium text-status-warning">Fair</span>;
  }
  return <span className="rounded-full bg-brand-bg px-2.5 py-0.5 text-[0.6875rem] font-medium text-brand-subtle">—</span>;
}

function TranslationRow({ t }: { t: DashboardTranslation }) {
  const processing = isProcessing(t.raw_status);

  if (processing) {
    return (
      <tr className="cursor-not-allowed opacity-60">
        <td className="px-5 py-3.5 font-sans text-sm font-medium text-brand-text">
          {t.document_name ?? `Document #${t.id}`}
        </td>
        <td className={`px-5 py-3.5 font-sans text-sm ${t.project_name ? "text-brand-muted" : "italic text-brand-subtle"}`}>
          {t.project_name ?? "No project"}
        </td>
        <td className="px-5 py-3.5 font-sans text-[0.8125rem] text-brand-muted">
          {t.source_language} → {t.target_language}
        </td>
        <td className="px-5 py-3.5">
          <StatusBadgeComponent status={toJobStatus(t.raw_status)} />
        </td>
        <td className="px-5 py-3.5">
          <QualityPill score={null} />
        </td>
      </tr>
    );
  }

  return (
    <tr className="cursor-pointer transition-colors hover:bg-brand-bg">
      <td className="px-5 py-3.5">
        <Link href={`/translation-jobs/${t.id}/overview`} className="font-sans text-sm font-medium text-brand-text no-underline hover:underline">
          {t.document_name ?? `Document #${t.id}`}
        </Link>
      </td>
      <td className={`px-5 py-3.5 font-sans text-sm ${t.project_name ? "text-brand-muted" : "italic text-brand-subtle"}`}>
        {t.project_name ?? "No project"}
      </td>
      <td className="px-5 py-3.5 font-sans text-[0.8125rem] text-brand-muted">
        {t.source_language} → {t.target_language}
      </td>
      <td className="px-5 py-3.5">
        <StatusBadgeComponent status={toJobStatus(t.raw_status)} />
      </td>
      <td className="px-5 py-3.5">
        <QualityPill score={t.quality_score} />
      </td>
    </tr>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const openTranslationModal = useDashboardStore((s) => s.openTranslationModal);
  const openProjectModal = useDashboardStore((s) => s.openProjectModal);

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (hasHydrated && !token) router.replace("/login");
  }, [hasHydrated, token, router]);

  // Server state via React Query — poll faster when jobs are processing
  const [hasProcessingJobs, setHasProcessingJobs] = useState(false);
  const { data: translations } = useDashboardTranslations(hasProcessingJobs);
  const { data: tierData } = useTier();
  const { data: projectList } = useProjects();
  const { data: orgStats } = useOrgStats();
  const { data: upcomingItems } = useUpcomingDeadlines();

  useEffect(() => {
    const processing = (translations ?? []).some((t) => isProcessing(t.raw_status));
    setHasProcessingJobs(processing);
  }, [translations]);

  // Compute real stats from fetched data
  const totalDocuments = (translations ?? []).length;
  const activeProjectCount = projectList?.length ?? 0;
  const pendingReviewCount = (translations ?? []).filter(
    (t) => t.raw_status === "in_review" || t.raw_status === "review"
  ).length;

  if (!hasHydrated) return null;
  if (!token) return null;

  const firstName = getFirstName(user?.full_name, user?.email ?? "");
  const displayTranslations = translations ?? [];
  const isNewUser = totalDocuments === 0 && activeProjectCount === 0;

  // ── New user dashboard ──────────────────────────────────────────────────
  if (isNewUser) {
    return (
      <AppShell>
        <div className="px-8 py-8">
          {/* Welcome header */}
          <div className="mb-8">
            <h1 className="mb-1 font-display text-2xl font-bold text-brand-text">
              Welcome to Helvara, <em>{firstName}</em>.
            </h1>
            <p className="text-sm text-brand-muted">
              Your translation workspace is ready. Start by uploading a document or creating a project.
            </p>
          </div>

          {/* Stat tiles — zeros with helpful sub-text */}
          <div className="mb-10 grid grid-cols-5 gap-4">
            <StatCard label="Total Documents" value="0" subtitle="Upload your first document" href="/documents" />
            <StatCard label="Active Projects" value="0" subtitle="Create a project to get organised" href="/projects" />
            <StatCard label="Pending Review" value="0" subtitle="Nothing awaiting approval yet" href="/documents" />
            <StatCard label="Words Translated" value="0" subtitle="Across all completed jobs" href="/documents" />
            <StatCard label="Time Saved" value="0 hrs" subtitle="vs. manual translation" href="/documents" />
          </div>

          {/* Two path cards */}
          <div className="mb-10 grid grid-cols-2 gap-4">
            {/* Quick start — featured teal */}
            <div className="rounded-xl border border-brand-accent/30 bg-brand-accentMid/30 p-6">
              <div className="mb-3 text-2xl">⚡</div>
              <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-widest text-brand-accent">Quick start</p>
              <h3 className="font-display text-lg font-semibold text-brand-text">Translate a document</h3>
              <p className="mt-2 text-sm text-brand-muted">
                Upload a single document and get a translation in minutes. Best for one-off jobs or trying it out.
              </p>
              <ul className="mt-3 space-y-1 text-sm text-brand-muted">
                <li>Upload DOCX, RTF, or TXT</li>
                <li>Pick your target language</li>
                <li>Review and export</li>
              </ul>
              <button
                type="button"
                onClick={() => openTranslationModal()}
                className="mt-5 rounded-full bg-brand-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-accentHov transition-colors"
              >
                + New Translation
              </button>
            </div>

            {/* For ongoing work — ghost border */}
            <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
              <div className="mb-3 text-2xl">📁</div>
              <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-widest text-brand-muted">For ongoing work</p>
              <h3 className="font-display text-lg font-semibold text-brand-text">Create a project</h3>
              <p className="mt-2 text-sm text-brand-muted">
                Group related documents under one project with shared target languages. Best for client work or repeat translation workflows.
              </p>
              <ul className="mt-3 space-y-1 text-sm text-brand-muted">
                <li>Set target languages once</li>
                <li>Fan out to multiple languages automatically</li>
                <li>Track progress across all documents</li>
              </ul>
              <button
                type="button"
                onClick={openProjectModal}
                className="mt-5 rounded-full border border-brand-border bg-brand-surface px-5 py-2.5 text-sm font-medium text-brand-muted hover:bg-brand-bg transition-colors"
              >
                + New Project
              </button>
            </div>
          </div>

          {/* Recent Translations — empty table with headers */}
          <div className="mb-10">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="font-display text-xl font-bold text-brand-text">Recent Translations</h2>
              <div className="h-0.5 w-8 rounded-sm bg-brand-accent" />
            </div>
            <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-brand-border">
                    {["Document", "Language", "Status", "Uploaded"].map((col) => (
                      <th key={col} className="px-5 py-3 text-left font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-brand-subtle">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-sm text-brand-muted">
                      No translations yet — upload a document above to get started.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <NewTranslationModal projects={projectList ?? []} />
        <NewProjectModal />
      </AppShell>
    );
  }

  // ── Returning user dashboard ────────────────────────────────────────────
  return (
    <AppShell>
      <div className="px-8 py-8">

        {/* ── Hero ── */}
        <div className="mb-8">
          <h1 className="mb-1 font-display text-2xl font-bold text-brand-text">
            Welcome back, <em>{firstName}</em>.
          </h1>
          <p className="text-sm text-brand-muted">
            Here&apos;s what&apos;s happening across your translation workspace.
          </p>
        </div>

        {/* ── Stat Cards ── */}
        <div className="mb-10 grid grid-cols-5 gap-4">
          <StatCard
            label="Total Documents"
            value={String(totalDocuments)}
            subtitle={totalDocuments === 1 ? "1 document" : `${totalDocuments} documents`}
            href="/documents"
          />
          <StatCard
            label="Active Projects"
            value={String(activeProjectCount)}
            subtitle={activeProjectCount === 1 ? "1 project" : `${activeProjectCount} projects`}
            href="/projects"
          />
          <StatCard
            label="Pending Review"
            value={String(pendingReviewCount)}
            subtitle="Awaiting approval"
            href="/documents"
          />
          <StatCard
            label="Words Translated"
            value={(orgStats?.total_words_translated ?? 0).toLocaleString()}
            subtitle="Across all completed jobs"
            href="/documents"
          />
          <StatCard
            label="Time Saved"
            value={`${orgStats?.time_saved_hours ?? 0} hrs`}
            subtitle="vs. manual translation"
            href="/documents"
          />
        </div>

        {/* ── Projects ── */}
        {(projectList && projectList.length > 0) && (
          <div className="mb-10">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-xl font-bold text-brand-text">Projects</h2>
                <div className="h-0.5 w-8 rounded-sm bg-brand-accent" />
              </div>
              <button
                type="button"
                onClick={openProjectModal}
                className="font-sans text-[0.8125rem] font-medium text-brand-accent no-underline hover:underline"
              >
                + New Project
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {projectList.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="group rounded-xl border border-brand-border bg-brand-surface p-5 no-underline transition-colors hover:border-brand-accent"
                >
                  <p className="font-sans text-sm font-medium text-brand-text group-hover:text-brand-accent">{p.name}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {p.target_languages.map((lang) => (
                      <span key={lang} className="rounded-full bg-brand-accentMid px-2 py-0.5 text-xs font-medium text-brand-accent">
                        {getLanguageFlag(lang)} {getLanguageDisplayName(lang)}
                      </span>
                    ))}
                    <span className="rounded-full bg-brand-bg px-2 py-0.5 text-xs font-medium text-brand-muted">
                      {p.document_count} {p.document_count === 1 ? "doc" : "docs"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Usage Indicator ── */}
        {tierData && tierData.limits.max_jobs !== null && tierData.jobs_this_month > tierData.limits.max_jobs * 0.5 && (
          <div className={`mb-6 flex items-center justify-between rounded-xl border px-5 py-3 ${
            tierData.jobs_this_month >= tierData.limits.max_jobs
              ? "border-status-error/30 bg-status-errorBg"
              : tierData.jobs_this_month >= tierData.limits.max_jobs * 0.8
                ? "border-status-warning/30 bg-status-warningBg"
                : "border-brand-border bg-brand-surface"
          }`}>
            <div>
              <p className="text-sm font-medium text-brand-text">
                {tierData.jobs_this_month} of {tierData.limits.max_jobs} translation jobs used this month
              </p>
              <p className="mt-0.5 text-xs text-brand-muted">
                {tierData.tier.charAt(0).toUpperCase() + tierData.tier.slice(1)} plan
              </p>
            </div>
            {tierData.jobs_this_month >= tierData.limits.max_jobs && (
              <button
                type="button"
                className="rounded-full bg-brand-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-accentHov"
              >
                Upgrade
              </button>
            )}
          </div>
        )}

        {/* ── Active Translations ── */}
        <div className="mb-10">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="font-display text-xl font-bold text-brand-text">
              Active Translations
            </h2>
            <div className="h-0.5 w-8 rounded-sm bg-brand-accent" />
          </div>

          <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-brand-border">
                  {["Document", "Project", "Language", "Status", "Quality"].map((col) => (
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
                {displayTranslations.length > 0 ? (
                  displayTranslations.map((t) => (
                    <TranslationRow key={t.id} t={t} />
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-sm text-brand-muted">
                      No translations yet — upload a document to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>


        {/* ── Upcoming Deadlines ── */}
        {upcomingItems && upcomingItems.length > 0 && (
          <div className="mb-10">
            <div className="mb-4 flex items-center gap-3">
              <h3 className="font-display text-xl font-bold text-brand-text">Upcoming Deadlines</h3>
              <div className="h-0.5 w-8 rounded-sm bg-brand-accent" />
            </div>
            <div className="space-y-2">
              {upcomingItems.slice(0, 3).map((item) => {
                const due = new Date(item.due_date);
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                const badgeClasses = diffDays < 0
                  ? "bg-status-errorBg text-status-error"
                  : diffDays <= 3
                    ? "bg-status-warningBg text-status-warning"
                    : "bg-brand-bg text-brand-muted";
                const badgeLabel = diffDays < 0
                  ? "Overdue"
                  : diffDays <= 3
                    ? "Due soon"
                    : due.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
                const href = item.type === "job"
                  ? `/translation-jobs/${item.id}/overview`
                  : `/projects/${item.id}`;
                return (
                  <Link
                    key={`${item.type}-${item.id}`}
                    href={href}
                    className="flex items-center justify-between rounded-xl border border-brand-border bg-brand-surface px-5 py-3 no-underline transition-colors hover:border-brand-accent"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-brand-subtle">{item.type === "job" ? "📄" : "📁"}</span>
                      <span className="text-sm font-medium text-brand-text">{item.name}</span>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[0.6875rem] font-medium ${badgeClasses}`}>
                      {badgeLabel}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Recent Activity ── */}
        {displayTranslations.length > 0 && (
          <div className="mb-10">
            <div className="mb-4 flex items-center gap-3">
              <h3 className="font-display text-xl font-bold text-brand-text">Recent Activity</h3>
              <div className="h-0.5 w-8 rounded-sm bg-brand-accent" />
            </div>
            <div className="grid grid-cols-4 gap-3">
              {displayTranslations.slice(0, 8).map((t) => {
                const dotColor = t.raw_status === "exported" ? "bg-status-success"
                  : t.raw_status === "in_review" || t.raw_status === "review" ? "bg-brand-accent"
                  : t.raw_status === "translating" || t.raw_status === "translation_queued" ? "bg-status-warning"
                  : t.raw_status === "translation_failed" ? "bg-status-error"
                  : "bg-brand-subtle";
                const label = t.raw_status === "exported" ? "Exported"
                  : t.raw_status === "in_review" || t.raw_status === "review" ? "Ready for review"
                  : t.raw_status === "translating" || t.raw_status === "translation_queued" ? "Translating"
                  : t.raw_status === "translation_failed" ? "Failed"
                  : t.raw_status === "ready_for_export" ? "Ready to export"
                  : t.status;
                const timeAgo = t.created_at ? formatRelativeTime(t.created_at) : "";
                return (
                  <div key={t.id} className="flex items-start gap-2.5 rounded-xl border border-brand-border bg-brand-surface p-3">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-brand-text">{label}</p>
                      <p className="truncate text-xs text-brand-subtle">{t.document_name ?? `Job #${t.id}`}</p>
                      {timeAgo && <p className="text-xs text-brand-subtle">{timeAgo}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* ── Modals ── */}
      <NewTranslationModal projects={projectList ?? []} />
      <NewProjectModal />
    </AppShell>
  );
}
