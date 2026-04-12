"use client";

import { AppShell } from "../../components/AppShell";

import { useUsage } from "../../hooks/queries";
import type { UsageEvent } from "../../services/api";

function toTitleCase(snake: string): string {
  return snake.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function formatMeta(meta: Record<string, unknown> | null): string {
  if (!meta || Object.keys(meta).length === 0) return "—";
  return JSON.stringify(meta);
}

const STAT_CARDS: { label: string; key: keyof UsageResponse["totals"] }[] = [
  { label: "Users Registered", key: "users_registered" },
  { label: "Logins", key: "logins" },
  { label: "Documents Ingested", key: "documents_ingested" },
  { label: "Jobs Created", key: "jobs_created" },
  { label: "Words Translated", key: "words_translated" },
  { label: "Jobs Exported", key: "jobs_exported" },
];

// Pull the totals type out for use in the card config above
type UsageResponse = Awaited<ReturnType<typeof import("../../services/api").usageApi.get>>;

export default function UsageDashboardPage() {
  const { data, isLoading, error } = useUsage();

  return (
    <AppShell>
      <div className="px-8 py-8">
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="mb-8 text-2xl font-bold text-brand-text">Usage Dashboard</h1>

        {isLoading && <p className="text-brand-muted">Loading…</p>}
        {error && (
          <p className="text-status-error">
            {error instanceof Error ? error.message : "Failed to load usage data"}
          </p>
        )}

        {data && (
          <>
            {/* Stat grid */}
            <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {STAT_CARDS.map(({ label, key }) => (
                <div
                  key={key}
                  className="rounded-xl border border-brand-border bg-brand-surface px-5 py-4 "
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-brand-subtle">
                    {label}
                  </p>
                  <p className="mt-1 text-3xl font-semibold text-brand-text">
                    {data.totals[key].toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            {/* Recent events table */}
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-subtle">
              Recent Events
            </h2>
            <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface ">
              <table className="min-w-full divide-y divide-brand-border text-sm">
                <thead className="bg-brand-bg">
                  <tr>
                    {["Time", "Event Type", "User ID", "Job ID", "Document ID", "Meta"].map(
                      (col) => (
                        <th
                          key={col}
                          className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-brand-subtle"
                        >
                          {col}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {data.recent.map((event: UsageEvent) => (
                    <tr key={event.id} className="hover:bg-brand-bg">
                      <td className="whitespace-nowrap px-4 py-3 text-brand-muted">
                        {formatDateTime(event.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-brand-text">
                        {toTitleCase(event.event_type)}
                      </td>
                      <td className="px-4 py-3 text-brand-muted">{event.user_id ?? "—"}</td>
                      <td className="px-4 py-3 text-brand-muted">{event.job_id ?? "—"}</td>
                      <td className="px-4 py-3 text-brand-muted">{event.document_id ?? "—"}</td>
                      <td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-brand-subtle">
                        {formatMeta(event.meta)}
                      </td>
                    </tr>
                  ))}
                  {data.recent.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-brand-subtle">
                        No events recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
    </AppShell>
  );
}
