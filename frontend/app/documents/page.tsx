"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { useDashboardTranslations } from "../hooks/queries";
import { AppShell } from "../components/AppShell";

function formatRelativeDate(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function statusBadge(status: string) {
  switch (status) {
    case "In Review":
      return "bg-brand-accentMid text-brand-accent";
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

export default function DocumentsPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const { data: translations, isLoading } = useDashboardTranslations();

  useEffect(() => {
    if (hasHydrated && !token) router.replace("/login");
  }, [hasHydrated, token, router]);

  if (!hasHydrated || !token) return null;

  const jobs = translations ?? [];

  return (
    <AppShell>
      <div className="px-8 py-8">
        <div className="mb-8">
          <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-widest text-brand-accent">Workspace</p>
          <h1 className="font-display text-2xl font-bold text-brand-text">Documents</h1>
        </div>

        {isLoading && <p className="text-sm text-brand-muted">Loading…</p>}

        {!isLoading && jobs.length === 0 && (
          <div className="rounded-xl border border-brand-border bg-brand-surface px-8 py-20 text-center">
            <p className="font-display text-2xl font-bold text-brand-text">No documents yet</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-brand-muted">
              Upload a document to get started with AI translation.
            </p>
          </div>
        )}

        {jobs.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-brand-border">
                  {["Document", "Project", "Language", "Uploaded", "Status"].map((col) => (
                    <th key={col} className="px-5 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-brand-subtle">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map((t) => (
                  <tr key={t.id} className="border-b border-brand-border last:border-0 transition-colors hover:bg-brand-bg">
                    <td className="px-5 py-3.5">
                      <Link href={`/translation-jobs/${t.id}/overview`} className="text-sm font-medium text-brand-text no-underline hover:underline">
                        {t.document_name ?? `Document #${t.id}`}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-brand-muted">
                      {t.project_name ?? <span className="italic text-brand-subtle">No project</span>}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-brand-muted">
                      {t.source_language} → {t.target_language}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-brand-subtle">
                      {t.created_at ? formatRelativeDate(t.created_at) : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-[0.6875rem] font-medium ${statusBadge(t.status)}`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
