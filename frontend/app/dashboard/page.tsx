"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { useDashboardStore } from "../stores/dashboardStore";
import { useDashboardTranslations, useTier, useProjects } from "../hooks/queries";
import type { DashboardTranslation } from "../hooks/queries";
import { TierGate } from "../components/TierGate";
import { SplitButton } from "./SplitButton";
import { NewTranslationModal } from "./NewTranslationModal";
import { NewProjectModal } from "./NewProjectModal";
import type { ProjectListItem } from "../services/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFirstName(fullName: string | null | undefined, email: string): string {
  if (fullName) return fullName.split(" ")[0];
  return email.split("@")[0];
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

// ─── Sample stats (placeholder until API endpoint exists) ────────────────────

const SAMPLE_STATS = {
  activeProjects: 10,
  wordsTranslated: 84000,
  pendingReview: 3,
} as const;

// ─── Status badge classes ────────────────────────────────────────────────────

function statusBadgeClasses(status: string): string {
  switch (status) {
    case "In Review":
      return "bg-brand-accent/[0.12] text-brand-accent";
    case "In Progress":
      return "bg-brand-bg text-brand-muted";
    case "Pending":
      return "bg-status-warningBg text-status-warning";
    default:
      return "bg-brand-bg text-brand-muted";
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <div className="group rounded-lg border border-brand-border bg-brand-surface p-6 transition-colors hover:border-t-2 hover:border-t-brand-accent">
      <p className="mb-2 font-sans text-[0.6875rem] font-medium uppercase tracking-widest text-brand-accent">
        {label}
      </p>
      <p className="mb-1 font-display text-[2.5rem] font-bold leading-[1.1] text-brand-accent">
        {value}
      </p>
      <p className="font-sans text-xs text-brand-accent">
        {delta}
      </p>
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="flex min-w-[120px] items-center gap-2">
      <div className="h-1 flex-1 overflow-hidden rounded-sm bg-brand-border">
        <div
          className="h-full rounded-sm bg-brand-accent transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="min-w-[2rem] text-right font-sans text-xs text-brand-muted">
        {percent}%
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-0.5 font-sans text-[0.6875rem] font-medium ${statusBadgeClasses(status)}`}
    >
      {status}
    </span>
  );
}

function TranslationRow({ t }: { t: DashboardTranslation }) {
  return (
    <tr className="cursor-pointer transition-colors hover:bg-brand-bg">
      <td className="px-5 py-3.5">
        <Link href={`/translation-jobs/${t.id}`} className="font-sans text-sm font-medium text-brand-text no-underline hover:underline">
          {t.document_name ?? `Document #${t.id}`}
        </Link>
      </td>
      <td
        className={`px-5 py-3.5 font-sans text-sm ${
          t.project_name
            ? "text-brand-muted"
            : "italic text-brand-subtle"
        }`}
      >
        {t.project_name ?? "No project"}
      </td>
      <td className="px-5 py-3.5 font-sans text-[0.8125rem] text-brand-muted">
        {t.source_language} → {t.target_language}
      </td>
      <td className="px-5 py-3.5">
        <ProgressBar percent={t.progress} />
      </td>
      <td className="px-5 py-3.5">
        <StatusBadge status={t.status} />
      </td>
    </tr>
  );
}

function TermChip({ label }: { label: string }) {
  return (
    <span className="whitespace-nowrap rounded-full bg-brand-accent/[0.08] px-2.5 py-1 font-sans text-[0.6875rem] font-medium text-brand-accent">
      {label}
    </span>
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

  // Server state via React Query — placeholderData ensures page always renders
  const { data: translations } = useDashboardTranslations();
  const { data: tierData } = useTier();
  const { data: projectList } = useProjects();

  // Stats — placeholder until endpoint exists
  const stats = SAMPLE_STATS;

  if (!hasHydrated) return null;
  if (!token) return null;

  const firstName = getFirstName(user?.full_name, user?.email ?? "");
  const displayTranslations = translations ?? [];
  const hasTranslations = displayTranslations.length > 0;

  return (
    <div className="min-h-screen bg-brand-bg pt-20">
      <div className="mx-auto max-w-[1100px] px-10 py-12">

        {/* ── Hero + Split Button ── */}
        <div className="mb-10 flex items-start justify-between">
          <div>
            <p className="mb-2 font-sans text-[0.6875rem] font-medium uppercase tracking-widest text-brand-accent">
              OVERVIEW
            </p>
            <h1 className="mb-2 font-display text-[clamp(2rem,4vw,2.75rem)] font-bold leading-[1.1] tracking-tight text-brand-text">
              Welcome back, <em>{firstName}</em>.
            </h1>
            <p className="font-sans text-[0.9375rem] text-brand-muted">
              Here&apos;s what&apos;s happening across your translation workspace.
            </p>
          </div>
          <SplitButton />
        </div>

        {/* ── Stat Cards ── */}
        <div className="mb-10 grid grid-cols-3 gap-4">
          <StatCard
            label="Active Projects"
            value={String(stats.activeProjects)}
            delta="↑ 2 this month"
          />
          <StatCard
            label="Words Translated"
            value={formatNumber(stats.wordsTranslated)}
            delta="↑ 12,400 this week"
          />
          <StatCard
            label="Pending Review"
            value={String(stats.pendingReview)}
            delta="Awaiting approval"
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
              <TierGate feature="create_projects" tier={tierData?.tier ?? "free"}>
                <button
                  type="button"
                  onClick={openProjectModal}
                  className="font-sans text-[0.8125rem] font-medium text-brand-accent no-underline hover:underline"
                >
                  + New Project
                </button>
              </TierGate>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {projectList.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="group rounded-lg border border-brand-border bg-brand-surface p-5 no-underline transition-colors hover:border-brand-accent"
                >
                  <p className="font-sans text-sm font-medium text-brand-text group-hover:text-brand-accent">{p.name}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-brand-muted">
                    <span>{p.document_count} {p.document_count === 1 ? "doc" : "docs"}</span>
                    {p.target_languages.length > 0 && (
                      <span>{p.target_languages.join(", ")}</span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-brand-subtle">
                    {p.default_tone.charAt(0).toUpperCase() + p.default_tone.slice(1)} tone
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
        {(!projectList || projectList.length === 0) && tierData && tierData.tier !== "free" && (
          <div className="mb-10">
            <TierGate feature="create_projects" tier={tierData.tier}>
              <div className="rounded-lg border border-brand-border bg-brand-surface px-8 py-10 text-center">
                <p className="font-display text-lg font-bold text-brand-text">No projects yet</p>
                <p className="mt-1 font-sans text-sm text-brand-muted">Create a project to group documents together.</p>
                <button
                  type="button"
                  onClick={openProjectModal}
                  className="mt-4 rounded-full bg-brand-accent px-5 py-2 font-sans text-sm font-medium text-white hover:bg-brand-accentHov"
                >
                  + New Project
                </button>
              </div>
            </TierGate>
          </div>
        )}

        {/* ── Usage Indicator ── */}
        {tierData && tierData.limits.max_jobs !== null && tierData.jobs_this_month > tierData.limits.max_jobs * 0.5 && (
          <div className={`mb-6 flex items-center justify-between rounded-lg border px-5 py-3 ${
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
        {hasTranslations ? (
          <div className="mb-10">
            {/* Section header */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-xl font-bold text-brand-text">
                  Active Translations
                </h2>
                <div className="h-0.5 w-8 rounded-sm bg-brand-accent" />
              </div>
              <Link
                href="/dashboard"
                className="font-sans text-[0.8125rem] font-medium text-brand-accent no-underline hover:underline"
              >
                View all →
              </Link>
            </div>

            {/* Table card */}
            <div className="overflow-hidden rounded-lg border border-brand-border bg-brand-surface">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-brand-border">
                    {["Document", "Project", "Language", "Progress", "Status"].map((col) => (
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
                  {displayTranslations.map((t) => (
                    <TranslationRow key={t.id} t={t} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="mb-10 rounded-lg border border-brand-border bg-brand-surface px-8 py-16 text-center">
            <p className="mb-2 font-display text-xl font-bold text-brand-text">
              No translations yet
            </p>
            <p className="mb-5 font-sans text-sm text-brand-subtle">
              Upload your first document to get started.
            </p>
            <button
              onClick={openTranslationModal}
              className="cursor-pointer rounded-full border-none bg-brand-accent px-6 py-2.5 font-sans text-sm font-semibold text-white transition-opacity hover:bg-brand-accentHov"
            >
              + New Translation
            </button>
          </div>
        )}

        {/* ── Bottom Cards ── */}
        <div className="grid grid-cols-2 gap-4">

          {/* Connected Glossary */}
          <div className="rounded-lg border border-brand-border bg-brand-surface p-6">
            <p className="mb-2 font-sans text-[0.6875rem] font-medium uppercase tracking-widest text-brand-accent">
              CONNECTED GLOSSARY
            </p>
            <h3 className="mb-1.5 font-display text-lg font-bold text-brand-text">
              Legal &amp; Compliance Terms
            </h3>
            <p className="mb-4 font-sans text-[0.8125rem] text-brand-muted">
              218 terms enforced across all active projects.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <TermChip label="Force Majeure" />
              <TermChip label="Indemnification" />
              <TermChip label="Jurisdiction" />
              <TermChip label="Confidentiality" />
              <span className="self-center px-2.5 py-1 font-sans text-[0.6875rem] font-medium text-brand-subtle">
                +214 more
              </span>
            </div>
          </div>

          {/* Translation Memory */}
          <div className="rounded-lg bg-brand-accent p-6">
            <p className="mb-3 font-sans text-[0.6875rem] font-medium uppercase tracking-widest text-brand-accentMid">
              TRANSLATION MEMORY
            </p>
            <p className="mb-2 font-display text-[3.25rem] font-bold leading-none text-white">
              60%
            </p>
            <span className="mb-3 inline-block rounded-full bg-white/20 px-2.5 py-0.5 font-sans text-[0.6875rem] font-medium text-white">
              High Reuse · High Efficiency
            </span>
            <p className="font-sans text-[0.8125rem] leading-normal text-brand-accentMid">
              Approved translations are automatically surfaced for similar content.
            </p>
          </div>
        </div>

      </div>

      {/* ── Modals ── */}
      <NewTranslationModal projects={[]} />
      <NewProjectModal />
    </div>
  );
}
