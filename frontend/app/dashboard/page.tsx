"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { useDashboardStore } from "../stores/dashboardStore";
import { useDashboardTranslations } from "../hooks/queries";
import type { DashboardTranslation } from "../hooks/queries";
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
      return "bg-dash-teal/[0.12] text-dash-teal";
    case "In Progress":
      return "bg-[#f1f1ef] text-dash-text-mid";
    case "Pending":
      return "bg-[rgba(217,169,56,0.12)] text-[#b08d2a]";
    default:
      return "bg-[#f1f1ef] text-dash-text-mid";
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <div className="group rounded-lg border border-dash-border bg-dash-surface p-6 transition-colors hover:border-t-2 hover:border-t-dash-teal">
      <p className="mb-2 font-inter text-[0.6875rem] font-medium uppercase tracking-widest text-dash-teal">
        {label}
      </p>
      <p className="mb-1 font-newsreader text-[2.5rem] font-bold leading-[1.1] text-dash-forest">
        {value}
      </p>
      <p className="font-inter text-xs text-dash-teal">
        {delta}
      </p>
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="flex min-w-[120px] items-center gap-2">
      <div className="h-1 flex-1 overflow-hidden rounded-sm bg-dash-border">
        <div
          className="h-full rounded-sm bg-dash-teal transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="min-w-[2rem] text-right font-inter text-xs text-dash-text-mid">
        {percent}%
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-0.5 font-inter text-[0.6875rem] font-medium ${statusBadgeClasses(status)}`}
    >
      {status}
    </span>
  );
}

function TranslationRow({ t }: { t: DashboardTranslation }) {
  return (
    <tr className="transition-colors hover:bg-[#faf8f3]">
      <td className="px-5 py-3.5 font-inter text-sm font-medium text-dash-text-dark">
        {t.document_name ?? `Document #${t.id}`}
      </td>
      <td
        className={`px-5 py-3.5 font-inter text-sm ${
          t.project_name
            ? "text-dash-text-mid"
            : "italic text-dash-text-muted"
        }`}
      >
        {t.project_name ?? "No project"}
      </td>
      <td className="px-5 py-3.5 font-inter text-[0.8125rem] text-dash-text-mid">
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
    <span className="whitespace-nowrap rounded-full bg-dash-teal/[0.08] px-2.5 py-1 font-inter text-[0.6875rem] font-medium text-dash-teal">
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

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (hasHydrated && !token) router.replace("/login");
  }, [hasHydrated, token, router]);

  // Server state via React Query — placeholderData ensures page always renders
  const { data: translations } = useDashboardTranslations();

  // Stats — placeholder until endpoint exists
  const stats = SAMPLE_STATS;

  // Projects — placeholder until endpoint exists
  const projects: ProjectListItem[] = [];

  if (!hasHydrated) return null;
  if (!token) return null;

  const firstName = getFirstName(user?.full_name, user?.email ?? "");
  const displayTranslations = translations ?? [];
  const hasTranslations = displayTranslations.length > 0;

  return (
    <div className="min-h-screen bg-dash-bg pt-20">
      <div className="mx-auto max-w-[1100px] px-10 py-12">

        {/* ── Hero + Split Button ── */}
        <div className="mb-10 flex items-start justify-between">
          <div>
            <p className="mb-2 font-inter text-[0.6875rem] font-medium uppercase tracking-widest text-dash-teal">
              OVERVIEW
            </p>
            <h1 className="mb-2 font-newsreader text-[clamp(2rem,4vw,2.75rem)] font-bold leading-[1.1] tracking-tight text-dash-forest">
              Welcome back, <em>{firstName}</em>.
            </h1>
            <p className="font-inter text-[0.9375rem] text-dash-text-mid">
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

        {/* ── Active Translations ── */}
        {hasTranslations ? (
          <div className="mb-10">
            {/* Section header */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="font-newsreader text-xl font-bold text-dash-forest">
                  Active Translations
                </h2>
                <div className="h-0.5 w-8 rounded-sm bg-dash-teal" />
              </div>
              <Link
                href="/documents"
                className="font-inter text-[0.8125rem] font-medium text-dash-teal no-underline hover:underline"
              >
                View all →
              </Link>
            </div>

            {/* Table card */}
            <div className="overflow-hidden rounded-lg border border-dash-border bg-dash-surface">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-dash-border-light">
                    {["Document", "Project", "Language", "Progress", "Status"].map((col) => (
                      <th
                        key={col}
                        className="px-5 py-3 text-left font-inter text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-dash-text-muted"
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
          <div className="mb-10 rounded-lg border border-dash-border bg-dash-surface px-8 py-16 text-center">
            <p className="mb-2 font-newsreader text-xl font-bold text-dash-forest">
              No translations yet
            </p>
            <p className="mb-5 font-inter text-sm text-dash-text-muted">
              Upload your first document to get started.
            </p>
            <button
              onClick={openTranslationModal}
              className="cursor-pointer rounded-full border-none bg-dash-forest px-6 py-2.5 font-inter text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              + New Translation
            </button>
          </div>
        )}

        {/* ── Bottom Cards ── */}
        <div className="grid grid-cols-2 gap-4">

          {/* Connected Glossary */}
          <div className="rounded-lg border border-dash-border bg-dash-surface p-6">
            <p className="mb-2 font-inter text-[0.6875rem] font-medium uppercase tracking-widest text-dash-teal">
              CONNECTED GLOSSARY
            </p>
            <h3 className="mb-1.5 font-newsreader text-lg font-bold text-dash-forest">
              Legal &amp; Compliance Terms
            </h3>
            <p className="mb-4 font-inter text-[0.8125rem] text-dash-text-mid">
              218 terms enforced across all active projects.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <TermChip label="Force Majeure" />
              <TermChip label="Indemnification" />
              <TermChip label="Jurisdiction" />
              <TermChip label="Confidentiality" />
              <span className="self-center px-2.5 py-1 font-inter text-[0.6875rem] font-medium text-dash-text-muted">
                +214 more
              </span>
            </div>
          </div>

          {/* Translation Memory */}
          <div className="rounded-lg bg-dash-forest p-6">
            <p className="mb-3 font-inter text-[0.6875rem] font-medium uppercase tracking-widest text-dash-teal">
              TRANSLATION MEMORY
            </p>
            <p className="mb-2 font-newsreader text-[3.25rem] font-bold leading-none text-dash-teal">
              60%
            </p>
            <span className="mb-3 inline-block rounded-full bg-dash-teal/20 px-2.5 py-0.5 font-inter text-[0.6875rem] font-medium text-dash-teal">
              High Reuse · High Efficiency
            </span>
            <p className="font-inter text-[0.8125rem] leading-normal text-[#c8c0b0]">
              Approved translations are automatically surfaced for similar content.
            </p>
          </div>
        </div>

      </div>

      {/* ── Modals ── */}
      <NewTranslationModal projects={projects} />
      <NewProjectModal />
    </div>
  );
}
