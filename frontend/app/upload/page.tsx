"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import posthog from 'posthog-js';
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

const MAX_FILES = 20;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTS = new Set(["docx", "txt", "rtf", "zip"]);

// ─── types ────────────────────────────────────────────────────────────────────

type TranslationStyle = "natural" | "formal" | "literal";
type FileStatus = "queued" | "uploading" | "translating" | "ready" | "error";

type FileEntry = {
  id: string;
  file: File;
  kind: "file" | "zip";
  targetLanguage: string;
  translationStyle: TranslationStyle;
  industry: string;
  domain: string;
  status: FileStatus;
  jobId: number | null;
  error: string;
  zipSkipped?: string[];
};

type JobStub = { id: number; status: string; error_message: string | null };
type ZipUploadResponse = {
  documents: { id: number; filename: string }[];
  skipped_files: string[];
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function getExt(f: File): string {
  return f.name.toLowerCase().split(".").pop() ?? "";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Shared "Apply to all" defaults
  const [sharedTargetLanguage, setSharedTargetLanguage] = useState("German");
  const [sharedTranslationStyle, setSharedTranslationStyle] =
    useState<TranslationStyle>("natural");
  const [sharedIndustry, setSharedIndustry] = useState("");
  const [sharedDomain, setSharedDomain] = useState("");

  // File queue
  const [fileList, setFileList] = useState<FileEntry[]>([]);

  // UI state
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

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

  // ── file processing ────────────────────────────────────────────────────────

  function processFiles(files: File[]) {
    if (files.length === 0) return;

    const errors: string[] = [];
    const newEntries: FileEntry[] = [];

    for (const f of files) {
      const ext = getExt(f);
      if (!ALLOWED_EXTS.has(ext)) {
        errors.push(`${f.name}: only DOCX, TXT, RTF, ZIP allowed`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`${f.name}: must be under 10 MB`);
        continue;
      }
      if (fileList.length + newEntries.length >= MAX_FILES) {
        errors.push(`Maximum ${MAX_FILES} files reached — ${f.name} skipped`);
        continue;
      }
      newEntries.push({
        id: makeEntryId(f),
        file: f,
        kind: ext === "zip" ? "zip" : "file",
        targetLanguage: sharedTargetLanguage,
        translationStyle: sharedTranslationStyle,
        industry: sharedIndustry,
        domain: sharedDomain,
        status: "queued",
        jobId: null,
        error: "",
      });
    }

    if (errors.length > 0) setGlobalError(errors.join(" · "));
    if (newEntries.length > 0) setFileList((prev) => [...prev, ...newEntries]);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setGlobalError("");
    processFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  }

  // ── drag and drop ──────────────────────────────────────────────────────────

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setGlobalError("");
    processFiles(Array.from(e.dataTransfer.files));
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

  async function pollUntilReady(docId: number, entryId: string): Promise<number> {
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

  async function pollZipDocs(
    docs: { id: number; filename: string }[],
    entryId: string
  ): Promise<void> {
    updateEntry(entryId, { status: "translating" });

    const results = await Promise.allSettled(
      docs.map(async ({ id: docId }) => {
        let jobId: number | null = null;
        for (let attempt = 0; attempt < 30 && jobId === null; attempt++) {
          await sleep(3000);
          try {
            const jobs = await documentsApi.getTranslationJobs<JobStub[]>(docId);
            if (jobs.length > 0) jobId = jobs[0].id;
          } catch {
            // transient — retry
          }
        }
        if (jobId === null) throw new Error("Translation job did not start within 90 s");

        for (let attempt = 0; attempt < 200; attempt++) {
          await sleep(3000);
          const job = await translationJobsApi.getById<JobStub>(jobId);
          if (REVIEW_READY_STATUSES.has(job.status)) return;
          if (job.status === "failed") {
            throw new Error(job.error_message ?? "Translation failed");
          }
        }
        throw new Error("Translation timed out");
      })
    );

    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      const reason = (failures[0] as PromiseRejectedResult).reason;
      updateEntry(entryId, {
        status: "error",
        error: reason instanceof Error ? reason.message : "One or more files failed",
      });
    } else {
      updateEntry(entryId, { status: "ready" });
    }
  }

  // ── submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError("");

    if (fileList.length === 0) {
      setGlobalError("Please add at least one file");
      return;
    }

    setIsProcessing(true);

    // Single non-ZIP file: preserve original redirect behaviour
    if (fileList.length === 1 && fileList[0].kind === "file") {
      const entry = fileList[0];
      setIsUploading(true);
      updateEntry(entry.id, { status: "uploading" });
      try {
        const formData = buildFormData(entry);
        const created = await documentsApi.uploadAndTranslate<{ id: number }>(formData);
        posthog.capture('document_uploaded', { filename: entry.file?.name });
        router.push(`/processing/${created.id}`);
        // Component will unmount on navigation — no further state updates needed
      } catch (err) {
        updateEntry(entry.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Upload failed",
        });
        setIsUploading(false);
        setIsProcessing(false);
      }
      return;
    }

    // Multi-file / ZIP sequential queue
    const snapshot = [...fileList];

    for (const entry of snapshot) {
      updateEntry(entry.id, { status: "uploading" });
      try {
        const formData = buildFormData(entry);
        if (entry.kind === "zip") {
          const result =
            await documentsApi.uploadAndTranslate<ZipUploadResponse>(formData);
          const skipped = result.skipped_files ?? [];
          if (skipped.length > 0) updateEntry(entry.id, { zipSkipped: skipped });
          if (result.documents.length === 0) {
            updateEntry(entry.id, {
              status: "error",
              error: "ZIP contained no valid documents",
            });
            continue;
          }
          await pollZipDocs(result.documents, entry.id);
        } else {
          const created =
            await documentsApi.uploadAndTranslate<{ id: number }>(formData);
          const jobId = await pollUntilReady(created.id, entry.id);
          updateEntry(entry.id, { status: "ready", jobId });
        }
      } catch (err) {
        updateEntry(entry.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Failed",
        });
        // Continue with remaining files
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
    <div className="min-h-screen" style={{ backgroundColor: "#F5F2EC" }}>
      <main className="mx-auto max-w-3xl px-6 py-12">

        {/* ── Header ── */}
        <div className="mb-8">
          <p
            className="mb-1 text-xs font-medium uppercase tracking-widest"
            style={{ color: "#0D7B6E" }}
          >
            New translation
          </p>
          <h1
            className="text-3xl font-semibold"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              color: "#1A110A",
            }}
          >
            Translate Documents
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            DOCX, TXT, RTF, or ZIP · max 10 MB per file · max {MAX_FILES} files
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Drop zone ── */}
          {!isProcessing && (
            <div
              role="button"
              tabIndex={0}
              aria-label="Drop zone — click or drag files here"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ")
                  fileInputRef.current?.click();
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={[
                "cursor-pointer border-2 border-dashed px-8 py-16 text-center transition-colors",
                isDragging
                  ? "border-[#0D7B6E] bg-teal-50"
                  : "border-stone-300 bg-white hover:border-stone-400 hover:bg-stone-50",
              ].join(" ")}
            >
              <div className="flex justify-center">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={isDragging ? "#0D7B6E" : "#9ca3af"}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p
                className={[
                  "mt-3 text-sm font-medium",
                  isDragging ? "text-[#0D7B6E]" : "text-stone-700",
                ].join(" ")}
              >
                Drop documents here
              </p>
              <p className="mt-1 text-xs text-stone-400">or click to browse</p>
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.txt,.rtf,.zip"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />

          {/* ── Apply to all (multi-file, pre-processing) ── */}
          {fileList.length > 1 && !isProcessing && (
            <div className="border border-stone-200 bg-white px-5 py-5">
              <p
                className="mb-3 text-sm font-semibold"
                style={{ color: "#1A110A" }}
              >
                Apply defaults to all files
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-500">
                    Target language
                  </label>
                  <select
                    value={sharedTargetLanguage}
                    onChange={(e) => setSharedTargetLanguage(e.target.value)}
                    className="w-full border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900 focus:border-[#0D7B6E] focus:outline-none"
                  >
                    {TARGET_LANGUAGE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-500">
                    Style
                  </label>
                  <select
                    value={sharedTranslationStyle}
                    onChange={(e) =>
                      setSharedTranslationStyle(e.target.value as TranslationStyle)
                    }
                    className="w-full border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900 focus:border-[#0D7B6E] focus:outline-none"
                  >
                    <option value="natural">Natural</option>
                    <option value="formal">Formal</option>
                    <option value="literal">Literal</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-500">
                    Industry
                  </label>
                  <select
                    value={sharedIndustry}
                    onChange={(e) => setSharedIndustry(e.target.value)}
                    className="w-full border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900 focus:border-[#0D7B6E] focus:outline-none"
                  >
                    {INDUSTRY_OPTIONS.map((o) => (
                      <option key={o.value || "none"} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-500">
                    Domain
                  </label>
                  <select
                    value={sharedDomain}
                    onChange={(e) => setSharedDomain(e.target.value)}
                    className="w-full border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900 focus:border-[#0D7B6E] focus:outline-none"
                  >
                    {DOMAIN_OPTIONS.map((o) => (
                      <option key={o.value || "none"} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={handleApplyToAll}
                className="mt-3 border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
              >
                Apply to all files
              </button>
            </div>
          )}

          {/* ── File list ── */}
          {fileList.length > 0 && (
            <div className="border border-stone-200 bg-white">
              <div className="border-b border-stone-100 px-5 py-3">
                <p className="text-sm font-semibold" style={{ color: "#1A110A" }}>
                  {fileList.length} {fileList.length === 1 ? "file" : "files"} selected
                </p>
              </div>

              <ul className="divide-y divide-stone-100">
                {fileList.map((entry) => (
                  <li key={entry.id} className="px-5 py-4">
                    {/* ZIP skipped warning */}
                    {entry.zipSkipped && entry.zipSkipped.length > 0 && (
                      <div className="mb-3 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        Skipped from ZIP: {entry.zipSkipped.join(", ")}
                      </div>
                    )}

                    {/* Status row — shown while processing or once started */}
                    {isProcessing || entry.status !== "queued" ? (
                      <div className="flex items-start gap-3">
                        <StatusIcon status={entry.status} />
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-sm font-medium"
                            style={{ color: "#1A110A" }}
                          >
                            {entry.file.name}
                          </p>
                          {entry.kind === "zip" && entry.status === "queued" && (
                            <p className="mt-0.5 text-xs text-stone-400">
                              ZIP — contents will be extracted
                            </p>
                          )}
                          <StatusLabel entry={entry} />
                        </div>
                      </div>
                    ) : (
                      /* Config row — shown before processing */
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p
                              className="truncate text-sm font-medium"
                              style={{ color: "#1A110A" }}
                            >
                              {entry.file.name}
                            </p>
                            {entry.kind === "zip" && (
                              <p className="mt-0.5 text-xs text-stone-400">
                                ZIP — contents will be extracted
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(entry.id)}
                            className="shrink-0 px-1.5 py-0.5 text-xs text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                            aria-label={`Remove ${entry.file.name}`}
                          >
                            ×
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <div>
                            <label className="mb-0.5 block text-xs text-stone-500">
                              Language
                            </label>
                            <select
                              value={entry.targetLanguage}
                              onChange={(e) =>
                                updateEntry(entry.id, { targetLanguage: e.target.value })
                              }
                              className="w-full border border-stone-300 bg-white px-2 py-1 text-xs text-stone-900 focus:border-[#0D7B6E] focus:outline-none"
                            >
                              {TARGET_LANGUAGE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-0.5 block text-xs text-stone-500">
                              Style
                            </label>
                            <select
                              value={entry.translationStyle}
                              onChange={(e) =>
                                updateEntry(entry.id, {
                                  translationStyle: e.target.value as TranslationStyle,
                                })
                              }
                              className="w-full border border-stone-300 bg-white px-2 py-1 text-xs text-stone-900 focus:border-[#0D7B6E] focus:outline-none"
                            >
                              <option value="natural">Natural</option>
                              <option value="formal">Formal</option>
                              <option value="literal">Literal</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-0.5 block text-xs text-stone-500">
                              Industry
                            </label>
                            <input
                              type="text"
                              value={entry.industry}
                              onChange={(e) =>
                                updateEntry(entry.id, { industry: e.target.value })
                              }
                              placeholder="Optional"
                              className="w-full border border-stone-300 px-2 py-1 text-xs text-stone-900 placeholder-stone-400 focus:border-[#0D7B6E] focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-xs text-stone-500">
                              Domain
                            </label>
                            <input
                              type="text"
                              value={entry.domain}
                              onChange={(e) =>
                                updateEntry(entry.id, { domain: e.target.value })
                              }
                              placeholder="Optional"
                              className="w-full border border-stone-300 px-2 py-1 text-xs text-stone-900 placeholder-stone-400 focus:border-[#0D7B6E] focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {/* Summary row when all done */}
              {allDone && (
                <div className="border-t border-stone-100 px-5 py-4">
                  <p className="text-sm font-medium" style={{ color: "#1A110A" }}>
                    All done —{" "}
                    <span style={{ color: "#0D7B6E" }}>{readyCount} ready</span>
                    {errorCount > 0 && (
                      <span className="text-red-600"> · {errorCount} failed</span>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Global error ── */}
          {globalError && (
            <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {globalError}
            </p>
          )}

          {/* ── Actions ── */}
          {!allDone && (
            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={isUploading || isProcessing || fileList.length === 0}
                className="rounded-full px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: "#082012" }}
              >
                {isUploading
                  ? "Uploading…"
                  : isProcessing
                    ? "Translating…"
                    : fileList.length === 1
                      ? "Translate"
                      : `Translate${fileList.length > 0 ? ` (${fileList.length})` : ""}`}
              </button>
              <button
                type="button"
                onClick={() => router.push("/documents")}
                className="text-sm text-stone-500 transition-colors hover:text-stone-900"
              >
                Cancel
              </button>
            </div>
          )}

          {allDone && (
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => router.push("/documents")}
                className="rounded-full px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#082012" }}
              >
                View all translations
              </button>
              <button
                type="button"
                onClick={() => {
                  setFileList([]);
                  setIsProcessing(false);
                  setGlobalError("");
                }}
                className="text-sm text-stone-500 transition-colors hover:text-stone-900"
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
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-50 text-xs font-bold text-green-700">
        ✓
      </span>
    );
  if (status === "error")
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-50 text-xs font-bold text-red-600">
        ✗
      </span>
    );
  if (status === "uploading" || status === "translating")
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs"
        style={{ color: "#0D7B6E" }}
      >
        ⟳
      </span>
    );
  // queued
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs text-stone-400">
      ·
    </span>
  );
}

function StatusLabel({ entry }: { entry: FileEntry }) {
  if (entry.status === "queued")
    return <p className="mt-0.5 text-xs text-stone-400">Queued</p>;
  if (entry.status === "uploading")
    return (
      <p className="mt-0.5 text-xs" style={{ color: "#0D7B6E" }}>
        Uploading…
      </p>
    );
  if (entry.status === "translating")
    return (
      <p className="mt-0.5 text-xs" style={{ color: "#0D7B6E" }}>
        Translating…
      </p>
    );
  if (entry.status === "error")
    return (
      <p className="mt-0.5 text-xs text-red-600">{entry.error || "Failed"}</p>
    );
  // ready
  if (entry.kind === "zip") {
    return (
      <p className="mt-0.5 text-xs text-green-700">
        Ready —{" "}
        <Link
          href="/documents"
          className="font-medium underline hover:text-green-900"
        >
          View all translations
        </Link>
      </p>
    );
  }
  return (
    <p className="mt-0.5 text-xs text-green-700">
      Ready —{" "}
      <Link
        href={`/translation-jobs/${entry.jobId}?page=1`}
        className="font-medium underline hover:text-green-900"
      >
        Open review
      </Link>
    </p>
  );
}
