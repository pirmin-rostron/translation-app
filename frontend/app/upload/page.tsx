"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { documentsApi, translationJobsApi } from "../services/api";

// ─── constants ────────────────────────────────────────────────────────────────

const TARGET_LANGUAGE_OPTIONS = [
  { value: "German", label: "German" },
  { value: "French", label: "French" },
  { value: "Dutch", label: "Dutch" },
  { value: "Spanish", label: "Spanish" },
  { value: "Japanese", label: "Japanese" },
  { value: "Korean", label: "Korean" },
];

const INDUSTRY_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "Government", label: "Government" },
  { value: "Healthcare", label: "Healthcare" },
  { value: "Legal", label: "Legal" },
  { value: "Financial Services", label: "Financial Services" },
  { value: "Technology", label: "Technology" },
];

const DOMAIN_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "Contract", label: "Contract" },
  { value: "Policy", label: "Policy" },
  { value: "Procedure", label: "Procedure" },
  { value: "Technical Manual", label: "Technical Manual" },
  { value: "Marketing Content", label: "Marketing Content" },
];

const REVIEW_READY_STATUSES = new Set([
  "in_review",
  "draft_saved",
  "review_complete",
  "ready_for_export",
  "exported",
]);

// ─── types ────────────────────────────────────────────────────────────────────

type TranslationStyle = "natural" | "formal" | "literal";
type FileStatus = "queued" | "uploading" | "translating" | "ready" | "error";

type FileEntry = {
  id: string;
  file: File;
  targetLanguage: string;
  translationStyle: TranslationStyle;
  industry: string;
  domain: string;
  status: FileStatus;
  jobId: number | null;
  error: string;
};

type JobStub = { id: number; status: string; error_message: string | null };

// ─── helpers ──────────────────────────────────────────────────────────────────

function isValidFile(f: File): boolean {
  const ext = f.name.toLowerCase().split(".").pop();
  return ext === "docx" || ext === "txt" || ext === "rtf";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeEntryId(f: File): string {
  return `${f.name}-${f.lastModified}-${Math.random().toString(36).slice(2)}`;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const router = useRouter();

  // Shared "Apply to all" defaults
  const [sharedTargetLanguage, setSharedTargetLanguage] = useState("German");
  const [sharedTranslationStyle, setSharedTranslationStyle] = useState<TranslationStyle>("natural");
  const [sharedIndustry, setSharedIndustry] = useState("");
  const [sharedDomain, setSharedDomain] = useState("");

  // File queue
  const [fileList, setFileList] = useState<FileEntry[]>([]);

  // UI state
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalError, setGlobalError] = useState("");

  // ── derived ────────────────────────────────────────────────────────────────

  const allDone =
    fileList.length > 0 &&
    fileList.every((e) => e.status === "ready" || e.status === "error");
  const readyCount = fileList.filter((e) => e.status === "ready").length;
  const errorCount = fileList.filter((e) => e.status === "error").length;

  // ── state helpers ──────────────────────────────────────────────────────────

  function updateEntry(id: string, patch: Partial<FileEntry>) {
    setFileList((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
    );
  }

  // ── file selection ─────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-selecting the same file later

    if (selected.length === 0) return;

    const errors: string[] = [];
    const newEntries: FileEntry[] = [];

    for (const f of selected) {
      if (!isValidFile(f)) {
        errors.push(`${f.name}: only DOCX, TXT, RTF allowed`);
        continue;
      }
      if (f.size > 10 * 1024 * 1024) {
        errors.push(`${f.name}: must be under 10 MB`);
        continue;
      }
      newEntries.push({
        id: makeEntryId(f),
        file: f,
        targetLanguage: sharedTargetLanguage,
        translationStyle: sharedTranslationStyle,
        industry: sharedIndustry,
        domain: sharedDomain,
        status: "queued",
        jobId: null,
        error: "",
      });
    }

    setGlobalError(errors.join(" • "));
    setFileList((prev) => [...prev, ...newEntries]);
  }

  function handleRemoveFile(id: string) {
    setFileList((prev) => prev.filter((e) => e.id !== id));
  }

  function handleApplyToAll() {
    setFileList((prev) =>
      prev.map((e) => ({
        ...e,
        targetLanguage: sharedTargetLanguage,
        translationStyle: sharedTranslationStyle,
        industry: sharedIndustry,
        domain: sharedDomain,
      }))
    );
  }

  // ── polling ────────────────────────────────────────────────────────────────

  // Returns the jobId once the document is uploaded, a job exists, and that
  // job reaches a review-ready status.  Updates the entry's status to
  // "translating" as soon as the job ID is known.
  async function pollUntilReady(docId: number, entryId: string): Promise<number> {
    // Step 1: wait for the translation job to be created (max 90 s)
    let jobId: number | null = null;
    for (let attempt = 0; attempt < 30 && jobId === null; attempt++) {
      await sleep(3000);
      try {
        const jobs = await documentsApi.getTranslationJobs<JobStub[]>(docId);
        if (jobs.length > 0) {
          jobId = jobs[0].id;
          updateEntry(entryId, { status: "translating", jobId });
        }
      } catch {
        // transient — retry
      }
    }
    if (jobId === null) throw new Error("Translation job did not start within 90 s");

    // Step 2: wait for job to reach a review-ready status (max 10 min)
    for (let attempt = 0; attempt < 200; attempt++) {
      await sleep(3000);
      const job = await translationJobsApi.getById<JobStub>(jobId);
      if (REVIEW_READY_STATUSES.has(job.status)) return jobId;
      if (job.status === "failed") {
        throw new Error(job.error_message ?? "Translation failed");
      }
    }
    throw new Error("Translation timed out");
  }

  // ── submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError("");

    if (fileList.length === 0) {
      setGlobalError("Please select at least one file");
      return;
    }

    setIsProcessing(true);

    // ── single-file: preserve original redirect-to-processing behaviour ──
    if (fileList.length === 1) {
      const entry = fileList[0];
      updateEntry(entry.id, { status: "uploading" });
      try {
        const formData = buildFormData(entry);
        const created = await documentsApi.uploadAndTranslate<{ id: number }>(formData);
        router.push(`/processing/${created.id}`);
        // component will unmount on navigation — no further state updates needed
      } catch (err) {
        updateEntry(entry.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Upload failed",
        });
        setIsProcessing(false);
      }
      return;
    }

    // ── multi-file: sequential queue ──
    // Snapshot the list so the loop is stable even if setFileList fires.
    const snapshot = [...fileList];

    for (const entry of snapshot) {
      updateEntry(entry.id, { status: "uploading" });
      try {
        const formData = buildFormData(entry);
        const created = await documentsApi.uploadAndTranslate<{ id: number }>(formData);
        const jobId = await pollUntilReady(created.id, entry.id);
        updateEntry(entry.id, { status: "ready", jobId });
      } catch (err) {
        updateEntry(entry.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Failed",
        });
        // continue with remaining files
      }
    }

    setIsProcessing(false);
  }

  function buildFormData(entry: FileEntry): FormData {
    const fd = new FormData();
    fd.append("file", entry.file);
    fd.append("target_language", entry.targetLanguage);
    fd.append("translation_style", entry.translationStyle);
    if (entry.industry.trim()) fd.append("industry", entry.industry.trim());
    if (entry.domain.trim()) fd.append("domain", entry.domain.trim());
    return fd;
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Upload Documents</h1>
        <p className="mb-6 text-sm text-slate-600">
          Select one or more files. Each will be parsed, translated, and queued for review.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── file picker ── */}
          {!isProcessing && (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <label
                htmlFor="files"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Files <span className="font-normal text-slate-400">(DOCX, TXT, RTF — max 10 MB each)</span>
              </label>
              <input
                id="files"
                type="file"
                accept=".docx,.txt,.rtf"
                multiple
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-slate-800 hover:file:bg-slate-200"
              />
            </div>
          )}

          {/* ── apply-to-all defaults (only shown while configuring) ── */}
          {fileList.length > 0 && !isProcessing && (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-slate-700">Apply defaults to all files</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Target language</label>
                  <select
                    value={sharedTargetLanguage}
                    onChange={(e) => setSharedTargetLanguage(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    {TARGET_LANGUAGE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Style</label>
                  <select
                    value={sharedTranslationStyle}
                    onChange={(e) => setSharedTranslationStyle(e.target.value as TranslationStyle)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <option value="natural">Natural</option>
                    <option value="formal">Formal</option>
                    <option value="literal">Literal</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Industry</label>
                  <select
                    value={sharedIndustry}
                    onChange={(e) => setSharedIndustry(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    {INDUSTRY_OPTIONS.map((o) => (
                      <option key={o.value || "none"} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Domain</label>
                  <select
                    value={sharedDomain}
                    onChange={(e) => setSharedDomain(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    {DOMAIN_OPTIONS.map((o) => (
                      <option key={o.value || "none"} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={handleApplyToAll}
                className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Apply to all files
              </button>
            </div>
          )}

          {/* ── file list ── */}
          {fileList.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-3">
                <p className="text-sm font-semibold text-slate-700">
                  {fileList.length} {fileList.length === 1 ? "file" : "files"} selected
                </p>
              </div>

              <ul className="divide-y divide-slate-100">
                {fileList.map((entry) => (
                  <li key={entry.id} className="px-5 py-4">
                    {/* ── status row (during / after processing) ── */}
                    {isProcessing || entry.status !== "queued" ? (
                      <div className="flex items-start gap-3">
                        <StatusIcon status={entry.status} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{entry.file.name}</p>
                          <StatusLabel entry={entry} />
                        </div>
                      </div>
                    ) : (
                      /* ── config row (before processing) ── */
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-slate-900">{entry.file.name}</p>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(entry.id)}
                            className="shrink-0 rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            aria-label={`Remove ${entry.file.name}`}
                          >
                            ×
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <div>
                            <label className="mb-0.5 block text-xs text-slate-500">Language</label>
                            <select
                              value={entry.targetLanguage}
                              onChange={(e) =>
                                updateEntry(entry.id, { targetLanguage: e.target.value })
                              }
                              className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                            >
                              {TARGET_LANGUAGE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-0.5 block text-xs text-slate-500">Style</label>
                            <select
                              value={entry.translationStyle}
                              onChange={(e) =>
                                updateEntry(entry.id, {
                                  translationStyle: e.target.value as TranslationStyle,
                                })
                              }
                              className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                            >
                              <option value="natural">Natural</option>
                              <option value="formal">Formal</option>
                              <option value="literal">Literal</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-0.5 block text-xs text-slate-500">Industry</label>
                            <input
                              type="text"
                              value={entry.industry}
                              onChange={(e) =>
                                updateEntry(entry.id, { industry: e.target.value })
                              }
                              placeholder="Optional"
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                            />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-xs text-slate-500">Domain</label>
                            <input
                              type="text"
                              value={entry.domain}
                              onChange={(e) =>
                                updateEntry(entry.id, { domain: e.target.value })
                              }
                              placeholder="Optional"
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {/* ── summary row when all done ── */}
              {allDone && (
                <div className="border-t border-slate-100 px-5 py-4">
                  <p className="text-sm font-medium text-slate-700">
                    All done —{" "}
                    <span className="text-emerald-700">{readyCount} ready</span>
                    {errorCount > 0 && (
                      <span className="text-red-600"> · {errorCount} failed</span>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── global error ── */}
          {globalError && (
            <p className="text-sm text-red-600">{globalError}</p>
          )}

          {/* ── actions ── */}
          {!allDone && (
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isProcessing || fileList.length === 0}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isProcessing
                  ? "Translating…"
                  : fileList.length === 1
                    ? "Translate document"
                    : `Translate all ${fileList.length > 0 ? `(${fileList.length})` : ""}`}
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back to All Translations
              </button>
            </div>
          )}

          {allDone && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Back to All Translations
              </button>
              <button
                type="button"
                onClick={() => {
                  setFileList([]);
                  setIsProcessing(false);
                  setGlobalError("");
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Upload more
              </button>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: FileStatus }) {
  if (status === "ready")
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
        ✓
      </span>
    );
  if (status === "error")
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">
        ✗
      </span>
    );
  if (status === "uploading" || status === "translating")
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs text-indigo-600">
        ⟳
      </span>
    );
  // queued
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-400">
      ·
    </span>
  );
}

function StatusLabel({ entry }: { entry: FileEntry }) {
  if (entry.status === "queued")
    return <p className="mt-0.5 text-xs text-slate-400">Queued</p>;
  if (entry.status === "uploading")
    return <p className="mt-0.5 text-xs text-indigo-600">Uploading…</p>;
  if (entry.status === "translating")
    return <p className="mt-0.5 text-xs text-indigo-600">Translating…</p>;
  if (entry.status === "error")
    return <p className="mt-0.5 text-xs text-red-600">{entry.error || "Failed"}</p>;
  // ready
  return (
    <p className="mt-0.5 text-xs text-emerald-700">
      Ready —{" "}
      <Link
        href={`/translation-jobs/${entry.jobId}?page=1`}
        className="font-medium underline hover:text-emerald-900"
      >
        Open review
      </Link>
    </p>
  );
}
