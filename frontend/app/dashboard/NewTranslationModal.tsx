"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDashboardStore } from "../stores/dashboardStore";
import { documentsApi, queryKeys } from "../services/api";
import type { ProjectResponse } from "../services/api";
import { ModalOverlay } from "./ModalOverlay";
import { trackEvent } from "../utils/analytics";
import { getLanguageDisplayName, getLanguageFlag } from "../utils/language";

const LANGUAGE_OPTIONS = [
  { value: "English",  label: "English" },
  { value: "German",   label: "German" },
  { value: "French",   label: "French" },
  { value: "Dutch",    label: "Dutch" },
  { value: "Spanish",  label: "Spanish" },
  { value: "Japanese", label: "Japanese" },
  { value: "Korean",   label: "Korean" },
  { value: "Thai",     label: "Thai" },
];

const ALLOWED_EXTS = new Set(["docx", "txt", "rtf"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const TARGET_LANG_STORAGE_KEY = "helvara_last_target_language";

// Common function words per language for lightweight client-side detection.
// We only need enough to distinguish the 8 supported languages from each other.
const LANG_WORD_SETS: Record<string, Set<string>> = {
  English: new Set(["the", "and", "is", "in", "to", "of", "a", "that", "it", "for", "was", "with", "are", "be", "this", "have", "from", "not", "but", "by"]),
  German:  new Set(["der", "die", "und", "ist", "das", "den", "ein", "eine", "auf", "für", "mit", "dem", "sich", "nicht", "von", "des", "auch", "nach", "wie", "als"]),
  French:  new Set(["le", "la", "les", "de", "des", "du", "un", "une", "est", "et", "en", "que", "qui", "dans", "pour", "pas", "sur", "sont", "avec", "ce"]),
  Dutch:   new Set(["de", "het", "een", "van", "en", "is", "dat", "op", "zijn", "voor", "niet", "met", "aan", "ook", "maar", "wordt", "naar", "bij", "uit", "nog"]),
  Spanish: new Set(["el", "la", "los", "las", "de", "del", "en", "que", "es", "un", "una", "por", "con", "para", "como", "más", "pero", "sus", "este", "ya"]),
};

/** Read a text sample from a file and guess the source language. */
async function detectSourceLanguage(file: File): Promise<string | null> {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  // For DOCX we can't easily read text client-side; skip detection
  if (ext === "docx") return null;

  const slice = file.slice(0, 8192);
  const raw = await slice.text();

  // For RTF files, strip control codes to get approximate plain text
  let text = raw;
  if (ext === "rtf") {
    text = text.replace(/\{[^}]*\}/g, " ").replace(/\\[a-zA-Z]+-?\d*\s?/g, " ");
  }

  const words = text.toLowerCase().match(/[a-zA-Zà-ÿ]+/g);
  if (!words || words.length < 10) return null;

  // Check for CJK/Thai characters first
  const cjkCount = (text.match(/[\u3000-\u9FFF\uF900-\uFAFF]/g) ?? []).length;
  const hangulCount = (text.match(/[\uAC00-\uD7AF\u1100-\u11FF]/g) ?? []).length;
  const thaiCount = (text.match(/[\u0E00-\u0E7F]/g) ?? []).length;
  if (thaiCount > 20) return "Thai";
  if (hangulCount > 20) return "Korean";
  if (cjkCount > 20) return "Japanese";

  // Score Latin-script languages by function-word frequency
  const scores: { lang: string; count: number }[] = [];
  for (const [lang, wordSet] of Object.entries(LANG_WORD_SETS)) {
    const count = words.filter((w) => wordSet.has(w)).length;
    scores.push({ lang, count });
  }
  scores.sort((a, b) => b.count - a.count);
  // Only return if the top language has meaningfully more hits than the second
  if (scores[0].count >= 3 && scores[0].count > scores[1].count * 1.3) {
    return scores[0].lang;
  }
  return null;
}

export function NewTranslationModal({ projects }: { projects: ProjectResponse[] }) {
  const queryClient = useQueryClient();
  const open = useDashboardStore((s) => s.translationModalOpen);
  const preselectedProjectId = useDashboardStore((s) => s.preselectedProjectId);
  const closeModal = useDashboardStore((s) => s.closeTranslationModal);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [detectedSourceLang, setDetectedSourceLang] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(TARGET_LANG_STORAGE_KEY) ?? "German";
    }
    return "German";
  });
  const [reviewMode, setReviewMode] = useState<"autopilot" | "manual">("autopilot");
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const sameLanguage = detectedSourceLang !== null && detectedSourceLang === targetLang;

  // Pre-select project when modal opens with a project context
  const prevPreselected = useRef<number | null>(null);
  if (open && preselectedProjectId !== null && prevPreselected.current !== preselectedProjectId) {
    prevPreselected.current = preselectedProjectId;
    setProjectId(String(preselectedProjectId));
  }
  if (!open && prevPreselected.current !== null) {
    prevPreselected.current = null;
  }

  const runDetection = useCallback(async (f: File) => {
    const detected = await detectSourceLanguage(f);
    setDetectedSourceLang(detected);
  }, []);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const f = files[0];
    const ext = f.name.toLowerCase().split(".").pop() ?? "";
    if (!ALLOWED_EXTS.has(ext)) {
      setError("Only DOCX, TXT, and RTF files are allowed.");
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError("File must be under 10 MB.");
      return;
    }
    setError("");
    setFile(f);
    void runDetection(f);
  }

  // Persist target language preference
  useEffect(() => {
    localStorage.setItem(TARGET_LANG_STORAGE_KEY, targetLang);
  }, [targetLang]);

  async function handleSubmit() {
    if (!file) {
      setError("Please select a file.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("target_language", targetLang);
      // Inherit tone from selected project, fallback to "natural"
      const selectedProject = projectId && projectId !== "__new__"
        ? projects.find((p) => String(p.id) === projectId)
        : null;
      fd.append("translation_style", selectedProject?.default_tone ?? "natural");
      fd.append("review_mode", reviewMode);
      if (selectedProject) {
        fd.append("project_id", String(selectedProject.id));
      }
      const prevCount = queryClient.getQueryData<unknown[]>(queryKeys.translationJobs.recent())?.length ?? 0;
      trackEvent("flow.upload_started", { target_language: targetLang });
      await documentsApi.uploadAndTranslate<{ id: number }>(fd);
      trackEvent("flow.upload_complete");
      handleClose();
      // Poll until the new job appears in the list (Celery creates it async)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        await queryClient.invalidateQueries({ queryKey: queryKeys.translationJobs.recent() });
        const current = queryClient.getQueryData<unknown[]>(queryKeys.translationJobs.recent())?.length ?? 0;
        if (current > prevCount || attempts >= 10) {
          clearInterval(poll);
        }
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setSubmitting(false);
    }
  }

  function handleClose() {
    setFile(null);
    setDetectedSourceLang(null);
    setProjectId("");
    setError("");
    setSubmitting(false);
    closeModal();
  }

  return (
    <ModalOverlay open={open} onClose={handleClose}>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="m-0 font-display text-2xl font-bold text-brand-text">
            New Translation
          </h2>
          <p className="mt-1 font-sans text-[0.8125rem] text-brand-subtle">
            Upload a document to translate
          </p>
        </div>
        <button
          onClick={handleClose}
          className="cursor-pointer border-none bg-transparent p-1 text-xl text-brand-subtle"
        >
          ×
        </button>
      </div>

      {/* Upload zone */}
      <div
        role="button"
        tabIndex={0}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
        }}
        className={`mb-5 cursor-pointer rounded-xl p-8 text-center transition-colors ${
          isDragging
            ? "border-2 border-dashed border-brand-accent bg-brand-accentMid"
            : "border-2 border-dashed border-brand-border bg-brand-bg"
        }`}
      >
        {file ? (
          <div>
            <p className="m-0 font-sans text-sm font-medium text-brand-text">
              {file.name}
            </p>
            <p className="mt-1 font-sans text-xs text-brand-subtle">
              Click to change file
            </p>
          </div>
        ) : (
          <div>
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke={isDragging ? "#0D7B6E" : "#9E9189"}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mx-auto mb-2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="m-0 font-sans text-[0.8125rem] font-medium text-brand-muted">
              Drop file here or click to browse
            </p>
            <p className="mt-1 font-sans text-[0.6875rem] text-brand-subtle">
              DOCX, RTF, TXT — max 10 MB
            </p>
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.txt,.rtf"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Target language — inherited from project or manual selector */}
      {(() => {
        const selectedProject = projectId && projectId !== "__new__"
          ? projects.find((p) => String(p.id) === projectId)
          : null;
        const inheritedLangs = selectedProject?.target_languages ?? [];
        if (inheritedLangs.length > 0) {
          return (
            <div className="mb-4">
              <label className="mb-1.5 block font-sans text-[0.8125rem] font-medium text-brand-muted">
                Translate to
              </label>
              <p className="mb-2 text-xs text-brand-subtle">
                Languages inherited from project:
              </p>
              <div className="flex flex-wrap gap-2">
                {inheritedLangs.map((lang) => (
                  <span
                    key={lang}
                    className="rounded-full bg-brand-accentMid px-3 py-1 text-xs font-medium text-brand-accent"
                  >
                    {getLanguageFlag(lang)} {getLanguageDisplayName(lang)}
                  </span>
                ))}
              </div>
            </div>
          );
        }
        return (
          <div className="mb-4">
            <label className="mb-1.5 block font-sans text-[0.8125rem] font-medium text-brand-muted">
              Translate to
            </label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-sans text-sm text-brand-text outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
            >
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-brand-subtle">Source language is auto-detected from your document</p>
            {sameLanguage && (
              <p className="mt-1.5 text-xs text-status-warning">
                Source and target language are the same — please select a different target language.
              </p>
            )}
          </div>
        );
      })()}

      {/* Review mode */}
      <div className="mb-4">
        <label className="mb-1.5 block font-sans text-[0.8125rem] font-medium text-brand-muted">
          Review mode
        </label>
        <div className="flex overflow-hidden rounded-full border border-brand-border">
          <button
            type="button"
            onClick={() => setReviewMode("autopilot")}
            className={`flex-1 px-4 py-2 text-center text-sm font-medium transition-colors ${
              reviewMode === "autopilot"
                ? "bg-brand-accent text-white"
                : "bg-brand-surface text-brand-muted hover:bg-brand-bg"
            }`}
          >
            Autopilot
          </button>
          <button
            type="button"
            onClick={() => setReviewMode("manual")}
            className={`flex-1 px-4 py-2 text-center text-sm font-medium transition-colors ${
              reviewMode === "manual"
                ? "bg-brand-accent text-white"
                : "bg-brand-surface text-brand-muted hover:bg-brand-bg"
            }`}
          >
            Manual review
          </button>
        </div>
        <p className="mt-1 text-xs text-brand-subtle">
          {reviewMode === "autopilot" ? "Download when ready — minimal review" : "Review each block before export"}
        </p>
      </div>

      {/* Project selector */}
      <div className="mb-6">
        <label className="mb-1 block font-sans text-xs font-medium text-brand-muted">
          Add to project
        </label>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-sans text-[0.8125rem] text-brand-text outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
        >
          <option value="">No project (standalone)</option>
          {projects.map((p) => (
            <option key={p.id} value={String(p.id)}>{p.name}</option>
          ))}
          <option value="__new__">Create new project…</option>
        </select>
      </div>

      {error && (
        <p className="mb-4 font-sans text-[0.8125rem] text-status-error">{error}</p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          onClick={handleClose}
          className="cursor-pointer border-none bg-transparent px-4 py-2 font-sans text-[0.8125rem] text-brand-muted"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !file || sameLanguage}
          className="cursor-pointer rounded-full border-none bg-brand-accent px-5 py-2.5 font-sans text-sm font-medium text-white hover:bg-brand-accentHov disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Uploading…" : "Upload & Translate"}
        </button>
      </div>
    </ModalOverlay>
  );
}
