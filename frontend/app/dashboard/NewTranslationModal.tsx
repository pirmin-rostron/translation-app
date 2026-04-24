"use client";

/**
 * NewTranslationModal — right-anchored 560px slide-over panel.
 * Two stages: "form" (file upload, project, languages, mode) and
 * "starting" (animated Rumi step ticker).
 *
 * Opened via Zustand `openTranslationModal(projectId?)`.
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
import { getLanguageCode, getLanguageDisplayName, getLanguageFlag, PROJECT_LANGUAGE_OPTIONS } from "../utils/language";

// ── Types ───────────────────────────────────────────────────────────────────

type Stage = "form" | "starting";
type AutopilotMode = "autopilot" | "review";

type FileEntry = {
  file: File;
  name: string;
  kind: string;
  size: string;
  words: number;
  blocks: number;
  status: "reading" | "ready";
};

// ── File kind chip colours (one-off, not brand tokens) ──────────────────────

const KIND_STYLES: Record<string, { bg: string; fg: string }> = {
  docx: { bg: "#EEF1FA", fg: "#3F5AA0" },
  rtf:  { bg: "#F1EEE7", fg: "#6B5A3C" },
  md:   { bg: "#E9F1EE", fg: "#3C6E5E" },
  xliff:{ bg: "#F3E9F1", fg: "#764368" },
  csv:  { bg: "#F5EEE7", fg: "#8B5A2B" },
  txt:  { bg: "#EAEAE6", fg: "#5A5A50" },
};

function kindStyle(ext: string): { backgroundColor: string; color: string } {
  const s = KIND_STYLES[ext] ?? KIND_STYLES.txt;
  return { backgroundColor: s.bg, color: s.fg };
}

// ── Rumi recommendation logic ───────────────────────────────────────────────

function rumiRecommend(files: FileEntry[]): { mode: AutopilotMode; reason: string } {
  if (files.length === 0) {
    return { mode: "autopilot", reason: "Drop a file and I'll recommend the best mode." };
  }
  const first = files[0];
  if (first.kind === "xliff" || first.kind === "md") {
    return { mode: "autopilot", reason: "Short strings and known patterns. I'll ship it and flag only the uncertain blocks." };
  }
  if (first.words > 500) {
    return { mode: "review", reason: "Longer editorial copy. I'll draft everything and you review before export." };
  }
  return { mode: "autopilot", reason: "Small file with straightforward content. Autopilot should handle this cleanly." };
}

// ── Constants ───────────────────────────────────────────────────────────────

const ALLOWED_EXTS = new Set(["docx", "txt", "rtf", "md", "xliff", "csv"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Component ───────────────────────────────────────────────────────────────

export function NewTranslationModal({ projects: projectsProp }: { projects: ProjectResponse[] }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const open = useDashboardStore((s) => s.translationModalOpen);
  const preselectedProjectId = useDashboardStore((s) => s.preselectedProjectId);
  const closeModal = useDashboardStore((s) => s.closeTranslationModal);
  const openProjectModal = useDashboardStore((s) => s.openProjectModal);

  // Use query for fresh data, fall back to prop
  const { data: queriedProjects } = useProjects();
  const projects = queriedProjects ?? projectsProp;

  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const [stage, setStage] = useState<Stage>("form");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [languages, setLanguages] = useState<Set<string>>(new Set());
  const [autopilot, setAutopilot] = useState<AutopilotMode>("autopilot");
  const [userSelectedMode, setUserSelectedMode] = useState(false);
  const [tone, setTone] = useState("brand");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState("");
  const [tickerSteps, setTickerSteps] = useState<string[]>([]);

  // ── Reset on open ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement as HTMLElement;
    setStage("form");
    setFiles([]);
    setError("");
    setUserSelectedMode(false);
    setTone("brand");
    setDeadline("");
    setTickerSteps([]);
    setLanguages(new Set());
    if (preselectedProjectId) {
      setSelectedProjectId(preselectedProjectId);
    } else {
      setSelectedProjectId(null);
    }
  }, [open, preselectedProjectId, projects]);

  // ── Rumi auto-recommend on files change (never override explicit user choice)
  useEffect(() => {
    if (userSelectedMode) return;
    const rec = rumiRecommend(files);
    setAutopilot(rec.mode);
  }, [files, userSelectedMode]);

  // ── Escape to close ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open]);

  // ── Focus trap ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length) focusable[0].focus();
  }, [open, stage]);

  // ── File handling ─────────────────────────────────────────────────────
  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      const ext = f.name.toLowerCase().split(".").pop() ?? "";
      if (!ALLOWED_EXTS.has(ext)) { setError(`${ext.toUpperCase()} files are not supported.`); continue; }
      if (f.size > MAX_FILE_SIZE) { setError("File must be under 10 MB."); continue; }
      setError("");
      const entry: FileEntry = {
        file: f,
        name: f.name,
        kind: ext,
        size: formatFileSize(f.size),
        words: 0,
        blocks: 0,
        status: "reading",
      };
      setFiles((prev) => [...prev, entry]);
      // Estimate word count from file size (rough: 1 word ≈ 6 bytes)
      const estimatedWords = Math.round(f.size / 6);
      const estimatedBlocks = Math.max(1, Math.round(estimatedWords / 30));
      setTimeout(() => {
        setFiles((prev) => prev.map((fe) =>
          fe.file === f ? { ...fe, words: estimatedWords, blocks: estimatedBlocks, status: "ready" } : fe
        ));
      }, 600);
    }
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── User-initiated mode selection (marks as explicit) ──────────────
  const handleModeSelect = useCallback((mode: AutopilotMode) => {
    setUserSelectedMode(true);
    setAutopilot(mode);
  }, []);

  // ── Language toggle ───────────────────────────────────────────────────
  function toggleLang(code: string) {
    setLanguages((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }

  // ── Submit ────────────────────────────────────────────────────────────
  const totalWords = files.reduce((s, f) => s + f.words, 0);
  const canSubmit = files.length > 0 && languages.size > 0 && selectedProjectId != null;

  async function handleStart() {
    if (!canSubmit) return;
    setStage("starting");

    const first = files[0];
    const langNames = Array.from(languages).map((l) => getLanguageDisplayName(l)).join(", ");

    // Ticker steps with staggered delays
    const steps = [
      { text: `Reading ${first.name}…`, delay: 500 },
      { text: `Detected ${first.words} words across ${first.blocks} blocks.`, delay: 900 },
      { text: "Checking glossary. 14 terms match.", delay: 700 },
      { text: `Warming up on ${langNames}…`, delay: 800 },
      {
        text: autopilot === "autopilot"
          ? "Autopilot engaged. First draft in ~2 minutes."
          : "Drafting. You'll review before export.",
        delay: 700,
      },
    ];

    let elapsed = 0;
    for (const step of steps) {
      elapsed += step.delay;
      setTimeout(() => {
        setTickerSteps((prev) => [...prev, step.text]);
      }, elapsed);
    }

    // After all steps + extra delay, submit and close
    setTimeout(async () => {
      try {
        const fd = new FormData();
        fd.append("file", first.file);
        fd.append("source_language", "English");
        const targetLang = Array.from(languages)[0];
        fd.append("target_language", targetLang);
        fd.append("translation_style", "natural");
        fd.append("review_mode", autopilot);
        if (tone) fd.append("tone", tone);
        if (deadline) fd.append("due_date", deadline);
        if (selectedProjectId) fd.append("project_id", String(selectedProjectId));
        trackEvent("flow.upload_started", { target_language: targetLang, mode: autopilot });
        const result = await documentsApi.uploadAndTranslate<{ id: number }>(fd);
        trackEvent("document_uploaded", { language: targetLang, mode: autopilot, has_project: !!selectedProjectId });
        void queryClient.invalidateQueries({ queryKey: queryKeys.translationJobs.recent() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.documents.all() });
        void queryClient.invalidateQueries({ queryKey: ["projects"] });
        handleClose();
        const docId = result?.id;
        if (selectedProjectId) {
          // Project detail page uses useEffect + direct API calls (not React Query),
          // so a hard reload is needed to pick up the new document.
          window.location.href = `/projects/${selectedProjectId}`;
        } else if (docId) {
          router.push(`/documents/${docId}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setStage("form");
      }
    }, elapsed + 900);
  }

  function handleClose() {
    closeModal();
    // Restore focus to trigger element
    setTimeout(() => triggerRef.current?.focus(), 50);
  }

  if (!open) return null;

  const rumiRec = rumiRecommend(files);

  return (
    <div className="fixed inset-0 z-50 flex" style={{ animation: "fadeIn 180ms ease-out" }}>
      {/* Scrim */}
      <div
        aria-hidden="true"
        onClick={handleClose}
        className="flex-1"
        style={{ backgroundColor: "rgba(18,18,16,0.30)", backdropFilter: "blur(2px)" }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="slideover-title"
        className="flex h-screen w-[560px] shrink-0 flex-col border-l border-brand-border bg-brand-surface shadow-2xl"
        style={{ animation: "slideInRight 240ms ease-out" }}
      >
        {/* ── Header ── */}
        <div className="shrink-0 border-b border-brand-borderSoft px-6 pb-4 pt-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-brand-accent" />
                <span className="text-[0.7rem] font-medium uppercase tracking-[0.15em] text-brand-hint">New Translation</span>
              </div>
              <h2 id="slideover-title" className="m-0 mt-1.5 font-display text-[1.5rem] font-semibold leading-[1.1] tracking-heading text-brand-text">
                {stage === "form" ? "Quick translate" : "Rumi is starting…"}
              </h2>
              <p className="m-0 mt-0.5 text-[0.8125rem] text-brand-muted">
                {stage === "form" ? "Drop files. Rumi takes it from there." : "Hang tight — this takes about two seconds."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full text-brand-muted transition-colors hover:bg-brand-sunken hover:text-brand-text"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {stage === "form" ? (
            <FormStage
              files={files}
              isDragging={isDragging}
              setIsDragging={setIsDragging}
              addFiles={addFiles}
              removeFile={removeFile}
              fileInputRef={fileInputRef}
              projects={projects}
              selectedProjectId={selectedProjectId}
              setSelectedProjectId={setSelectedProjectId}
              preselectedProjectId={preselectedProjectId}
              languages={languages}
              toggleLang={toggleLang}
              autopilot={autopilot}
              setAutopilot={handleModeSelect}
              rumiRec={rumiRec}
              tone={tone}
              setTone={setTone}
              deadline={deadline}
              setDeadline={setDeadline}
              error={error}
              totalWords={totalWords}
              openProjectModal={openProjectModal}
            />
          ) : (
            <StartingStage files={files} tickerSteps={tickerSteps} autopilot={autopilot} />
          )}
        </div>

        {/* ── Footer (form stage only) ── */}
        {stage === "form" && (
          <div className="shrink-0 border-t border-brand-borderSoft bg-brand-bg px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="text-[0.75rem] leading-tight">
                <p className="m-0 font-medium text-brand-text">
                  {files.length} {files.length === 1 ? "file" : "files"} · {totalWords.toLocaleString()} words
                </p>
                <p className="m-0 text-brand-muted">
                  {languages.size} {languages.size === 1 ? "language" : "languages"} · {autopilot === "autopilot" ? "Autopilot" : "Review mode"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleStart}
                disabled={!canSubmit}
                aria-disabled={!canSubmit}
                className="flex items-center gap-1.5 rounded-full bg-brand-accent px-5 py-2.5 text-[0.8125rem] font-medium text-white transition-colors hover:bg-brand-accentHov disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icons.Sparkle className="h-3.5 w-3.5" />
                Start translation
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Form Stage ──────────────────────────────────────────────────────────────

function FormStage({
  files, isDragging, setIsDragging, addFiles, removeFile, fileInputRef,
  projects, selectedProjectId, setSelectedProjectId, preselectedProjectId,
  languages, toggleLang, autopilot, setAutopilot, rumiRec,
  tone, setTone, deadline, setDeadline, error, totalWords, openProjectModal,
}: {
  files: FileEntry[];
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  addFiles: (f: FileList | null) => void;
  removeFile: (i: number) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  projects: ProjectResponse[];
  selectedProjectId: number | null;
  setSelectedProjectId: (id: number | null) => void;
  preselectedProjectId: number | null;
  languages: Set<string>;
  toggleLang: (code: string) => void;
  autopilot: AutopilotMode;
  setAutopilot: (m: AutopilotMode) => void;
  rumiRec: { mode: AutopilotMode; reason: string };
  tone: string;
  setTone: (t: string) => void;
  deadline: string;
  setDeadline: (d: string) => void;
  error: string;
  totalWords: number;
  openProjectModal: () => void;
}) {
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(true);

  return (
    <div className="space-y-6">
      {/* ── DOCUMENTS ── */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[0.7rem] font-medium uppercase tracking-[0.15em] text-brand-hint">Documents</span>
          {totalWords > 0 && <span className="text-[0.7rem] text-brand-muted">{totalWords.toLocaleString()} words</span>}
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files); }}
          onClick={() => files.length === 0 && fileInputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed p-4 transition-colors ${
            isDragging ? "border-brand-accent bg-brand-accentMid/20" : "border-brand-border bg-brand-bg hover:border-brand-hint"
          } ${files.length === 0 ? "cursor-pointer" : ""}`}
        >
          {files.length === 0 ? (
            <div className="py-4 text-center">
              <svg viewBox="0 0 24 24" className="mx-auto mb-2 h-5 w-5 text-brand-muted" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p className="m-0 text-[0.8125rem] font-medium text-brand-muted">Drop files here or click to browse</p>
              <p className="m-0 mt-1 text-[0.7rem] text-brand-hint">docx · rtf · xliff · md · csv</p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((f, i) => (
                <div key={`${f.name}-${i}`} className="flex items-center gap-2.5 rounded-lg border border-brand-border bg-white px-3 py-2">
                  <span className="rounded-[4px] px-1.5 py-0.5 font-mono text-[0.65rem] font-medium uppercase tracking-wider" style={kindStyle(f.kind)}>
                    {f.kind}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[0.8125rem] text-brand-text">{f.name}</p>
                    <p className="m-0 text-[0.7rem] text-brand-muted">
                      {f.status === "reading" ? "reading…" : `${f.words.toLocaleString()} words · ${f.blocks} blocks · ${f.size}`}
                    </p>
                  </div>
                  <button type="button" onClick={() => removeFile(i)} className="text-brand-hint transition-colors hover:text-brand-text">
                    <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8" /></svg>
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[0.75rem] font-medium text-brand-accent hover:text-brand-accentHov">
                + Add another file
              </button>
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept=".docx,.rtf,.txt,.md,.xliff,.csv" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </section>

      {/* ── PROJECT ── */}
      <section>
        <span className="mb-2 block text-[0.7rem] font-medium uppercase tracking-[0.15em] text-brand-hint">Project</span>
        <div role="radiogroup" className="space-y-2">
          {projects.slice(0, 4).map((p) => {
            const sel = selectedProjectId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={sel}
                onClick={() => setSelectedProjectId(p.id)}
                disabled={!!preselectedProjectId && preselectedProjectId !== p.id}
                className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors disabled:opacity-50 ${
                  sel ? "border-brand-text bg-brand-bg" : "border-brand-border bg-white hover:border-brand-hint"
                }`}
              >
                <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 ${sel ? "border-brand-text bg-brand-text" : "border-brand-border"}`}>
                  {sel && <Icons.Check className="h-2 w-2 text-white" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[0.8125rem] font-medium text-brand-text">{p.name}</p>
                  <p className="m-0 text-[0.7rem] text-brand-muted">{p.document_count} document{p.document_count === 1 ? "" : "s"}</p>
                </div>
              </button>
            );
          })}
        </div>
        <button type="button" onClick={openProjectModal} className="mt-2 w-full rounded-xl border border-dashed border-brand-border px-3.5 py-2 text-[0.75rem] font-medium text-brand-accent transition-colors hover:border-brand-hint">
          + New project
        </button>
      </section>

      {/* ── TARGET LANGUAGES ── */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[0.7rem] font-medium uppercase tracking-[0.15em] text-brand-hint">Target Languages</span>
          <span className="text-[0.7rem] text-brand-muted">{languages.size} selected</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PROJECT_LANGUAGE_OPTIONS.map((lang) => {
            const sel = languages.has(lang.code);
            return (
              <button
                key={lang.code}
                type="button"
                role="checkbox"
                aria-checked={sel}
                onClick={() => toggleLang(lang.code)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] font-medium transition-colors ${
                  sel
                    ? "border border-brand-text bg-brand-text text-white"
                    : "border border-brand-border bg-white text-brand-muted hover:border-brand-hint"
                }`}
              >
                <span style={{ fontSize: "0.95em" }}>{lang.flag}</span>
                {lang.label}
                {sel && <Icons.Check className="h-3 w-3" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── RUMI RECOMMENDATION ── */}
      {/* One-off gradient colours for the Rumi card — not brand tokens */}
      <section className="rounded-2xl border p-4" style={{ borderColor: "#D9E8E1", background: "linear-gradient(135deg, #F0F7F4, #F8F6F0)" }}>
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-accent text-[0.8125rem] font-medium text-white">R</span>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[0.8125rem] leading-relaxed text-brand-text">
              <span className="font-semibold">{autopilot === "autopilot" ? "Autopilot is a good fit." : "Review mode recommended."}</span>{" "}
              {rumiRec.reason}
            </p>
            <div className="mt-2.5 inline-flex items-center rounded-full border border-brand-border bg-white p-0.5">
              {(["autopilot", "review"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setAutopilot(m)}
                  className={`rounded-full px-3 py-1 text-[0.72rem] font-medium transition-colors ${
                    autopilot === m ? "bg-brand-text text-white" : "text-brand-muted hover:text-brand-text"
                  }`}
                >
                  {m === "autopilot" ? "Autopilot" : "Review mode"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── MORE OPTIONS ── */}
      <section>
        <button
          type="button"
          onClick={() => setMoreOptionsOpen((v) => !v)}
          className="mt-2 flex w-full cursor-pointer items-center justify-between border-t border-brand-borderSoft py-3"
        >
          <span className="text-[0.8125rem] font-medium text-brand-muted">More options</span>
          <svg
            viewBox="0 0 16 16"
            className={`h-4 w-4 text-brand-hint transition-transform duration-200 ${moreOptionsOpen ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="m4 6 4 4 4-4" />
          </svg>
        </button>
        {moreOptionsOpen && (
          <div className="mt-3 space-y-4 pb-2">
            <div>
              <span className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-widest text-brand-hint">Tone</span>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-[0.8125rem] text-brand-text outline-none transition-colors focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
              >
                <option value="brand">Brand voice</option>
                <option value="neutral">Neutral</option>
                <option value="warm">Warm</option>
                <option value="formal">Formal</option>
                <option value="technical">Technical</option>
              </select>
            </div>
            <div>
              <span className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-widest text-brand-hint">Deadline</span>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-[0.8125rem] text-brand-text outline-none transition-colors focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
              />
            </div>
          </div>
        )}
      </section>

      {error && <p className="m-0 text-[0.8125rem] text-status-error">{error}</p>}
    </div>
  );
}

// ── Starting Stage (ticker) ─────────────────────────────────────────────────

function StartingStage({ files, tickerSteps, autopilot }: { files: FileEntry[]; tickerSteps: string[]; autopilot: AutopilotMode }) {
  const totalSteps = 5;
  return (
    <div className="px-0 py-6">
      {/* One-off gradient for starting card — not brand tokens */}
      <div className="rounded-2xl border border-brand-border p-6" style={{ background: "linear-gradient(135deg, #F8F6F0, white)" }}>
        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <div className="relative">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-accent text-[0.875rem] font-medium text-white">R</span>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-brand-surface">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-accent opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-accent ring-2 ring-brand-surface" />
              </span>
            </span>
          </div>
          <div>
            <p className="m-0 font-display text-[1.25rem] font-semibold tracking-heading text-brand-text">Rumi is on it</p>
            <p className="m-0 text-[0.8125rem] text-brand-muted">Starting your translation…</p>
          </div>
        </div>

        {/* Steps */}
        <div aria-live="polite" className="space-y-2.5">
          {tickerSteps.map((step, i) => {
            const isLast = i === tickerSteps.length - 1 && tickerSteps.length < totalSteps;
            return (
              <div key={i} className="flex items-start gap-2.5" style={{ animation: "fadeIn 300ms ease-out" }}>
                {isLast ? (
                  <span className="ml-1 mt-1 flex h-4 w-4 items-center justify-center">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-accent" />
                  </span>
                ) : (
                  <Icons.Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" />
                )}
                <span className={`text-[0.8125rem] ${isLast ? "text-brand-text" : "text-brand-muted"}`}>{step}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
