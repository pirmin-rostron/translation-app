"use client";

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
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="mb-8 text-2xl font-bold text-slate-900">Usage Dashboard</h1>

        {isLoading && <p className="text-slate-600">Loading…</p>}
        {error && (
          <p className="text-red-600">
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
                  className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {label}
                  </p>
                  <p className="mt-1 text-3xl font-semibold text-slate-900">
                    {data.totals[key].toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            {/* Recent events table */}
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Recent Events
            </h2>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {["Time", "Event Type", "User ID", "Job ID", "Document ID", "Meta"].map(
                      (col) => (
                        <th
                          key={col}
                          className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500"
                        >
                          {col}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.recent.map((event: UsageEvent) => (
                    <tr key={event.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDateTime(event.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                        {toTitleCase(event.event_type)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{event.user_id ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{event.job_id ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{event.document_id ?? "—"}</td>
                      <td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-slate-500">
                        {formatMeta(event.meta)}
                      </td>
                    </tr>
                  ))}
                  {data.recent.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
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
  );
}
