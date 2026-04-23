"use client";

/**
 * Documents page — cross-project flat view with toggle between Documents (one row
 * per file) and Jobs (one row per translation). Search + project/status filters.
 */

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useDashboardStore } from "../stores/dashboardStore";
import { documentsApi, translationJobsApi, queryKeys } from "../services/api";
import type {
  GroupedDocument,
  GroupedDocumentsResponse,
  PaginatedJobsResponse,
  TranslationJobListItem,
  ProjectResponse,
} from "../services/api";
import { useProjects } from "../hooks/queries";
import { AppShell } from "../components/AppShell";
import { NewTranslationModal } from "../dashboard/NewTranslationModal";
import { Icons } from "../components/Icons";
import { getLanguageCode } from "../utils/language";

// ── Helpers ─────────────────────────────────────────────────────────────────

function fileExt(name: string): string {
  return (name.split(".").pop() ?? "").toUpperCase();
}

function fileIconTone(ext: string): string {
  if (ext === "DOCX" || ext === "DOC") return "bg-blue-50 text-blue-700 ring-blue-200/60";
  if (ext === "RTF") return "bg-violet-50 text-violet-700 ring-violet-200/60";
  if (ext === "TXT") return "bg-slate-50 text-slate-600 ring-slate-200/60";
  return "bg-brand-sunken text-brand-muted ring-brand-border";
}

function FileIcon({ name }: { name: string }) {
  const ext = fileExt(name);
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-[0.625rem] font-semibold ring-1 ring-inset ${fileIconTone(ext)}`}>
      {ext.slice(0, 4)}
    </span>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    pending: "Pending",
    processing: "Processing",
    in_review: "In review",
    completed: "Completed",
    exported: "Exported",
    queued: "Processing",
    parsing: "Processing",
    translating: "Processing",
    translation_queued: "Processing",
    review: "In review",
    ready_for_export: "Completed",
  };
  return map[s] ?? s;
}

function statusDotColor(status: string): string {
  if (status === "in_review" || status === "review") return "bg-brand-accent";
  if (status === "completed" || status === "exported" || status === "ready_for_export") return "bg-emerald-500";
  if (status === "processing" || status === "translating" || status === "queued" || status === "parsing" || status === "translation_queued") return "bg-amber-500";
  return "bg-brand-subtle";
}

function jobChipTone(status: string): string {
  if (status === "in_review" || status === "review") return "bg-brand-accentSoft text-brand-accent ring-brand-accent/15";
  if (status === "completed" || status === "exported" || status === "ready_for_export") return "bg-emerald-50 text-emerald-700 ring-emerald-200/50";
  if (status === "processing" || status === "translating" || status === "queued" || status === "parsing" || status === "translation_queued") return "bg-amber-50 text-amber-700 ring-amber-200/50";
  return "bg-brand-sunken text-brand-subtle ring-brand-border";
}

function isProcessingStatus(s: string): boolean {
  return ["processing", "queued", "parsing", "translating", "translation_queued"].includes(s);
}

function jobProgress(j: TranslationJobListItem): number {
  if (!j.progress_total_segments || j.progress_total_segments === 0) return 0;
  return Math.round((j.progress_completed_segments / j.progress_total_segments) * 100);
}

// ── Filter select ───────────────────────────────────────────────────────────

function FilterSelect({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-full border border-brand-border bg-brand-surface py-2 pl-3.5 pr-8 text-[0.8125rem] text-brand-text shadow-card focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/15"
      >
        {children}
      </select>
      <Icons.ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-brand-subtle" />
    </div>
  );
}

// ── Documents table ─────────────────────────────────────────────────────────

function DocumentsTable({ rows }: { rows: GroupedDocument[] }) {
  const router = useRouter();
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
      <header className="grid grid-cols-[2.2fr_1.6fr_0.8fr_1.6fr_0.7fr] gap-4 border-b border-brand-borderSoft bg-brand-sunken/50 px-5 py-2.5 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-subtle">
        <span>Document</span>
        <span>Project</span>
        <span className="text-right">Words</span>
        <span>Languages · status</span>
        <span className="text-right">Uploaded</span>
      </header>
      <ul className="m-0 list-none divide-y divide-brand-borderSoft p-0">
        {rows.map((d) => {
          const reviewCount = d.jobs.filter((j) => j.status === "in_review" || j.status === "review").length;
          const projectName = d.jobs[0]?.project_name ?? "—";
          return (
            <li key={d.id}>
              <button
                onClick={() => router.push(`/documents/${d.id}`)}
                className="group grid w-full grid-cols-[2.2fr_1.6fr_0.8fr_1.6fr_0.7fr] items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-brand-sunken/60"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <FileIcon name={d.filename} />
                  <div className="min-w-0">
                    <p className="m-0 truncate text-sm font-medium text-brand-text">{d.filename}</p>
                    <p className="m-0 mt-0.5 text-[0.6875rem] text-brand-subtle">
                      {d.jobs.length} {d.jobs.length === 1 ? "translation" : "translations"}
                    </p>
                  </div>
                </div>
                <p className="m-0 truncate text-[0.8125rem] text-brand-muted">{projectName}</p>
                <p className="m-0 text-right font-mono text-xs tabular-nums text-brand-muted">
                  {d.word_count.toLocaleString()}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {d.jobs.map((j) => (
                    <span
                      key={j.id}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[0.6875rem] font-medium ring-1 ring-inset ${jobChipTone(j.status)}`}
                    >
                      {getLanguageCode(j.target_language)}
                    </span>
                  ))}
                  {reviewCount > 0 && (
                    <span className="ml-1 rounded-full bg-brand-accentSoft px-2 py-0.5 text-[0.6875rem] font-semibold text-brand-accent ring-1 ring-inset ring-brand-accent/15">
                      {reviewCount} review
                    </span>
                  )}
                </div>
                <p className="m-0 text-right text-[0.6875rem] text-brand-subtle">
                  {formatDate(d.uploaded_at)}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Jobs table ──────────────────────────────────────────────────────────────

function JobsTable({ rows }: { rows: TranslationJobListItem[] }) {
  const router = useRouter();
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
      <header className="grid grid-cols-[2fr_1.5fr_0.8fr_1fr_0.7fr_0.6fr] gap-4 border-b border-brand-borderSoft bg-brand-sunken/50 px-5 py-2.5 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-subtle">
        <span>Document</span>
        <span>Project</span>
        <span>Language</span>
        <span>Status</span>
        <span className="text-right">Flags</span>
        <span className="text-right">Mode</span>
      </header>
      <ul className="m-0 list-none divide-y divide-brand-borderSoft p-0">
        {rows.map((j) => {
          const pct = jobProgress(j);
          const proc = isProcessingStatus(j.status);
          return (
            <li key={j.id}>
              <button
                onClick={() => {
                  if (j.status === "in_review" || j.status === "review") {
                    router.push(`/translation-jobs/${j.id}`);
                  } else {
                    router.push(`/documents/${j.document_id}`);
                  }
                }}
                className="group grid w-full grid-cols-[2fr_1.5fr_0.8fr_1fr_0.7fr_0.6fr] items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-brand-sunken/60"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <FileIcon name={j.document_name ?? "file"} />
                  <p className="m-0 truncate text-sm font-medium text-brand-text">{j.document_name ?? `Job #${j.id}`}</p>
                </div>
                <p className="m-0 truncate text-[0.8125rem] text-brand-muted">
                  {j.project_name ?? <span className="italic text-brand-subtle">No project</span>}
                </p>
                <p className="m-0 font-mono text-[0.75rem] tabular-nums text-brand-text">
                  {(j.source_language ?? "EN").toUpperCase()} → {getLanguageCode(j.target_language)}
                </p>
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${statusDotColor(j.status)}`} />
                  <span className="text-xs text-brand-muted">{statusLabel(j.status)}</span>
                  {proc && (
                    <div className="ml-auto flex items-center gap-1.5">
                      <div className="h-1 w-12 overflow-hidden rounded-full bg-brand-sunken">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-accent to-brand-accentHov"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="font-mono text-[0.625rem] text-brand-subtle">{pct}%</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  {/* TODO: PIR-XXX wire ambiguity/insights counts to API */}
                </div>
                <p className="m-0 text-right text-[0.6875rem] text-brand-subtle">
                  {j.translation_style === "manual" ? "Manual" : "Autopilot"}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const router = useRouter();
  const openTranslationModal = useDashboardStore((s) => s.openTranslationModal);
  const { data: projects = [] } = useProjects();

  const [mode, setMode] = useState<"documents" | "jobs">("documents");
  const [q, setQ] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Fetch documents (grouped)
  const { data: docsData } = useQuery<GroupedDocumentsResponse>({
    queryKey: [...queryKeys.documents.all(), "grouped"],
    queryFn: () => documentsApi.listGrouped(1, 100),
    staleTime: 15_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
  });

  // Fetch jobs (paginated)
  const { data: jobsData } = useQuery<PaginatedJobsResponse>({
    queryKey: [...queryKeys.translationJobs.all(), "paginated"],
    queryFn: () => translationJobsApi.listPaginated(1, 100),
    staleTime: 15_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
  });

  const allDocs = docsData?.documents ?? [];
  const allJobs = jobsData?.jobs ?? [];

  const qlc = q.trim().toLowerCase();

  const filteredDocs = useMemo(() => {
    return allDocs.filter((d) => {
      if (projectFilter !== "all") {
        const hasProject = d.jobs.some((j) => String(j.project_id) === projectFilter);
        if (!hasProject) return false;
      }
      if (qlc) {
        const nameMatch = d.filename.toLowerCase().includes(qlc);
        const projMatch = d.jobs.some((j) => j.project_name?.toLowerCase().includes(qlc));
        if (!nameMatch && !projMatch) return false;
      }
      return true;
    });
  }, [allDocs, projectFilter, qlc]);

  const filteredJobs = useMemo(() => {
    return allJobs.filter((j) => {
      if (projectFilter !== "all" && String(j.project_id) !== projectFilter) return false;
      if (statusFilter !== "all") {
        const canonical = isProcessingStatus(j.status) ? "processing" : j.status;
        if (canonical !== statusFilter) return false;
      }
      if (qlc) {
        const nameMatch = (j.document_name ?? "").toLowerCase().includes(qlc);
        const projMatch = (j.project_name ?? "").toLowerCase().includes(qlc);
        const langMatch = j.target_language.toLowerCase().includes(qlc);
        if (!nameMatch && !projMatch && !langMatch) return false;
      }
      return true;
    });
  }, [allJobs, projectFilter, statusFilter, qlc]);

  const totalProjects = new Set(allJobs.map((j) => j.project_id).filter(Boolean)).size;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px] px-10 py-10">
        {/* Header */}
        <header className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="m-0 mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-brand-subtle">
              Workspace
            </p>
            <h1 className="m-0 font-display text-[2.5rem] font-semibold leading-[1.05] tracking-display text-brand-text">
              Documents
            </h1>
            <p className="m-0 mt-2.5 text-[0.9375rem] text-brand-muted">
              <span className="font-medium text-brand-text">{allDocs.length}</span> files ·{" "}
              <span className="font-medium text-brand-text">{allJobs.length}</span> translation jobs across {totalProjects} projects
            </p>
          </div>
          <button
            onClick={() => openTranslationModal()}
            className="flex items-center gap-1.5 rounded-full bg-brand-text px-4 py-2 text-[0.8125rem] font-medium text-white shadow-card transition-all hover:bg-brand-accent"
          >
            <Icons.Plus className="h-3.5 w-3.5" /> New translation
          </button>
        </header>

        {/* Filter bar */}
        <div className="mb-5 flex items-center gap-3">
          <div className="inline-flex rounded-full border border-brand-border bg-brand-surface p-0.5 shadow-card">
            {([
              { k: "documents" as const, label: "Documents", count: allDocs.length },
              { k: "jobs" as const, label: "Jobs", count: allJobs.length },
            ]).map((t) => (
              <button
                key={t.k}
                onClick={() => setMode(t.k)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors ${
                  mode === t.k ? "bg-brand-text text-white" : "text-brand-muted hover:text-brand-text"
                }`}
              >
                {t.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[0.625rem] tabular-nums ${mode === t.k ? "bg-white/20" : "bg-brand-sunken"}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Icons.Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-hint" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search files, projects, languages…"
                className="w-full rounded-full border border-brand-border bg-brand-surface py-2 pl-9 pr-3.5 text-[0.8125rem] text-brand-text shadow-card placeholder:text-brand-subtle focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/15"
              />
            </div>
            <FilterSelect value={projectFilter} onChange={setProjectFilter}>
              <option value="all">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={String(p.id)}>{p.name}</option>
              ))}
            </FilterSelect>
            {mode === "jobs" && (
              <FilterSelect value={statusFilter} onChange={setStatusFilter}>
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="in_review">In review</option>
                <option value="completed">Completed</option>
                <option value="exported">Exported</option>
              </FilterSelect>
            )}
          </div>
        </div>

        {/* Table */}
        {mode === "documents" ? (
          filteredDocs.length > 0 ? (
            <DocumentsTable rows={filteredDocs} />
          ) : null
        ) : (
          filteredJobs.length > 0 ? (
            <JobsTable rows={filteredJobs} />
          ) : null
        )}

        {/* Empty state */}
        {((mode === "documents" && filteredDocs.length === 0) || (mode === "jobs" && filteredJobs.length === 0)) && (
          <div className="mt-6 rounded-2xl border border-dashed border-brand-border bg-brand-surface p-10 text-center shadow-card">
            <p className="m-0 font-display text-lg font-semibold text-brand-text">No matches</p>
            <p className="m-0 mt-1.5 text-sm text-brand-muted">Try clearing a filter or changing your search.</p>
          </div>
        )}
      </div>

      <NewTranslationModal projects={projects} />
    </AppShell>
  );
}
