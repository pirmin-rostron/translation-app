"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getLanguageDisplayName, SOURCE_LANGUAGE_OVERRIDE_OPTIONS } from "../../utils/language";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Document = {
  id: number;
  filename: string;
  file_type: string;
  source_language: string | null;
  target_language: string;
  industry: string | null;
  domain: string | null;
  status: string;
  error_message?: string | null;
  created_at: string;
};

type TranslationJob = {
  id: number;
  document_id: number;
  status: string;
  translation_style?: "natural" | "literal" | null;
  error_message?: string | null;
  created_at: string;
};

type Segment = {
  id: number;
  document_id: number;
  block_id: number | null;
  segment_index: number;
  segment_type: string;
  source_text: string;
  context_before: string | null;
  context_after: string | null;
  heading_path: string | null;
  created_at: string;
};

type DocumentBlock = {
  id: number;
  document_id: number;
  block_index: number;
  block_type: "heading" | "paragraph" | "bullet_item";
  text_original: string;
  text_translated: string | null;
  formatting_json: Record<string, unknown> | null;
  created_at: string;
};

type ProcessingStageJob = {
  id: number;
  stage_name: string;
  status: string;
  error_message: string | null;
  attempt_count: number;
};

type DocumentProgress = {
  document_id: number;
  stage_label: string;
  percentage: number;
  eta_seconds: number | null;
  is_complete: boolean;
  is_active: boolean;
};

type TranslationProgress = {
  job_id: number;
  stage_label: string;
  total_segments: number;
  completed_segments: number;
  percentage: number;
  eta_seconds: number | null;
  is_complete: boolean;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function formatEta(seconds: number | null) {
  if (seconds == null) return "Calculating…";
  if (seconds <= 0) return "Almost done";
  if (seconds < 60) return `~${seconds}s remaining`;
  const mins = Math.ceil(seconds / 60);
  return `~${mins}m remaining`;
}

export default function DocumentDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const [doc, setDoc] = useState<Document | null>(null);
  const [blocks, setBlocks] = useState<DocumentBlock[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [jobs, setJobs] = useState<TranslationJob[]>([]);
  const [docStages, setDocStages] = useState<ProcessingStageJob[]>([]);
  const [docProgress, setDocProgress] = useState<DocumentProgress | null>(null);
  const [translationProgress, setTranslationProgress] = useState<TranslationProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingSourceLanguage, setEditingSourceLanguage] = useState(false);
  const [sourceLanguageEdit, setSourceLanguageEdit] = useState("");
  const [sourceLanguageSuccess, setSourceLanguageSuccess] = useState("");
  const [translationStyle, setTranslationStyle] = useState<"natural" | "literal">("natural");

  const fetchDoc = () => {
    fetch(`${API_URL}/api/documents/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        return res.json();
      })
      .then(setDoc)
      .catch((err) => setError(err.message));
  };

  const fetchSegments = () => {
    fetch(`${API_URL}/api/documents/${id}/segments`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load segments (${res.status})`);
        return res.json();
      })
      .then(setSegments)
      .catch((err) => setError(err.message));
  };

  const fetchBlocks = () => {
    fetch(`${API_URL}/api/documents/${id}/blocks`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load blocks (${res.status})`);
        return res.json();
      })
      .then(setBlocks)
      .catch((err) => setError(err.message));
  };

  const fetchJobs = () => {
    fetch(`${API_URL}/api/documents/${id}/translation-jobs`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setJobs)
      .catch(() => setJobs([]));
  };

  const fetchDocStages = () => {
    fetch(`${API_URL}/api/documents/${id}/stages`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setDocStages)
      .catch(() => setDocStages([]));
  };

  const fetchDocProgress = () => {
    fetch(`${API_URL}/api/documents/${id}/progress`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setDocProgress)
      .catch(() => setDocProgress(null));
  };

  const fetchTranslationProgress = (jobId: number) => {
    fetch(`${API_URL}/api/translation-jobs/${jobId}/progress`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setTranslationProgress)
      .catch(() => setTranslationProgress(null));
  };

  useEffect(() => {
    if (Number.isNaN(id)) {
      setError("Invalid document ID");
      setLoading(false);
      return;
    }
    Promise.all([
      fetch(`${API_URL}/api/documents/${id}`).then((r) => {
        if (!r.ok) throw new Error(`Failed to load (${r.status})`);
        return r.json();
      }),
      fetch(`${API_URL}/api/documents/${id}/blocks`).then((r) => {
        if (!r.ok) return [];
        return r.json();
      }),
      fetch(`${API_URL}/api/documents/${id}/segments`).then((r) => {
        if (!r.ok) return [];
        return r.json();
      }),
      fetch(`${API_URL}/api/documents/${id}/translation-jobs`).then((r) =>
        r.ok ? r.json() : []
      ),
      fetch(`${API_URL}/api/documents/${id}/stages`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_URL}/api/documents/${id}/progress`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([d, b, s, j, ds, dp]) => {
        setDoc(d);
        setBlocks(b);
        setSegments(s);
        setJobs(j);
        setDocStages(ds);
        setDocProgress(dp);
        if (j.length > 0) {
          fetchTranslationProgress(j[0].id);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!doc) return;
    const activeStage = docStages.find((stage) => stage.status === "queued" || stage.status === "running");
    const activeJob = jobs.find((job) => job.status === "translation_queued" || job.status === "translating");
    if (!activeStage && !activeJob) return;
    const timer = window.setInterval(() => {
      fetchDoc();
      fetchBlocks();
      fetchSegments();
      fetchJobs();
      fetchDocStages();
      fetchDocProgress();
      if (jobs.length > 0) {
        fetchTranslationProgress(jobs[0].id);
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [doc, docStages, jobs]);

  const handleCreateJob = async () => {
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/documents/${id}/translation-jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ translation_style: translationStyle }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Failed (${res.status})`);
      }
      const job = await res.json();
      fetchJobs();
      window.location.href = `/translation-jobs/${job.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
    }
  };

  const handleSaveSourceLanguage = async () => {
    setError("");
    setSourceLanguageSuccess("");
    try {
      const res = await fetch(`${API_URL}/api/documents/${id}/source-language`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_language: sourceLanguageEdit }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Failed (${res.status})`);
      }
      const updated = await res.json();
      setDoc(updated);
      setEditingSourceLanguage(false);
      setSourceLanguageSuccess("Source language updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const handleParse = async () => {
    setError("");
    setDoc((prev) => (prev ? { ...prev, status: "parsing", error_message: null } : prev));
    try {
      const res = await fetch(`${API_URL}/api/documents/${id}/parse`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Parse failed (${res.status})`);
      }
      const updated = await res.json();
      setDoc(updated);
      fetchBlocks();
      fetchSegments();
      fetchDocStages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parse failed");
    }
  };

  const handleRetryDoc = async () => {
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/documents/${id}/retry`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Retry failed (${res.status})`);
      }
      const updated = await res.json();
      setDoc(updated);
      fetchDocStages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 p-6">Loading…</div>;
  if (error && !doc) return <div className="min-h-screen bg-slate-50 p-6 text-red-600">{error}</div>;
  if (!doc) return null;
  const latestDocStage = docStages[docStages.length - 1];
  const latestJob = jobs[0];
  const parseFailed = doc.status === "parse_failed";
  const showActiveParsing = doc.status === "parsing" && Boolean(docProgress?.is_active);

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link
          href="/documents"
          className="text-sm text-slate-600 hover:text-slate-900 mb-6 inline-block"
        >
          ← Back to documents
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">{doc.filename}</h1>

        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Metadata</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Type</dt>
              <dd className="font-medium">{doc.file_type}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Source</dt>
              <dd className="font-medium flex items-center gap-2">
                {editingSourceLanguage ? (
                  <>
                    <select
                      value={sourceLanguageEdit}
                      onChange={(e) => setSourceLanguageEdit(e.target.value)}
                      className="rounded border border-slate-300 px-2 py-1 text-sm bg-white"
                    >
                      {SOURCE_LANGUAGE_OVERRIDE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleSaveSourceLanguage}
                      className="text-xs px-2 py-1 bg-slate-900 text-white rounded hover:bg-slate-800"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingSourceLanguage(false);
                        setSourceLanguageEdit("");
                      }}
                      className="text-xs px-2 py-1 border border-slate-300 rounded hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    {getLanguageDisplayName(doc.source_language)}
                    <button
                      onClick={() => {
                        const current = doc.source_language?.toLowerCase();
                        const match = SOURCE_LANGUAGE_OVERRIDE_OPTIONS.find((o) => o.value === current);
                        setSourceLanguageEdit(match ? match.value : "en");
                        setEditingSourceLanguage(true);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-700 underline"
                    >
                      Edit
                    </button>
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Target</dt>
              <dd className="font-medium">{getLanguageDisplayName(doc.target_language)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Industry</dt>
              <dd className="font-medium">{doc.industry ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Domain</dt>
              <dd className="font-medium">{doc.domain ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Document status</dt>
              <dd>
                <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                  {doc.status}
                </span>
                {doc.error_message && <p className="mt-1 text-xs text-red-600">{doc.error_message}</p>}
                {latestDocStage && (
                  <p className="mt-1 text-xs text-slate-500">
                    Stage: {latestDocStage.stage_name} ({latestDocStage.status})
                  </p>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Translation lifecycle</dt>
              <dd>
                <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                  {latestJob?.status ?? "no_translation_job"}
                </span>
                {latestJob?.error_message && <p className="mt-1 text-xs text-red-600">{latestJob.error_message}</p>}
                {latestJob && (
                  <p className="mt-1 text-xs text-slate-500">
                    Style: {latestJob.translation_style === "literal" ? "Literal" : "Natural"}
                  </p>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Created</dt>
              <dd className="font-medium">{formatDate(doc.created_at)}</dd>
            </div>
          </dl>
          {showActiveParsing && docProgress && (
            <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
              <p className="text-sm font-medium text-indigo-900">Parsing document…</p>
              <p className="mt-1 text-sm text-slate-700">{docProgress.stage_label}</p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-indigo-100">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, docProgress.percentage))}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-600">
                {docProgress.percentage.toFixed(0)}% • {formatEta(docProgress.eta_seconds)}
              </p>
            </div>
          )}
          {translationProgress && !translationProgress.is_complete && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
              <p className="text-sm font-medium text-emerald-900">Translating document…</p>
              <p className="mt-1 text-sm text-slate-700">{translationProgress.stage_label}</p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, translationProgress.percentage))}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-600">
                {translationProgress.percentage.toFixed(0)}% • {translationProgress.completed_segments}/
                {translationProgress.total_segments} segments • {formatEta(translationProgress.eta_seconds)}
              </p>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            {doc.status === "parsed" && segments.length > 0 && (
              <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Translation style</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="translation-style"
                      value="natural"
                      checked={translationStyle === "natural"}
                      onChange={() => setTranslationStyle("natural")}
                    />
                    <span>Natural (recommended)</span>
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="translation-style"
                      value="literal"
                      checked={translationStyle === "literal"}
                      onChange={() => setTranslationStyle("literal")}
                    />
                    <span>Literal / precise</span>
                  </label>
                </div>
              </div>
            )}
            {(doc.status === "uploaded" || parseFailed) && (
              <button
                onClick={parseFailed ? handleRetryDoc : handleParse}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800"
              >
                {parseFailed ? "Retry document processing" : "Parse document"}
              </button>
            )}
            {doc.status === "parsed" && segments.length > 0 && (
              <button
                onClick={handleCreateJob}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800"
              >
                Create Translation Job
              </button>
            )}
            {jobs.length > 0 && (
              <Link
                href={`/translation-jobs/${jobs[0].id}`}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 inline-block"
              >
                View translation results
              </Link>
            )}
            {latestJob?.error_message && <p className="text-red-600 text-sm w-full">{latestJob.error_message}</p>}
            {error && <p className="text-red-600 text-sm w-full">{error}</p>}
            {sourceLanguageSuccess && <p className="text-green-600 text-sm w-full">{sourceLanguageSuccess}</p>}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Parsed blocks</h2>
          {blocks.length === 0 && (doc.status === "uploaded" || parseFailed) && (
            <p className="text-slate-600">
              Parse the document to view headings, paragraphs, and bullet items.
            </p>
          )}
          {blocks.length === 0 && doc.status === "parsed" && (
            <p className="text-slate-600">No parsed blocks (document may be empty).</p>
          )}
          {doc.status === "parsed" && segments.length > 0 && (
            <p className="mb-3 text-sm text-emerald-700">
              Parsed successfully: {segments.length} segments ready for translation.
            </p>
          )}
          {blocks.length > 0 && (
            <ol className="space-y-4">
              {blocks.map((block) => (
                <li
                  key={block.id}
                  className="border-l-2 border-slate-200 pl-4 py-2"
                >
                  <span className="text-xs text-slate-500 font-mono">
                    Block {block.block_index + 1} ({block.block_type})
                  </span>
                  {block.block_type === "heading" ? (
                    <h3 className="mt-1 text-lg font-semibold text-slate-900">{block.text_original}</h3>
                  ) : block.block_type === "bullet_item" ? (
                    <div className="mt-1 flex gap-3 text-slate-900">
                      <span className="text-slate-400">{String(block.formatting_json?.marker ?? "\u2022")}</span>
                      <p>{block.text_original}</p>
                    </div>
                  ) : (
                    <p className="mt-1 text-slate-900">{block.text_original}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </main>
    </div>
  );
}
