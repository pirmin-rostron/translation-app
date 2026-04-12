"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { useDashboardStore } from "../stores/dashboardStore";
import { useDashboardTranslations, useTier, useProjects } from "../hooks/queries";
import type { DashboardTranslation } from "../hooks/queries";
import { TierGate } from "../components/TierGate";
import { SplitButton } from "./SplitButton";
import { NewTranslationModal } from "./NewTranslationModal";
import { NewProjectModal } from "./NewProjectModal";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFirstName(fullName: string | null | undefined, email: string): string {
  if (fullName) return fullName.split(" ")[0];
  return email.split("@")[0];
}

// ─── Processing status helpers ──────────────────────────────────────────────

const PROCESSING_STATUSES = new Set([
  "queued",
  "parsing",
  "translating",
  "translation_queued",
]);

// ─── Status badge classes ────────────────────────────────────────────────────

function statusBadgeClasses(status: string): string {
  switch (status) {
    case "In Review":
      return "bg-brand-accent/[0.12] text-brand-accent";
    case "Completed":
    case "Ready for Export":
      return "bg-status-successBg text-status-success";
    case "Failed":
      return "bg-status-errorBg text-status-error";
    case "Translating…":
      return "bg-brand-bg text-brand-muted";
    default:
      return "bg-brand-bg text-brand-muted";
  }
}

function isProcessing(rawStatus: string): boolean {
  return PROCESSING_STATUSES.has(rawStatus);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, subtitle }: { label: string; value: string; subtitle: string }) {
  return (
    <div className="group rounded-xl border border-brand-border bg-brand-surface p-6 transition-colors hover:border-t-2 hover:border-t-brand-accent">
      <p className="mb-2 font-sans text-[0.6875rem] font-medium uppercase tracking-widest text-brand-accent">
        {label}
      </p>
      <p className="mb-1 font-display text-[2.5rem] font-bold leading-[1.1] text-brand-accent">
        {value}
      </p>
      <p className="font-sans text-xs text-brand-accent">
        {subtitle}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const processing = status === "Translating…";
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 font-sans text-[0.6875rem] font-medium ${statusBadgeClasses(status)} ${processing ? "animate-pulse" : ""}`}
    >
      {processing && (
        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {status}
    </span>
  );
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
          <StatusBadge status={t.status} />
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
        <StatusBadge status={t.status} />
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
            label="Total Documents"
            value={String(totalDocuments)}
            subtitle={totalDocuments === 1 ? "1 document" : `${totalDocuments} documents`}
          />
          <StatCard
            label="Active Projects"
            value={String(activeProjectCount)}
            subtitle={activeProjectCount === 1 ? "1 project" : `${activeProjectCount} projects`}
          />
          <StatCard
            label="Pending Review"
            value={String(pendingReviewCount)}
            subtitle="Awaiting approval"
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
                  className="group rounded-xl border border-brand-border bg-brand-surface p-5 no-underline transition-colors hover:border-brand-accent"
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
              <div className="rounded-xl border border-brand-border bg-brand-surface px-8 py-10 text-center">
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
        {hasTranslations ? (
          <div className="mb-10">
            {/* Section header */}
            <div className="mb-4 flex items-center gap-3">
              <h2 className="font-display text-xl font-bold text-brand-text">
                Active Translations
              </h2>
              <div className="h-0.5 w-8 rounded-sm bg-brand-accent" />
            </div>

            {/* Table card */}
            <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-brand-border">
                    {["Document", "Project", "Language", "Status"].map((col) => (
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
          <div className="mb-10 rounded-xl border border-brand-border bg-brand-surface px-8 py-20 text-center">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-brand-muted">
                <rect x="8" y="4" width="24" height="32" rx="3" stroke="currentColor" strokeWidth="1.5" />
                <path d="M14 14h12M14 20h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <rect x="16" y="12" width="24" height="32" rx="3" stroke="currentColor" strokeWidth="1.5" />
                <path d="M22 26h12M22 32h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M32 18l4-4m0 0l-2 6-4-2 6-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="mb-2 font-display text-2xl font-bold text-brand-text">
              Translate your first document
            </p>
            <p className="mx-auto mb-6 max-w-sm font-sans text-sm text-brand-muted">
              Upload a document and Helvara will translate it, check for ambiguities, and apply your glossary — automatically.
            </p>
            <button
              onClick={() => openTranslationModal()}
              className="cursor-pointer rounded-full border-none bg-brand-accent px-6 py-2.5 font-sans text-sm font-semibold text-white transition-opacity hover:bg-brand-accentHov"
            >
              Upload a document
            </button>
          </div>
        )}


      </div>

      {/* ── Modals ── */}
      <NewTranslationModal projects={projectList ?? []} />
      <NewProjectModal />
    </div>
  );
}
