"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../stores/authStore";
import { apiFetch, API_URL } from "../services/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type TranslationJob = {
  id: number;
  status: "pending" | "processing" | "review" | "completed" | "failed";
  source_language: string;
  target_language: string;
  created_at: string;
  document_name?: string;
};

type DashboardStats = {
  documents_this_month: number;
  words_translated: number;
  jobs_completed: number;
};

// ─── Query keys ───────────────────────────────────────────────────────────────

const QUERY_KEYS = {
  recentJobs: ["translation-jobs", "recent"] as const,
  stats: ["dashboard", "stats"] as const,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<TranslationJob["status"], string> = {
  pending: "Pending",
  processing: "Processing",
  review: "In Review",
  completed: "Completed",
  failed: "Failed",
};

const STATUS_STYLES: Record<TranslationJob["status"], string> = {
  pending:    "bg-stone-100 text-stone-600",
  processing: "bg-amber-50 text-amber-700",
  review:     "bg-teal-50 text-teal-700",
  completed:  "bg-green-50 text-green-700",
  failed:     "bg-red-50 text-red-600",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getFirstName(fullName: string | null | undefined, email: string): string {
  if (fullName) return fullName.split(" ")[0];
  return email.split("@")[0];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-sm border border-stone-200 bg-white px-6 py-5">
      <p
        className="text-xs font-medium uppercase tracking-widest"
        style={{ color: "#0D7B6E" }}
      >
        {label}
      </p>
      <p
        className="mt-2 text-3xl font-semibold"
        style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1A110A" }}
      >
        {value}
      </p>
    </div>
  );
}

function JobRow({ job }: { job: TranslationJob }) {
  return (
    <Link
      href={`/translation-jobs/${job.id}`}
      className="group flex items-center justify-between border-b border-stone-100 px-6 py-4 transition-colors hover:bg-stone-50 last:border-b-0"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-stone-900 group-hover:text-teal-700 transition-colors">
            {job.document_name ?? `Job #${job.id}`}
          </p>
          <p className="mt-0.5 text-xs text-stone-400">
            {job.source_language} → {job.target_language} · {formatDate(job.created_at)}
          </p>
        </div>
      </div>
      <span
        className={[
          "ml-4 flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
          STATUS_STYLES[job.status],
        ].join(" ")}
      >
        {STATUS_LABELS[job.status]}
      </span>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!token) router.replace("/login");
  }, [token, router]);

  const { data: jobs, isLoading: jobsLoading } = useQuery<TranslationJob[]>({
    queryKey: QUERY_KEYS.recentJobs,
    queryFn: () =>
      apiFetch(`${API_URL}/translation-jobs?limit=10&order=desc`) as Promise<TranslationJob[]>,
    enabled: !!token,
    staleTime: 30_000,
  });

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: QUERY_KEYS.stats,
    queryFn: () => apiFetch(`${API_URL}/translation-jobs/stats`) as Promise<DashboardStats>,
    enabled: !!token,
    staleTime: 60_000,
  });

  if (!token) return null;

  const firstName = getFirstName(user?.full_name, user?.email ?? "");

  return (
    <div
      className="min-h-screen px-6 py-10"
      style={{ backgroundColor: "#F5F2EC" }}
    >
      <div className="mx-auto max-w-4xl">

        {/* ── Header ── */}
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p
              className="text-xs font-medium uppercase tracking-widest mb-1"
              style={{ color: "#0D7B6E" }}
            >
              Welcome back
            </p>
            <h1
              className="text-4xl font-semibold"
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                color: "#1A110A",
              }}
            >
              {firstName}
            </h1>
          </div>

          <Link
            href="/upload"
            className="rounded-full px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#0D7B6E" }}
          >
            New translation
          </Link>
        </div>

        {/* ── Stats ── */}
        {stats && (
          <div className="mb-8 grid grid-cols-3 gap-4">
            <StatCard label="Docs this month" value={stats.documents_this_month} />
            <StatCard label="Words translated" value={stats.words_translated.toLocaleString()} />
            <StatCard label="Jobs completed" value={stats.jobs_completed} />
          </div>
        )}

        {/* ── Recent jobs ── */}
        <div className="rounded-sm border border-stone-200 bg-white">
          <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
            <h2
              className="text-sm font-semibold"
              style={{ color: "#1A110A" }}
            >
              Recent translations
            </h2>
            <Link
              href="/documents"
              className="text-xs font-medium transition-colors hover:underline"
              style={{ color: "#0D7B6E" }}
            >
              View all
            </Link>
          </div>

          {jobsLoading && (
            <div className="space-y-0">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-stone-100 px-6 py-4 last:border-b-0"
                >
                  <div className="space-y-2">
                    <div className="h-3.5 w-48 rounded-sm bg-stone-100 animate-pulse" />
                    <div className="h-2.5 w-32 rounded-sm bg-stone-100 animate-pulse" />
                  </div>
                  <div className="h-5 w-16 rounded-full bg-stone-100 animate-pulse" />
                </div>
              ))}
            </div>
          )}

          {!jobsLoading && (!jobs || jobs.length === 0) && (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-stone-400">No translations yet.</p>
              <Link
                href="/upload"
                className="mt-3 inline-block text-sm font-medium transition-colors hover:underline"
                style={{ color: "#0D7B6E" }}
              >
                Upload your first document →
              </Link>
            </div>
          )}

          {!jobsLoading && jobs && jobs.length > 0 && (
            <div>
              {jobs.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>
        <Link href="/documents" className="mt-3 inline-block text-sm font-medium hover:underline" style={{ color: "#0D7B6E" }}>
          View all translations →
        </Link>

        {/* ── Quick actions ── */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          {[
            { label: "Upload document", href: "/upload", desc: "Start a new translation job" },
            { label: "Glossary", href: "/glossary", desc: "Manage terminology" },
            { label: "Settings", href: "/settings", desc: "Account & preferences" },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group rounded-sm border border-stone-200 bg-white px-5 py-4 transition-colors hover:border-teal-200 hover:bg-teal-50"
            >
              <p
                className="text-sm font-medium transition-colors group-hover:text-teal-700"
                style={{ color: "#1A110A" }}
              >
                {action.label}
              </p>
              <p className="mt-0.5 text-xs text-stone-400">{action.desc}</p>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
