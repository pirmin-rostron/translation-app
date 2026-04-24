"use client";

/**
 * NewProjectModal — create a project with name, description,
 * optional due date, and optional file upload.
 * Projects are containers only — language selection happens per-job at upload time.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useDashboardStore } from "../stores/dashboardStore";
import { projectsApi } from "../services/api";
import type { ProjectResponse } from "../services/api";
import { ModalOverlay } from "./ModalOverlay";
import { trackEvent } from "../utils/analytics";

const ALLOWED_EXTS = new Set(["docx", "txt", "rtf"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function NewProjectModal() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const open = useDashboardStore((s) => s.projectModalOpen);
  const closeModal = useDashboardStore((s) => s.closeProjectModal);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const canSubmit = name.trim().length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const created = await projectsApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        due_date: dueDate || undefined,
      }) as ProjectResponse;
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      trackEvent("project_created", {});
      const projectId = created.id;
      const pendingFile = file;
      handleClose();
      router.push(`/projects/${projectId}`);
      // If a file was attached, trigger upload after navigation via the
      // translation modal with the project pre-selected.
      if (pendingFile) {
        // Small delay so the project page can mount and register the modal
        setTimeout(() => {
          useDashboardStore.getState().openTranslationModal(projectId);
        }, 400);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setSubmitting(false);
    }
  }

  function handleClose() {
    setName("");
    setDescription("");
    setDueDate("");
    setFile(null);
    setError("");
    setSubmitting(false);
    closeModal();
  }

  return (
    <ModalOverlay open={open} onClose={handleClose}>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="m-0 font-display text-lg font-bold text-brand-text">
            New Project
          </h2>
          <p className="mt-1 text-sm text-brand-muted">
            Group documents and translation jobs together
          </p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="cursor-pointer border-none bg-transparent p-1 text-xl text-brand-subtle"
        >
          ×
        </button>
      </div>

      {/* Project name */}
      <div className="mb-4">
        <label className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">
          Project name <span className="text-status-error">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Nova Launch — Spring Campaign"
          className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 placeholder:text-brand-subtle transition-colors"
        />
      </div>

      {/* Description */}
      <div className="mb-4">
        <label className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this project for?"
          rows={2}
          className="w-full resize-none rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 placeholder:text-brand-subtle transition-colors"
        />
      </div>

      {/* Due date */}
      <div className="mb-4">
        <label className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">
          Due date
        </label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 transition-colors"
        />
      </div>

      {/* File upload drop zone (optional) */}
      <div className="mb-2">
        <label className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">
          Upload a document
        </label>
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
          className={`cursor-pointer rounded-xl p-6 text-center transition-colors ${
            isDragging
              ? "border-2 border-dashed border-brand-accent bg-brand-accentMid"
              : "border-2 border-dashed border-brand-border bg-brand-bg"
          }`}
        >
          {file ? (
            <div>
              <p className="m-0 text-sm font-medium text-brand-text">{file.name}</p>
              <p className="mt-1 text-xs text-brand-subtle">Click to change file</p>
            </div>
          ) : (
            <div>
              <p className="m-0 text-[0.8125rem] font-medium text-brand-muted">
                Drop file here or click to browse
              </p>
              <p className="mt-1 text-[0.6875rem] text-brand-subtle">
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
        {!file && (
          <p className="mt-1.5 text-center text-xs text-brand-subtle underline">
            Skip for now — I&apos;ll add documents later
          </p>
        )}
      </div>

      {error && (
        <p className="mb-4 text-[0.8125rem] text-status-error">{error}</p>
      )}

      {/* Actions */}
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={handleClose}
          className="rounded-full px-4 py-2 text-sm font-medium text-brand-muted hover:text-brand-text underline"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded-full bg-brand-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-accentHov disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {submitting ? "Creating…" : "Create project"}
        </button>
      </div>
    </ModalOverlay>
  );
}
