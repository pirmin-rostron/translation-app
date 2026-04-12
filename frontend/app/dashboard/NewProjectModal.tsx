"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDashboardStore } from "../stores/dashboardStore";
import { projectsApi } from "../services/api";
import { ModalOverlay } from "./ModalOverlay";

export function NewProjectModal() {
  const queryClient = useQueryClient();
  const open = useDashboardStore((s) => s.projectModalOpen);
  const closeModal = useDashboardStore((s) => s.closeProjectModal);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [glossary, setGlossary] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await projectsApi.create({ name: name.trim() });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setSubmitting(false);
    }
  }

  function handleClose() {
    setName("");
    setDescription("");
    setGlossary("");
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
            New Project
          </h2>
          <p className="mt-1 font-sans text-[0.8125rem] text-brand-subtle">
            Group translations together
          </p>
        </div>
        <button
          onClick={handleClose}
          className="cursor-pointer border-none bg-transparent p-1 text-xl text-brand-subtle"
        >
          ×
        </button>
      </div>

      {/* Project name */}
      <div className="mb-4">
        <label className="mb-1 block font-sans text-xs font-medium text-brand-muted">
          Project name <span className="text-status-error">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Legal Docs Q2"
          className="box-border w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-sans text-[0.8125rem] text-brand-text outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
        />
      </div>

      {/* Description */}
      <div className="mb-4">
        <label className="mb-1 block font-sans text-xs font-medium text-brand-muted">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          rows={3}
          className="box-border w-full resize-y rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-sans text-[0.8125rem] text-brand-text outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
        />
      </div>

      {/* Connected glossary */}
      <div className="mb-6">
        <label className="mb-1 block font-sans text-xs font-medium text-brand-muted">
          Connected glossary
        </label>
        <select
          value={glossary}
          onChange={(e) => setGlossary(e.target.value)}
          className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-sans text-[0.8125rem] text-brand-text outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
        >
          <option value="">None</option>
          <option value="legal">Legal &amp; Compliance Terms</option>
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
          disabled={submitting || !name.trim()}
          className="cursor-pointer rounded-full border-none bg-brand-accent px-5 py-2.5 font-sans text-sm font-medium text-white hover:bg-brand-accentHov disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create Project"}
        </button>
      </div>
    </ModalOverlay>
  );
}
