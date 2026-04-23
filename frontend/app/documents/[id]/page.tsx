"use client";

/**
 * Document detail page — central hub for a document and all its translations.
 * Dark identity band + expandable translation cards with quality rings.
 */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useDashboardStore } from "../../stores/dashboardStore";
import { documentsApi, overviewApi, translationJobsApi } from "../../services/api";
import type { DocumentDetail, OverviewResponse } from "../../services/api";
import { AppShell } from "../../components/AppShell";
import { StatusBadge, toJobStatus } from "../../components/StatusBadge";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { NewTranslationModal } from "../../dashboard/NewTranslationModal";
import { getLanguageCode, getLanguageDisplayName, getLanguageFlag } from "../../utils/language";
import { SegmentedControl } from "../../components/SegmentedControl";

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return "—";
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Quality ring SVG ────────────────────────────────────────────────────────

function QualityRing({ score }: { score: number }) {
  const r = 27;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <svg width="68" height="68" viewBox="0 0 68 68">
      <circle cx="34" cy="34" r={r} fill="none" stroke="#E5E0D8" strokeWidth="5" />
      <circle cx="34" cy="34" r={r} fill="none" stroke="#0D7B6E" strokeWidth="5" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 34 34)" className="transition-all duration-700" />
      <text x="34" y="38" textAnchor="middle" className="fill-brand-text text-sm font-bold">{score}%</text>
    </svg>
  );
}

function qualityBadge(score: number): { label: string; sub: string; classes: string } {
  if (score >= 90) return { label: "Excellent", sub: "Above average for this document type", classes: "bg-status-successBg text-status-success" };
  if (score >= 70) return { label: "Good", sub: "A few blocks may need attention", classes: "bg-status-warningBg text-status-warning" };
  return { label: "Needs review", sub: "Review recommended before exporting", classes: "bg-status-errorBg text-status-error" };
}

// ── Settings panel ──────────────────────────────────────────────────────────

const STYLE_OPTIONS = [
  { label: "Natural", value: "natural" },
  { label: "Formal", value: "formal" },
  { label: "Literal", value: "literal" },
];
const FORMALITY_OPTIONS = [
  { label: "Neutral", value: "neutral" },
  { label: "Polite", value: "polite" },
  { label: "Direct", value: "direct" },
];
const REVIEW_OPTIONS = [
  { label: "Autopilot", value: "autopilot" },
  { label: "Manual", value: "manual" },
];
const INDUSTRY_OPTIONS = ["General", "Legal", "Medical", "Technical", "Marketing", "Financial"];
const DOMAIN_OPTIONS = ["General", "Contract law", "Consumer goods", "Software", "Healthcare"];

function SettingsPanel({
  style: initialStyle,
  reviewMode: initialReviewMode,
  industry: initialIndustry,
  domain: initialDomain,
  formality: initialFormality,
  glossaryEnabled: initialGlossary,
  isPostTranslation,
  jobId,
  onRefresh,
}: {
  style: string;
  reviewMode: string;
  industry: string | null;
  domain: string | null;
  formality: string;
  glossaryEnabled: boolean;
  isPostTranslation: boolean;
  jobId?: number;
  onRefresh?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [styleVal, setStyleVal] = useState(initialStyle);
  const [formalityVal, setFormalityVal] = useState(initialFormality);
  const [industryVal, setIndustryVal] = useState(initialIndustry ?? "General");
  const [domainVal, setDomainVal] = useState(initialDomain ?? "General");
  const [reviewVal, setReviewVal] = useState(initialReviewMode);
  const [glossaryVal, setGlossaryVal] = useState(initialGlossary);

  const summaryLabel = `${styleVal.charAt(0).toUpperCase() + styleVal.slice(1)} · ${formalityVal.charAt(0).toUpperCase() + formalityVal.slice(1)} · ${industryVal} · ${reviewVal === "autopilot" ? "Autopilot" : "Manual"}`;

  return (
    <div className="rounded-lg border border-brand-border">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-brand-bg transition-colors"
      >
        <p className="text-xs text-brand-muted">{summaryLabel}</p>
        <span className="text-xs text-brand-subtle transition-transform" style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>▶</span>
      </button>
      {expanded && (
        <div className="border-t border-brand-border px-3 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[0.6875rem] font-medium text-brand-subtle">Style</label>
              <SegmentedControl options={STYLE_OPTIONS} value={styleVal} onChange={setStyleVal} />
            </div>
            <div>
              <label className="mb-1 block text-[0.6875rem] font-medium text-brand-subtle">Formality</label>
              <SegmentedControl options={FORMALITY_OPTIONS} value={formalityVal} onChange={setFormalityVal} />
            </div>
            <div>
              <label className="mb-1 block text-[0.6875rem] font-medium text-brand-subtle">Industry</label>
              <select value={industryVal} onChange={(e) => setIndustryVal(e.target.value)} className="w-full rounded-lg border border-brand-border bg-brand-surface px-2 py-1 text-xs text-brand-text outline-none focus:border-brand-accent">
                {INDUSTRY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[0.6875rem] font-medium text-brand-subtle">Domain</label>
              <select value={domainVal} onChange={(e) => setDomainVal(e.target.value)} className="w-full rounded-lg border border-brand-border bg-brand-surface px-2 py-1 text-xs text-brand-text outline-none focus:border-brand-accent">
                {DOMAIN_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[0.6875rem] font-medium text-brand-subtle">Review mode</label>
              <SegmentedControl options={REVIEW_OPTIONS} value={reviewVal} onChange={setReviewVal} />
            </div>
            <div>
              <label className="mb-1 block text-[0.6875rem] font-medium text-brand-subtle">Glossary</label>
              <button
                type="button"
                onClick={() => setGlossaryVal(!glossaryVal)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${glossaryVal ? "bg-brand-accent text-white" : "border border-brand-border bg-brand-surface text-brand-muted"}`}
              >
                {glossaryVal ? "✓ Enabled" : "Disabled"}
              </button>
            </div>
          </div>
          <p className="text-[0.6875rem] text-brand-subtle">
            {isPostTranslation ? "Any change queues a new translation run." : "Changes apply to this translation only. Other languages inherit these as defaults."}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Translation card ────────────────────────────────────────────────────────

type JobOverview = OverviewResponse;

function TranslationCard({ overview, onRefresh }: { overview: JobOverview; onRefresh: () => void }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [confirmAction, setConfirmAction] = useState<"delete" | "retranslate" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const s = overview.summary;
  const qb = qualityBadge(s.quality_score);
  const style = overview.tone_applied ?? "natural";
  const styleLabel = style.charAt(0).toUpperCase() + style.slice(1);
  const reviewMode = overview.review_mode ?? "autopilot";

  const primaryHref = `/translation-jobs/${overview.job_id}`;
  const primaryLabel = overview.status === "in_review" ? "Open Review →" : overview.status === "exported" ? "Download" : "View";
  const isPrimaryCta = overview.status === "in_review";

  async function handleConfirm() {
    setActionLoading(true);
    try {
      if (confirmAction === "delete") await translationJobsApi.delete(overview.job_id);
      else if (confirmAction === "retranslate") await translationJobsApi.retranslate(overview.job_id);
      onRefresh();
    } catch (err) { console.error("[card-action]", err); }
    finally { setActionLoading(false); setConfirmAction(null); }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface">
      {/* Header — always visible */}
      <button type="button" onClick={() => setExpanded(!expanded)} className="flex w-full items-center gap-2 px-5 py-3.5 text-left hover:bg-brand-bg transition-colors">
        <span className="rounded-full bg-brand-accentMid px-2.5 py-0.5 text-xs font-medium text-brand-accent">{getLanguageCode(overview.source_language)} → {getLanguageCode(overview.target_language)}</span>
        {s.quality_score > 0 && <span className="text-sm font-semibold text-brand-accent">{s.quality_score}%</span>}
        <span className="text-xs text-brand-muted">{styleLabel}</span>
        <StatusBadge status={toJobStatus(overview.status)} />
        <div className="ml-auto flex items-center gap-2">
          <Link href={primaryHref} onClick={(e) => e.stopPropagation()} className={`no-underline ${isPrimaryCta ? "rounded-full bg-brand-accent px-3 py-1 text-xs font-medium text-white hover:bg-brand-accentHov transition-colors" : "rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-xs font-medium text-brand-muted hover:bg-brand-bg transition-colors"}`}>{primaryLabel}</Link>
          <span className="text-xs text-brand-muted transition-transform" style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>▶</span>
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="flex border-t border-brand-border">
          {/* Left panel */}
          <div className="flex-1 space-y-4 p-5">
            <div className="flex items-center gap-4">
              <QualityRing score={s.quality_score} />
              <div>
                <span className={`rounded-full px-2.5 py-0.5 text-[0.6875rem] font-medium ${qb.classes}`}>{qb.label}</span>
                <p className="mt-1 text-xs text-brand-subtle">{qb.sub}</p>
                {s.word_count > 0 && <p className="mt-0.5 text-xs text-brand-subtle">~{(s.word_count / 250).toFixed(1)} hrs saved</p>}
              </div>
            </div>
            <div>
              <h4 className="mb-2 font-display text-sm font-semibold text-brand-text">Here&apos;s what Helvara did</h4>
              <div className="space-y-1.5 text-xs text-brand-muted">
                {s.ambiguity_count > 0 ? <p className="text-status-warning">{s.ambiguity_count} {s.ambiguity_count === 1 ? "ambiguity" : "ambiguities"} flagged</p> : <p>No ambiguities detected</p>}
                <p>{styleLabel} register maintained</p>
                {s.glossary_match_count > 0 && <p>{s.glossary_match_count} glossary {s.glossary_match_count === 1 ? "term" : "terms"} applied</p>}
              </div>
            </div>
            <p className="text-xs text-brand-subtle">{s.word_count.toLocaleString()} words · {s.total_blocks} blocks</p>
            <SettingsPanel
              style={style}
              reviewMode={reviewMode}
              industry={null}
              domain={null}
              formality="neutral"
              glossaryEnabled={true}
              isPostTranslation={true}
              jobId={overview.job_id}
              onRefresh={onRefresh}
            />
          </div>

          {/* Right panel */}
          <div className="w-64 shrink-0 space-y-4 border-l border-brand-border bg-brand-bg p-5">
            <div>
              {overview.status === "exported" && (<>
                <p className="mb-1 text-2xl">✅</p>
                <p className="text-sm font-semibold text-brand-text">Translation ready</p>
                <div className="mt-3 space-y-2">
                  <Link href={`/translation-jobs/${overview.job_id}`} className="block w-full rounded-full border border-brand-border bg-brand-surface px-3 py-1.5 text-center text-xs font-medium text-brand-muted no-underline hover:bg-brand-bg transition-colors">Download again</Link>
                  <Link href={`/translation-jobs/${overview.job_id}`} className="block w-full rounded-full bg-brand-accent px-3 py-1.5 text-center text-xs font-medium text-white no-underline hover:bg-brand-accentHov transition-colors">Review →</Link>
                </div>
              </>)}
              {overview.status === "in_review" && (<>
                <p className="mb-1 text-2xl">🔍</p>
                <p className="text-sm font-semibold text-brand-text">Review before export</p>
                <Link href={`/translation-jobs/${overview.job_id}`} className="mt-3 block w-full rounded-full bg-brand-accent px-3 py-1.5 text-center text-xs font-medium text-white no-underline hover:bg-brand-accentHov transition-colors">Open Review →</Link>
              </>)}
              {overview.status !== "exported" && overview.status !== "in_review" && (<>
                <p className="mb-1 text-2xl">⏳</p>
                <p className="text-sm font-semibold text-brand-text">In progress</p>
                <p className="mt-1 text-xs text-brand-muted">Translation is being processed.</p>
              </>)}
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-brand-muted">Translated</span><span className="text-brand-text">{formatDate(overview.created_at)}</span></div>
            </div>
            <div className="flex gap-3 border-t border-brand-border pt-3">
              <button type="button" onClick={() => setConfirmAction("retranslate")} className="text-xs text-brand-muted hover:text-brand-text">Re-translate</button>
              <button type="button" onClick={() => setConfirmAction("delete")} className="text-xs text-status-error hover:underline">Delete</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={confirmAction === "retranslate"} title="Re-translate?" description="The existing translation will be replaced." confirmLabel="Re-translate" onConfirm={() => { void handleConfirm(); }} onCancel={() => setConfirmAction(null)} loading={actionLoading} />
      <ConfirmDialog open={confirmAction === "delete"} title="Delete this translation?" description="The document will be kept." confirmLabel="Delete" onConfirm={() => { void handleConfirm(); }} onCancel={() => setConfirmAction(null)} loading={actionLoading} variant="destructive" />
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const openTranslationModal = useDashboardStore((s) => s.openTranslationModal);
  const documentId = Number(params.id);

  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [overviews, setOverviews] = useState<JobOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (hasHydrated && !token) router.replace("/login");
  }, [hasHydrated, token, router]);

  function loadPage() {
    if (!token || Number.isNaN(documentId)) return;
    setLoading(true);
    documentsApi.getById<DocumentDetail>(documentId)
      .then(async (d) => {
        setDoc(d);
        type JobListItem = { id: number; status: string };
        const jobs = await documentsApi.getTranslationJobs<JobListItem[]>(documentId);
        const activeJobs = jobs.filter((j) => !["queued", "parsing"].includes(j.status));
        const ovs = await Promise.all(
          activeJobs.map((j) => overviewApi.get(j.id).catch(() => null))
        );
        setOverviews(ovs.filter((o): o is JobOverview => o !== null));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load document"))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadPage(); }, [documentId, token]);

  async function handleDeleteDocument() {
    setDeleting(true);
    try { await documentsApi.delete(documentId); router.replace("/documents"); }
    catch (err) { console.error("[delete-doc]", err); }
    finally { setDeleting(false); setDeleteConfirmOpen(false); }
  }

  if (!hasHydrated || !token) return null;
  if (loading) return <AppShell><div className="px-8 py-10 text-brand-muted">Loading…</div></AppShell>;
  if (error || !doc) return <AppShell><div className="px-8 py-10 text-status-error">{error || "Document not found"}</div></AppShell>;

  const hasJobs = overviews.length > 0;
  const inReviewCount = overviews.filter((o) => o.status === "in_review").length;
  const exportedCount = overviews.filter((o) => o.status === "exported").length;
  const totalWords = overviews.reduce((sum, o) => sum + (o.summary.word_count || 0), 0);

  return (
    <AppShell>
      {/* Dark identity band */}
      <div className="bg-brand-text px-8 py-8">
        <div className="mx-auto max-w-[1100px]">
          <p className="mb-3 text-xs text-white/50">
            <Link href="/documents" className="text-white/60 no-underline hover:text-white/80">Documents</Link>
            {" › "}<span className="text-white/40">{doc.filename}</span>
          </p>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">📄</span>
                <h1 className="font-display text-2xl font-bold text-white">{doc.filename}</h1>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-white/50">
                {totalWords > 0 && <span>{totalWords.toLocaleString()} words</span>}
                <span>{getLanguageFlag(doc.source_language)} {getLanguageDisplayName(doc.source_language)}</span>
                <span>Uploaded {formatRelative(doc.created_at)}</span>
                <span>{overviews.length} {overviews.length === 1 ? "translation" : "translations"}</span>
              </div>
            </div>
            <button type="button" onClick={() => setDeleteConfirmOpen(true)} className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white hover:border-white/40 transition-colors">Delete document</button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1100px] gap-6 px-8 py-8">
        {/* Main content */}
        <div className="min-w-0 flex-1 space-y-6">
          {hasJobs ? (<>
            {/* Stat strip */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
                <p className="text-xs font-medium text-brand-muted">Translations</p>
                <p className="mt-1 font-display text-2xl font-bold text-brand-text">{overviews.length}</p>
              </div>
              <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
                <p className="text-xs font-medium text-brand-muted">In Review</p>
                <p className={`mt-1 font-display text-2xl font-bold ${inReviewCount > 0 ? "text-brand-accent" : "text-brand-subtle"}`}>{inReviewCount}</p>
              </div>
              <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
                <p className="text-xs font-medium text-brand-muted">Exported</p>
                <p className={`mt-1 font-display text-2xl font-bold ${exportedCount > 0 ? "text-status-success" : "text-brand-subtle"}`}>{exportedCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <h2 className="font-display text-lg font-bold text-brand-text">Translations</h2>
              <div className="h-0.5 w-8 rounded-sm bg-brand-accent" />
            </div>
            <div className="space-y-4">
              {overviews.map((ov) => <TranslationCard key={ov.job_id} overview={ov} onRefresh={loadPage} />)}
            </div>
          </>) : (
            <div>
              <div className="mb-4 flex items-center gap-3">
                <h2 className="font-display text-lg font-bold text-brand-text">Translate this document</h2>
                <div className="h-0.5 w-8 rounded-sm bg-brand-accent" />
              </div>
              <p className="mb-6 text-sm text-brand-muted">No translations yet. Choose a target language to get started.</p>
              <button type="button" onClick={() => openTranslationModal()} className="rounded-full bg-brand-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-accentHov transition-colors">+ New Translation</button>
            </div>
          )}
        </div>

        {/* Right rail */}
        <div className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 space-y-4">
            <h3 className="font-display text-sm font-semibold text-brand-text">{doc.filename}</h3>
            <div className="space-y-2 rounded-xl border border-brand-border bg-brand-surface p-4 text-xs">
              <div className="flex justify-between"><span className="text-brand-muted">Words</span><span className="text-brand-text">{totalWords > 0 ? totalWords.toLocaleString() : "—"}</span></div>
              <div className="flex justify-between"><span className="text-brand-muted">Source</span><span className="text-brand-text">{getLanguageDisplayName(doc.source_language)}</span></div>
              <div className="flex justify-between"><span className="text-brand-muted">Type</span><span className="text-brand-text">{doc.file_type.toUpperCase()}</span></div>
              <div className="flex justify-between"><span className="text-brand-muted">Uploaded</span><span className="text-brand-text">{formatDate(doc.created_at)}</span></div>
            </div>
            {overviews.length > 0 && (
              <div className="space-y-2 rounded-xl border border-brand-border bg-brand-surface p-4 text-xs">
                <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-widest text-brand-subtle">Translations</p>
                {overviews.map((ov) => (
                  <div key={ov.job_id} className="flex items-center justify-between">
                    <span className="text-brand-text">{getLanguageFlag(ov.target_language)} {getLanguageDisplayName(ov.target_language)}</span>
                    <StatusBadge status={toJobStatus(ov.status)} />
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => setDeleteConfirmOpen(true)} className="w-full text-xs text-status-error hover:underline">Delete document</button>
          </div>
        </div>
      </div>

      <NewTranslationModal projects={[]} />
      <ConfirmDialog open={deleteConfirmOpen} title="Delete this document permanently?" description="This will remove the uploaded file and all translations. This cannot be undone." confirmLabel="Delete" onConfirm={() => { void handleDeleteDocument(); }} onCancel={() => setDeleteConfirmOpen(false)} loading={deleting} variant="destructive" />
    </AppShell>
  );
}
