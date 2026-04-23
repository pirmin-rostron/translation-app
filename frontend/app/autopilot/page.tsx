"use client";

/**
 * Autopilot page — agent-as-coworker cockpit.
 * Shows Rumi's activity: feed of decisions/questions/completions,
 * live processing queue, and decisions log.
 * Wired to real backend endpoints (GET /dashboard/agent-stats, agent-feed, decisions-log)
 * plus the translation-jobs list for live queue.
 */

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../components/AppShell";
import { Icons } from "../components/Icons";
import { dashboardApi, translationJobsApi, queryKeys } from "../services/api";
import type {
  AgentStatsResponse,
  AgentMessageResponse,
  DecisionLogEntry,
  PaginatedJobsResponse,
  TranslationJobListItem,
} from "../services/api";
import { getLanguageCode } from "../utils/language";

// ── Processing helpers ──────────────────────────────────────────────────────

const PROCESSING_STATUSES = new Set([
  "queued", "parsing", "translating", "translation_queued",
]);

function jobProgress(j: TranslationJobListItem): number {
  if (!j.progress_total_segments || j.progress_total_segments === 0) return 0;
  return Math.round((j.progress_completed_segments / j.progress_total_segments) * 100);
}

function estimateEta(j: TranslationJobListItem): string {
  const pct = jobProgress(j);
  if (pct >= 95) return "<1m";
  if (pct >= 70) return "~1m";
  if (pct >= 40) return "~3m";
  return "~5m";
}

function stageLabel(status: string): string {
  switch (status) {
    case "parsing": return "Analyzing";
    case "translating": return "Translating";
    case "translation_queued": return "Queued";
    default: return "Processing";
  }
}

// ── Agent avatar ────────────────────────────────────────────────────────────

const AGENT = {
  name: "Rumi",
  role: "Translation Agent",
  tagline: "I translate, flag ambiguities, apply your glossary, and only interrupt when something genuinely needs a human call.",
  initials: "R",
  avatarBg: "linear-gradient(135deg, #0D7B6E 0%, #5B2B5F 100%)",
};

function AgentAvatar({ size = 36, pulse = false }: { size?: number; pulse?: boolean }) {
  return (
    <div className="relative shrink-0">
      <div
        className="flex items-center justify-center rounded-full font-display text-white shadow-card"
        style={{
          width: size,
          height: size,
          background: AGENT.avatarBg,
          fontSize: size * 0.42,
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        {AGENT.initials}
      </div>
      {pulse && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-surface">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-brand-surface" />
          </span>
        </span>
      )}
    </div>
  );
}

// ── Agent header ────────────────────────────────────────────────────────────

function AgentHeader({ runningCount, questionCount }: { runningCount: number; questionCount: number }) {
  return (
    <div className="mb-7">
      <p className="m-0 mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-brand-subtle">Workspace</p>
      <div className="flex items-end justify-between gap-6">
        <div className="flex items-center gap-4">
          <AgentAvatar size={72} pulse={runningCount > 0} />
          <div>
            <h1 className="m-0 font-display text-[2.25rem] font-semibold leading-none tracking-display text-brand-text">
              {AGENT.name}
              <span className="ml-3 align-middle font-sans text-[1rem] font-normal tracking-normal text-brand-muted">
                · {AGENT.role}
              </span>
            </h1>
            <p className="m-0 mt-2 max-w-xl text-[0.875rem] leading-relaxed text-brand-muted">{AGENT.tagline}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {runningCount > 0 && (
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-brand-surface px-3 py-1.5 text-[0.75rem] font-medium text-brand-text shadow-card">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Working on {runningCount} job{runningCount === 1 ? "" : "s"}
            </span>
          )}
          {questionCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-accentSoft px-3 py-1.5 text-[0.75rem] font-medium text-brand-accent">
              <Icons.Sparkle className="h-3 w-3" />
              {questionCount} question{questionCount === 1 ? "" : "s"} for you
            </span>
          )}
          <button className="rounded-full border border-brand-border bg-brand-surface px-4 py-2 text-[0.8125rem] font-medium text-brand-muted shadow-card transition-colors hover:bg-brand-sunken hover:text-brand-text">
            Pause Rumi
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Stats row ───────────────────────────────────────────────────────────────

function AgentStat({ label, value, meta, bordered, valueClass }: {
  label: string; value: string; meta: string; bordered?: boolean; valueClass?: string;
}) {
  return (
    <div className={`px-5 py-4 ${bordered ? "border-l border-brand-borderSoft" : ""}`}>
      <p className="m-0 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-subtle">{label}</p>
      <p className={`m-0 mt-2 font-display text-[1.75rem] font-semibold leading-none tracking-display ${valueClass ?? "text-brand-text"}`}>{value}</p>
      <p className="m-0 mt-1.5 text-[0.75rem] text-brand-muted">{meta}</p>
    </div>
  );
}

// ── Feed header with filter tabs ────────────────────────────────────────────

type FilterKey = "all" | "questions" | "decisions" | "completed";

function FeedHeader({ filter, setFilter, counts }: {
  filter: FilterKey;
  setFilter: (k: FilterKey) => void;
  counts: Record<FilterKey, number>;
}) {
  const tabs: Array<{ key: FilterKey; label: string; accent?: boolean }> = [
    { key: "all", label: "All" },
    { key: "questions", label: "Questions", accent: true },
    { key: "decisions", label: "Decisions" },
    { key: "completed", label: "Completed" },
  ];
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="m-0 font-display text-[1.125rem] font-semibold tracking-display text-brand-text">Feed</h2>
      <div className="flex items-center gap-1 rounded-full border border-brand-border bg-brand-surface p-1 shadow-card">
        {tabs.map((t) => {
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.75rem] font-medium transition-all ${
                active
                  ? (t.accent ? "bg-brand-accent text-white shadow-card" : "bg-brand-text text-white shadow-card")
                  : "text-brand-muted hover:text-brand-text"
              }`}
            >
              {t.label}
              <span className={`font-mono text-[0.625rem] ${active ? "text-white/70" : "text-brand-subtle"}`}>
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Agent message card ──────────────────────────────────────────────────────

function AgentMessageCard({ message }: { message: AgentMessageResponse }) {
  const router = useRouter();

  const kindStyle: Record<string, { pill: string; label: string }> = {
    question:  { pill: "bg-brand-accentSoft text-brand-accent", label: "Asking" },
    decision:  { pill: "bg-brand-sunken text-brand-muted", label: "Decided" },
    completed: { pill: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200", label: "Shipped" },
  };
  const style = kindStyle[message.kind] ?? kindStyle.decision;
  const isQuestion = message.kind === "question";

  return (
    <article className={`group rounded-2xl border bg-brand-surface p-5 transition-all hover:shadow-card ${
      isQuestion ? "border-brand-accent/30 shadow-[0_0_0_3px_rgba(13,123,110,0.05)]" : "border-brand-border"
    }`}>
      <header className="mb-3 flex items-start gap-3">
        <AgentAvatar size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-[0.9375rem] font-semibold tracking-display text-brand-text">{AGENT.name}</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.625rem] font-medium uppercase tracking-[0.1em] ${style.pill}`}>
              {style.label}
            </span>
            <span className="text-[0.75rem] text-brand-subtle">· {message.when}</span>
          </div>
          <p className="m-0 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.75rem] text-brand-muted">
            <span className="font-medium text-brand-text">{message.project}</span>
            <span className="text-brand-hint">/</span>
            <span>{message.document}</span>
            <span className="rounded bg-brand-sunken px-1.5 py-0 font-mono text-[0.6875rem] text-brand-muted">{message.pair}</span>
          </p>
        </div>
      </header>

      <h3 className="m-0 mb-2 font-display text-[1.0625rem] font-semibold leading-snug tracking-display text-brand-text">
        {message.title}
      </h3>
      <p className="m-0 text-[0.875rem] leading-relaxed text-brand-muted">{message.body}</p>

      {message.meta && !message.actions && (
        <p className="m-0 mt-3 inline-flex items-center gap-1.5 text-[0.75rem] text-brand-subtle">
          <span className="h-1 w-1 rounded-full bg-brand-hint" />
          {message.meta}
        </p>
      )}

      {message.actions && message.actions.length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          {message.actions.map((a, i) => (
            <button
              key={i}
              onClick={() => {
                if (a.primary && a.job_id) router.push(`/translation-jobs/${a.job_id}`);
              }}
              className={
                a.primary
                  ? "flex items-center gap-1 rounded-full bg-brand-text px-3.5 py-1.5 text-[0.75rem] font-medium text-white transition-colors hover:bg-brand-accent"
                  : "rounded-full border border-brand-border bg-brand-surface px-3.5 py-1.5 text-[0.75rem] font-medium text-brand-muted shadow-card transition-colors hover:bg-brand-sunken hover:text-brand-text"
              }
            >
              {a.label}
              {a.primary && <Icons.Arrow className="h-3 w-3" />}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

// ── Live queue panel ────────────────────────────────────────────────────────

function LiveQueuePanel({ queue }: { queue: TranslationJobListItem[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
      <header className="flex items-center justify-between border-b border-brand-borderSoft px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-accent/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-accent" />
          </span>
          <h3 className="m-0 font-display text-[0.9375rem] font-semibold tracking-display text-brand-text">Live queue</h3>
          <span className="text-[0.75rem] text-brand-subtle">· {queue.length}</span>
        </div>
      </header>
      {queue.length === 0 ? (
        <div className="px-4 py-4 text-sm text-brand-subtle">No jobs processing right now.</div>
      ) : (
        <div className="divide-y divide-brand-borderSoft">
          {queue.map((j) => {
            const pct = jobProgress(j);
            const pair = `${getLanguageCode(j.source_language)} → ${getLanguageCode(j.target_language)}`;
            return (
              <div key={j.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[0.8125rem] font-medium text-brand-text">{j.document_name ?? `Job #${j.id}`}</p>
                    <p className="m-0 mt-0.5 flex items-center gap-1.5 text-[0.6875rem] text-brand-muted">
                      <span className="rounded bg-brand-sunken px-1 py-0 font-mono text-brand-muted">{pair}</span>
                      <span className="text-brand-hint">·</span>
                      <span>{stageLabel(j.status)}</span>
                    </p>
                  </div>
                  <span className="whitespace-nowrap font-mono text-[0.6875rem] text-brand-subtle">{estimateEta(j)}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-brand-sunken ring-1 ring-inset ring-black/[0.02]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-accent to-brand-accentHov transition-[width] duration-[1200ms]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-9 text-right font-mono text-[0.625rem] font-medium text-brand-muted">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Decisions log panel ─────────────────────────────────────────────────────

function DecisionsLogPanel({ log }: { log: DecisionLogEntry[] }) {
  const toneFor: Record<string, string> = {
    question:  "bg-brand-accentSoft text-brand-accent",
    glossary:  "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200",
    memory:    "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
    edit:      "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
    completed: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
      <header className="flex items-center justify-between border-b border-brand-borderSoft px-4 py-3">
        <h3 className="m-0 font-display text-[0.9375rem] font-semibold tracking-display text-brand-text">Decisions log</h3>
      </header>
      {log.length === 0 ? (
        <div className="px-4 py-4 text-sm text-brand-subtle">No decisions yet.</div>
      ) : (
        <ul className="divide-y divide-brand-borderSoft">
          {log.map((d) => (
            <li key={d.id} className="flex items-start gap-3 px-4 py-2.5">
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${toneFor[d.type] ?? "bg-brand-sunken text-brand-muted"}`}>
                {d.type === "question" && <Icons.Sparkle className="h-3 w-3" />}
                {d.type === "completed" && <Icons.Check className="h-3 w-3" />}
                {(d.type === "glossary" || d.type === "memory" || d.type === "edit") && (
                  <span className="h-1 w-1 rounded-full bg-current" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[0.75rem] leading-snug text-brand-text">{d.text}</p>
                <p className="m-0 mt-0.5 font-mono text-[0.625rem] text-brand-subtle">{d.when}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function AutopilotPage() {
  const [filter, setFilter] = useState<FilterKey>("all");

  // Real data queries
  const { data: agentStats } = useQuery<AgentStatsResponse>({
    queryKey: ["dashboard", "agent-stats"],
    queryFn: () => dashboardApi.agentStats(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const { data: feedMessages = [] } = useQuery<AgentMessageResponse[]>({
    queryKey: ["dashboard", "agent-feed"],
    queryFn: () => dashboardApi.agentFeed(),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const { data: decisionsLog = [] } = useQuery<DecisionLogEntry[]>({
    queryKey: ["dashboard", "decisions-log"],
    queryFn: () => dashboardApi.decisionsLog(),
    staleTime: 15_000,
  });

  // Live queue: processing jobs from real API
  const { data: jobsData } = useQuery<PaginatedJobsResponse>({
    queryKey: [...queryKeys.translationJobs.all(), "autopilot-queue"],
    queryFn: () => translationJobsApi.listPaginated(1, 50),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  const processingJobs = useMemo(
    () => (jobsData?.jobs ?? []).filter((j) => PROCESSING_STATUSES.has(j.status)),
    [jobsData],
  );

  // Filter feed
  const filteredMessages = useMemo(() => {
    if (filter === "all") return feedMessages;
    if (filter === "questions") return feedMessages.filter((m) => m.kind === "question");
    if (filter === "decisions") return feedMessages.filter((m) => m.kind === "decision");
    return feedMessages.filter((m) => m.kind === "completed");
  }, [feedMessages, filter]);

  const counts: Record<FilterKey, number> = {
    all: feedMessages.length,
    questions: feedMessages.filter((m) => m.kind === "question").length,
    decisions: feedMessages.filter((m) => m.kind === "decision").length,
    completed: feedMessages.filter((m) => m.kind === "completed").length,
  };

  const stats = agentStats ?? {
    blocks_translated: 0,
    decisions_auto: 0,
    decisions_asking: 0,
    saved_minutes: 0,
    insights_raised: 0,
  };

  const savedHours = Math.floor(stats.saved_minutes / 60);
  const savedMins = stats.saved_minutes % 60;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1280px] px-10 py-10">
        <AgentHeader runningCount={processingJobs.length} questionCount={counts.questions} />

        {/* Stats row */}
        <div className="mb-7 grid grid-cols-4 overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
          <AgentStat label="Blocks translated" value={stats.blocks_translated.toLocaleString()} meta="all time" />
          <AgentStat label="Decisions made" value={stats.decisions_auto.toLocaleString()} meta="without asking" bordered />
          <AgentStat label="Asking your call" value={String(stats.decisions_asking)} meta="waiting on you" valueClass="text-brand-accent" bordered />
          <AgentStat label="Time you saved" value={savedHours > 0 ? `${savedHours}h ${savedMins}m` : `${savedMins}m`} meta="vs manual review" bordered />
        </div>

        {/* Body — 2 columns */}
        <div className="grid grid-cols-[1fr_380px] gap-5">
          {/* Left: feed */}
          <div>
            <FeedHeader filter={filter} setFilter={setFilter} counts={counts} />
            {filteredMessages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-brand-border bg-brand-surface p-10 text-center">
                <p className="m-0 font-display text-lg font-semibold text-brand-text">
                  {filter === "all" ? "No activity yet" : `No ${filter} right now`}
                </p>
                <p className="m-0 mt-1.5 text-sm text-brand-muted">
                  Rumi will post here as translations progress.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMessages.map((m) => (
                  <AgentMessageCard key={m.id} message={m} />
                ))}
              </div>
            )}
          </div>

          {/* Right: live queue + decisions log */}
          <aside className="space-y-5">
            <LiveQueuePanel queue={processingJobs} />
            <DecisionsLogPanel log={decisionsLog} />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
