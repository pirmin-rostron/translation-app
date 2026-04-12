"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDashboardStore } from "../stores/dashboardStore";
import { documentsApi, queryKeys } from "../services/api";
import type { ProjectResponse } from "../services/api";
import { ModalOverlay } from "./ModalOverlay";
import { trackEvent } from "../utils/analytics";

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

export function NewTranslationModal({ projects }: { projects: ProjectResponse[] }) {
  const queryClient = useQueryClient();
  const open = useDashboardStore((s) => s.translationModalOpen);
  const preselectedProjectId = useDashboardStore((s) => s.preselectedProjectId);
  const closeModal = useDashboardStore((s) => s.closeTranslationModal);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [sourceLang, setSourceLang] = useState("English");
  const [targetLang, setTargetLang] = useState("German");
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Pre-select project when modal opens with a project context
  const prevPreselected = useRef<number | null>(null);
  if (open && preselectedProjectId !== null && prevPreselected.current !== preselectedProjectId) {
    prevPreselected.current = preselectedProjectId;
    setProjectId(String(preselectedProjectId));
  }
  if (!open && prevPreselected.current !== null) {
    prevPreselected.current = null;
  }

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
  }

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
        className={`mb-5 cursor-pointer rounded p-8 text-center transition-colors ${
          isDragging
            ? "border-2 border-dashed border-brand-accent bg-brand-accentMid"
            : "border-2 border-dashed border-[#d4d0c8] bg-[#faf8f3]"
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
              DOCX, PDF, TXT — max 10 MB
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

      {/* Language selectors */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block font-sans text-xs font-medium text-brand-muted">
            Source language
          </label>
          <select
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            className="w-full rounded-md border border-[#d4d0c8] bg-brand-surface px-3 py-2 font-sans text-[0.8125rem] text-brand-text outline-none focus:border-brand-accent"
          >
            {LANGUAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block font-sans text-xs font-medium text-brand-muted">
            Target language
          </label>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="w-full rounded-md border border-[#d4d0c8] bg-brand-surface px-3 py-2 font-sans text-[0.8125rem] text-brand-text outline-none focus:border-brand-accent"
          >
            {LANGUAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Project selector */}
      <div className="mb-6">
        <label className="mb-1 block font-sans text-xs font-medium text-brand-muted">
          Add to project
        </label>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-full rounded-md border border-[#d4d0c8] bg-brand-surface px-3 py-2 font-sans text-[0.8125rem] text-brand-text outline-none focus:border-brand-accent"
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
          disabled={submitting || !file}
          className="cursor-pointer rounded-full border-none bg-brand-accent px-6 py-2 font-sans text-[0.8125rem] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Uploading…" : "Upload & Translate"}
        </button>
      </div>
    </ModalOverlay>
  );
}
