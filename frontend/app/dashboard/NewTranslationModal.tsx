"use client";

/**
 * NewTranslationModal — centered modal for uploading a document and
 * starting a translation job in Autopilot or Manual review mode.
 *
 * Sections (in order):
 * 1. Header: "NEW" eyebrow + "Translation" display title + close X
 * 2. Subtitle
 * 3. Project selector dropdown
 * 4. Document upload drop zone
 * 5. Target language pills (pre-populated from selected project)
 * 6. Mode cards (Autopilot / Manual review)
 * 7. Footer: Cancel link + Start translation button
 *
 * Opened via Zustand `openTranslationModal(projectId?)`.
 * Redesigned per PIR-137.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useDashboardStore } from "../stores/dashboardStore";
import { documentsApi, queryKeys } from "../services/api";
import type { ProjectResponse } from "../services/api";
import { useProjects } from "../hooks/queries";
import { Icons } from "../components/Icons";
import { trackEvent } from "../utils/analytics";
import {
  getLanguageDisplayName,
  PROJECT_LANGUAGE_OPTIONS,
} from "../utils/language";

// -- Types -------------------------------------------------------------------

type AutopilotMode = "autopilot" | "review";

// -- Target language list per spec -------------------------------------------
// Ticket specifies these seven; flags are rendered from PROJECT_LANGUAGE_OPTIONS.

const MODAL_LANGUAGE_OPTIONS: {
  code: string;
  flag: string;
  label: string;
  shortLabel: string;
}[] = [
  {
    code: "Spanish",
    flag: "\u{1F1EA}\u{1F1F8}",
    label: "ES Spanish",
    shortLabel: "Spanish",
  },
  {
    code: "Spanish (MX)",
    flag: "\u{1F1F2}\u{1F1FD}",
    label: "MX Spanish",
    shortLabel: "Spanish (MX)",
  },
  {
    code: "French",
    flag: "\u{1F1EB}\u{1F1F7}",
    label: "FR French",
    shortLabel: "French",
  },
  {
    code: "German",
    flag: "\u{1F1E9}\u{1F1EA}",
    label: "DE German",
    shortLabel: "German",
  },
  {
    code: "Portuguese (BR)",
    flag: "\u{1F1E7}\u{1F1F7}",
    label: "BR Portuguese",
    shortLabel: "Portuguese (BR)",
  },
  {
    code: "Italian",
    flag: "\u{1F1EE}\u{1F1F9}",
    label: "IT Italian",
    shortLabel: "Italian",
  },
  {
    code: "Japanese",
    flag: "\u{1F1EF}\u{1F1F5}",
    label: "JP Japanese",
    shortLabel: "Japanese",
  },
];

// -- Constants ---------------------------------------------------------------

const ALLOWED_EXTS = new Set(["docx", "txt", "rtf"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExtension(name: string): string {
  return name.toLowerCase().split(".").pop() ?? "";
}

// -- Component ---------------------------------------------------------------

export function NewTranslationModal({
  projects: projectsProp,
}: {
  projects: ProjectResponse[];
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const open = useDashboardStore((s) => s.translationModalOpen);
  const preselectedProjectId = useDashboardStore(
    (s) => s.preselectedProjectId
  );
  const closeModal = useDashboardStore((s) => s.closeTranslationModal);

  // Use query for fresh data, fall back to prop
  const { data: queriedProjects } = useProjects();
  const projects = queriedProjects ?? projectsProp;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const initializedRef = useRef(false);

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null
  );
  const [languages, setLanguages] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<AutopilotMode>("autopilot");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // -- Reset on open (false -> true transition) ------------------------------
  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current) return;
    initializedRef.current = true;
    triggerRef.current = document.activeElement as HTMLElement;
    setFile(null);
    setError("");
    setMode("autopilot");
    setSubmitting(false);

    if (preselectedProjectId) {
      setSelectedProjectId(preselectedProjectId);
      // Pre-populate languages from the project
      const proj = projects.find((p) => p.id === preselectedProjectId);
      if (proj?.target_languages?.length) {
        setLanguages(new Set(proj.target_languages));
      } else {
        setLanguages(new Set());
      }
    } else {
      setSelectedProjectId(projects[0]?.id ?? null);
      const firstProject = projects[0];
      if (firstProject?.target_languages?.length) {
        setLanguages(new Set(firstProject.target_languages));
      } else {
        setLanguages(new Set());
      }
    }
  }, [open, preselectedProjectId, projects]);

  // -- Pre-populate languages when project changes ---------------------------
  function handleProjectChange(id: number) {
    setSelectedProjectId(id);
    const proj = projects.find((p) => p.id === id);
    if (proj?.target_languages?.length) {
      setLanguages(new Set(proj.target_languages));
    }
  }

  // -- Escape to close -------------------------------------------------------
  // Use closeModal directly (stable Zustand ref) to avoid stale closure on handleClose
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, closeModal]);

  // -- File handling ---------------------------------------------------------
  function handleFile(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const f = fileList[0];
    const ext = fileExtension(f.name);
    if (!ALLOWED_EXTS.has(ext)) {
      setError(`${ext.toUpperCase()} files are not supported.`);
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError("File must be under 10 MB.");
      return;
    }
    setError("");
    setFile(f);
  }

  // -- Language toggle -------------------------------------------------------
  const toggleLang = useCallback((code: string) => {
    setLanguages((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  // -- Submit ----------------------------------------------------------------
  const canSubmit = file != null && languages.size > 0;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    const targetLang = Array.from(languages)[0];
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("source_language", "English");
      fd.append("target_language", targetLang);
      fd.append("translation_style", "natural");
      fd.append("review_mode", mode);
      if (selectedProjectId != null)
        fd.append("project_id", String(selectedProjectId));
      trackEvent("flow.upload_started", {
        target_language: targetLang,
        mode,
      });
      const result = await documentsApi.uploadAndTranslate<{ id: number }>(fd);
      trackEvent("document_uploaded", {
        language: targetLang,
        mode,
        has_project: !!selectedProjectId,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.translationJobs.recent(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documents.all(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.projects.all(),
      });
      handleClose();
      const docId = result?.id;
      if (mode === "review" && docId) {
        // Manual mode: redirect to the document (review page will be accessible from there)
        router.push(`/documents/${docId}`);
      } else if (selectedProjectId != null) {
        router.push(`/projects/${selectedProjectId}`);
      } else if (docId) {
        router.push(`/documents/${docId}`);
      }
    } catch (err) {
      console.error("[NewTranslationModal] upload failed:", err);
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    closeModal();
    setTimeout(() => triggerRef.current?.focus(), 50);
  }

  if (!open) return null;

  const isLocked = !!preselectedProjectId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-translation-title"
        className="relative w-full max-w-lg rounded-xl bg-brand-surface p-6 shadow-xl"
        style={{ animation: "scalein 180ms cubic-bezier(0.22,1,0.36,1)" }}
      >
        {/* -- 1. Header -- */}
        <div className="mb-1">
          <p className="m-0 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-brand-muted">
            New
          </p>
          <h2
            id="new-translation-title"
            className="m-0 font-display text-[1.5rem] font-semibold leading-tight tracking-heading text-brand-text"
          >
            Translation
          </h2>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-brand-muted transition-colors hover:bg-brand-sunken hover:text-brand-text"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>

        {/* -- 2. Subtitle -- */}
        <p className="m-0 mb-5 text-sm text-brand-muted">
          Upload a document — Autopilot handles the rest.
        </p>

        {/* -- 3. Project selector -- */}
        <div className="mb-5">
          <label
            htmlFor="project-select"
            className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted"
          >
            Project
          </label>
          <select
            id="project-select"
            value={selectedProjectId ?? ""}
            onChange={(e) => handleProjectChange(Number(e.target.value))}
            disabled={isLocked}
            className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none transition-colors focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 disabled:opacity-60"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* -- 4. Document upload zone -- */}
        <div className="mb-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFile(e.dataTransfer.files);
            }}
            className={`rounded-xl border-2 border-dashed transition-colors ${
              isDragging
                ? "border-brand-accent bg-brand-accentMid/20"
                : "border-brand-border bg-brand-bg"
            } ${file ? "px-4 py-3" : "px-4 py-8"}`}
          >
            {file ? (
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-sunken">
                  <Icons.Documents className="h-4 w-4 text-brand-muted" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-medium text-brand-text">
                    {file.name}
                  </p>
                  <p className="m-0 text-xs text-brand-subtle">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-brand-hint transition-colors hover:bg-brand-sunken hover:text-brand-text"
                >
                  <svg
                    viewBox="0 0 14 14"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  >
                    <path d="M3 3l8 8M11 3l-8 8" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="text-center">
                {/* Upload icon: arrow up in circle */}
                <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-full border border-brand-border bg-brand-surface">
                  <svg
                    viewBox="0 0 20 20"
                    className="h-5 w-5 text-brand-muted"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10 14V4M6 7l4-4 4 4" />
                  </svg>
                </div>
                <p className="m-0 text-sm text-brand-text">
                  Drop a file here or{" "}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="font-medium text-brand-accent hover:text-brand-accentHov"
                  >
                    browse
                  </button>
                </p>
                <p className="m-0 mt-1 text-xs text-brand-subtle">
                  DOCX, RTF, TXT &middot; up to 10 MB
                </p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.rtf,.txt"
            className="hidden"
            onChange={(e) => {
              handleFile(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* -- 5. Target languages -- */}
        <div className="mb-5">
          <p className="mb-2 text-[0.8125rem] font-medium text-brand-muted">
            Target languages
          </p>
          <div className="flex flex-wrap gap-1.5">
            {MODAL_LANGUAGE_OPTIONS.map((lang) => {
              const sel = languages.has(lang.code);
              return (
                <button
                  key={lang.code}
                  type="button"
                  role="checkbox"
                  aria-checked={sel}
                  onClick={() => toggleLang(lang.code)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    sel
                      ? "border border-brand-accent bg-brand-accentSoft text-brand-accent"
                      : "border border-brand-border bg-brand-surface text-brand-muted hover:border-brand-hint"
                  }`}
                >
                  <span className="text-[0.8125rem]">{lang.flag}</span>
                  {lang.label}
                  {sel && <Icons.Check className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* -- 6. Mode cards -- */}
        <div className="mb-6">
          <p className="mb-2 text-[0.8125rem] font-medium text-brand-muted">
            Mode
          </p>
          <div className="grid grid-cols-2 gap-3">
            {/* Autopilot */}
            <button
              type="button"
              onClick={() => setMode("autopilot")}
              className={`rounded-xl border p-4 text-left transition-colors ${
                mode === "autopilot"
                  ? "border-brand-accent bg-brand-accentSoft"
                  : "border-brand-border bg-brand-surface hover:border-brand-hint"
              }`}
            >
              <Icons.Sparkle
                className={`mb-2 h-5 w-5 ${
                  mode === "autopilot"
                    ? "text-brand-accent"
                    : "text-brand-hint"
                }`}
              />
              <p className="m-0 text-sm font-medium text-brand-text">
                Autopilot
              </p>
              <p className="m-0 mt-0.5 text-xs text-brand-subtle">
                Surface only material ambiguities
              </p>
            </button>

            {/* Manual review */}
            <button
              type="button"
              onClick={() => setMode("review")}
              className={`rounded-xl border p-4 text-left transition-colors ${
                mode === "review"
                  ? "border-brand-accent bg-brand-accentSoft"
                  : "border-brand-border bg-brand-surface hover:border-brand-hint"
              }`}
            >
              {/* Pencil icon */}
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`mb-2 h-5 w-5 ${
                  mode === "review" ? "text-brand-accent" : "text-brand-hint"
                }`}
              >
                <path d="M14.5 3.5a2.12 2.12 0 0 1 3 3L6.5 17.5 2 18.5l1-4.5L14.5 3.5Z" />
              </svg>
              <p className="m-0 text-sm font-medium text-brand-text">
                Manual review
              </p>
              <p className="m-0 mt-0.5 text-xs text-brand-subtle">
                Review every block
              </p>
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="m-0 mb-4 text-sm text-status-error">{error}</p>
        )}

        {/* -- 7. Footer -- */}
        <div className="flex items-center justify-between border-t border-brand-borderSoft pt-4">
          <button
            type="button"
            onClick={handleClose}
            className="text-sm font-medium text-brand-muted hover:text-brand-text"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || submitting}
            className="rounded-full bg-brand-text px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Starting..." : "Start translation"}
          </button>
        </div>
      </div>
    </div>
  );
}
