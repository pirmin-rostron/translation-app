"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getLanguageDisplayName } from "../../utils/language";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type TranslationJob = {
  id: number;
  document_id: number;
  source_language: string;
  target_language: string;
  status: string;
  error_message: string | null;
  translation_provider: string | null;
  created_at: string;
};

type DocumentMeta = {
  id: number;
  filename: string;
  source_language: string | null;
  target_language: string;
};

type AmbiguityAlternative = {
  translation: string;
  meaning: string;
};

type AmbiguityDetails = {
  source_span: string;
  explanation: string;
  alternatives: AmbiguityAlternative[];
};

type GlossaryMatch = {
  source_term: string;
  target_term: string;
};

type GlossaryMatches = {
  matches: GlossaryMatch[];
};

type SegmentAnnotation = {
  id: number;
  annotation_type: string;
  source_span_text: string;
  source_start: number;
  source_end: number;
  target_span_text: string | null;
  target_start: number | null;
  target_end: number | null;
  metadata_json: Record<string, unknown> | null;
};

type ReviewSegment = {
  id: number;
  segment_id: number;
  block_id: number | null;
  segment_index: number;
  segment_type: string;
  source_text: string;
  primary_translation: string;
  final_translation: string;
  confidence_score: number | null;
  review_status: string;
  exact_memory_used: boolean;
  semantic_memory_used: boolean;
  ambiguity_detected: boolean;
  ambiguity_details: AmbiguityDetails | null;
  glossary_applied: boolean;
  glossary_matches: GlossaryMatches | null;
  annotations: SegmentAnnotation[];
};

type DocumentBlock = {
  id: number;
  block_index: number;
  block_type: "heading" | "paragraph" | "bullet_item";
  formatting_json: Record<string, unknown> | null;
  text_original: string;
  text_translated: string | null;
  segments: ReviewSegment[];
};

type DocumentNode =
  | { key: string; type: "block"; block: DocumentBlock }
  | { key: string; type: "bullet_list"; blocks: DocumentBlock[] };

type ReviewFilter = "all" | "flagged" | "ambiguities" | "glossary" | "memory";

type HighlightRange = {
  start: number;
  end: number;
  className: string;
  title: string;
};

function hasMemory(segment: ReviewSegment) {
  return segment.exact_memory_used || segment.semantic_memory_used;
}

function hasReviewSignal(segment: ReviewSegment) {
  return segment.ambiguity_detected || segment.glossary_applied || hasMemory(segment);
}

function isFlagged(segment: ReviewSegment) {
  return segment.review_status !== "approved" && hasReviewSignal(segment);
}

function matchesFilter(segment: ReviewSegment, filter: ReviewFilter) {
  if (filter === "all") return true;
  if (filter === "flagged") return isFlagged(segment);
  if (filter === "ambiguities") return segment.ambiguity_detected;
  if (filter === "glossary") return segment.glossary_applied;
  return hasMemory(segment);
}

function buildDocumentNodes(blocks: DocumentBlock[]) {
  const nodes: DocumentNode[] = [];
  for (const block of blocks) {
    if (block.block_type === "bullet_item") {
      const previous = nodes[nodes.length - 1];
      if (previous?.type === "bullet_list") {
        previous.blocks.push(block);
      } else {
        nodes.push({ key: `bullets-${block.id}`, type: "bullet_list", blocks: [block] });
      }
      continue;
    }
    nodes.push({ key: `block-${block.id}`, type: "block", block });
  }
  return nodes;
}

function getHeadingTag(block: DocumentBlock): "h1" | "h2" | "h3" {
  const style = String(block.formatting_json?.style_name ?? "").toLowerCase();
  if (style.includes("heading 1")) return "h1";
  if (style.includes("heading 2")) return "h2";
  return "h3";
}

function getNodeSpacing(node: DocumentNode) {
  if (node.type === "bullet_list") return "mt-4 first:mt-0";
  if (node.block.block_type === "heading") return "mt-8 first:mt-0";
  return "mt-5 first:mt-0";
}

function buildHighlightRanges(segment: ReviewSegment, side: "source" | "target") {
  return segment.annotations.flatMap((annotation) => {
    const start = side === "source" ? annotation.source_start : annotation.target_start;
    const end = side === "source" ? annotation.source_end : annotation.target_end;
    if (start == null || end == null || end <= start) return [];

    if (annotation.annotation_type === "glossary") {
      const sourceTerm = String(annotation.metadata_json?.source_term ?? annotation.source_span_text);
      const targetTerm = String(annotation.metadata_json?.target_term ?? annotation.target_span_text ?? "");
      return [{ start, end, className: "bg-violet-100/80 text-slate-900", title: `Glossary term applied: ${sourceTerm} -> ${targetTerm}` }] as HighlightRange[];
    }

    if (annotation.annotation_type === "ambiguity") {
      return [{ start, end, className: "bg-amber-100/80 text-slate-900", title: `Ambiguity to review: ${annotation.source_span_text}` }] as HighlightRange[];
    }
    return [];
  });
}

function renderHighlightedText(
  text: string,
  ranges: HighlightRange[],
  wrapperClassName?: string,
  wrapperTitle?: string
) {
  const rendered = (() => {
    if (!text || !ranges.length) return text;
    const safe = [...ranges]
      .filter((r) => r.start >= 0 && r.end <= text.length && r.end > r.start)
      .sort((a, b) => (a.start === b.start ? b.end - a.end : a.start - b.start));
    const out: ReactNode[] = [];
    let cursor = 0;
    let key = 0;
    for (const range of safe) {
      if (range.start < cursor) continue;
      if (range.start > cursor) out.push(<span key={`plain-${key++}`}>{text.slice(cursor, range.start)}</span>);
      out.push(
        <span key={`mark-${key++}`} className={`rounded px-1 py-0.5 ${range.className}`} title={range.title}>
          {text.slice(range.start, range.end)}
        </span>
      );
      cursor = range.end;
    }
    if (cursor < text.length) out.push(<span key={`plain-${key++}`}>{text.slice(cursor)}</span>);
    return out;
  })();

  if (!wrapperClassName) return rendered;
  return (
    <span className={wrapperClassName} title={wrapperTitle}>
      {rendered}
    </span>
  );
}

function getTranslationWrapperProps(segment: ReviewSegment) {
  const exact = segment.annotations.find((a) => a.annotation_type === "exact_memory");
  if (exact) {
    return {
      className: "rounded-md bg-emerald-50/90 px-2 py-1 ring-1 ring-emerald-200",
      title: String(exact.metadata_json?.label ?? "Previously approved translation reused"),
    };
  }

  const semantic = segment.annotations.find((a) => a.annotation_type === "semantic_memory");
  if (semantic) {
    const score = semantic.metadata_json?.confidence_score;
    return {
      className: "rounded-md bg-blue-50/90 px-2 py-1 ring-1 ring-blue-200",
      title:
        typeof score === "number"
          ? `Similar approved translation reused (similarity ${score.toFixed(3)})`
          : String(semantic.metadata_json?.label ?? "Similar approved translation reused"),
    };
  }

  return { className: undefined, title: undefined };
}

export default function TranslationReviewPage() {
  const params = useParams();
  const jobId = Number(params.jobId);
  const [job, setJob] = useState<TranslationJob | null>(null);
  const [doc, setDoc] = useState<DocumentMeta | null>(null);
  const [blocks, setBlocks] = useState<DocumentBlock[]>([]);
  const [activeFilter, setActiveFilter] = useState<ReviewFilter>("flagged");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draftTranslation, setDraftTranslation] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const segmentRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const allSegments = useMemo(
    () =>
      blocks
        .flatMap((block) => block.segments.map((segment) => ({ block, segment })))
        .sort((a, b) => a.segment.segment_index - b.segment.segment_index),
    [blocks]
  );
  const filteredBlocks = useMemo(() => {
    if (activeFilter === "all") return blocks;
    return blocks.filter((block) => block.segments.some((segment) => matchesFilter(segment, activeFilter)));
  }, [activeFilter, blocks]);
  const filteredSegments = useMemo(
    () =>
      filteredBlocks
        .flatMap((block) => block.segments.map((segment) => ({ block, segment })))
        .sort((a, b) => a.segment.segment_index - b.segment.segment_index),
    [filteredBlocks]
  );
  const allNodes = useMemo(() => buildDocumentNodes(blocks), [blocks]);
  const displayedNodes = useMemo(() => buildDocumentNodes(filteredBlocks), [filteredBlocks]);
  const flagged = useMemo(() => allSegments.filter(({ segment }) => isFlagged(segment)), [allSegments]);
  const selectedEntry = useMemo(
    () => allSegments.find(({ segment }) => segment.id === selectedId) ?? filteredSegments[0] ?? null,
    [allSegments, filteredSegments, selectedId]
  );
  const selectedSegment = selectedEntry?.segment ?? null;
  const selectedBlock = selectedEntry?.block ?? null;
  const selectedFlaggedIndex = flagged.findIndex(({ segment }) => segment.id === selectedSegment?.id);

  useEffect(() => {
    if (!filteredSegments.length) {
      setSelectedId(null);
      return;
    }
    if (!filteredSegments.some(({ segment }) => segment.id === selectedId)) {
      setSelectedId(filteredSegments[0].segment.id);
    }
  }, [filteredSegments, selectedId]);

  useEffect(() => {
    if (!selectedSegment) return;
    setDraftTranslation(selectedSegment.final_translation);
    setIsEditing(false);
  }, [selectedSegment?.id, selectedSegment?.final_translation]);

  useEffect(() => {
    if (!selectedId) return;
    segmentRefs.current[selectedId]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selectedId]);

  async function loadReviewBlocks() {
    const payload = await fetch(`${API_URL}/api/translation-jobs/${jobId}/review-blocks`).then(async (res) => {
      if (!res.ok) throw new Error("Failed to load review blocks");
      return res.json();
    });
    setBlocks(payload);
  }

  async function loadJobMeta() {
    const payload = await fetch(`${API_URL}/api/translation-jobs/${jobId}`).then(async (res) => {
      if (!res.ok) throw new Error("Job not found");
      return res.json();
    });
    setJob(payload);
    return payload as TranslationJob;
  }

  useEffect(() => {
    if (Number.isNaN(jobId)) {
      setError("Invalid job ID");
      setLoading(false);
      return;
    }

    Promise.all([loadJobMeta(), loadReviewBlocks()])
      .then(async ([loadedJob]) => {
        const docRes = await fetch(`${API_URL}/api/documents/${loadedJob.document_id}`);
        if (!docRes.ok) return null;
        return docRes.json();
      })
      .then(setDoc)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load review"))
      .finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => {
    if (!job) return;
    if (!["translation_queued", "translating", "translated"].includes(job.status)) return;
    const timer = window.setInterval(() => {
      void loadJobMeta();
      void loadReviewBlocks();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [job?.status]);

  async function saveResult(resultId: number, finalTranslation: string, reviewStatus: string) {
    const res = await fetch(`${API_URL}/api/translation-results/${resultId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ final_translation: finalTranslation, review_status: reviewStatus }),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.detail || "Failed to save translation result");
    await loadReviewBlocks();
  }

  function renderInlineSegments(block: DocumentBlock, side: "source" | "target") {
    if (!block.segments.length) {
      return side === "source" ? block.text_original : (block.text_translated ?? "");
    }

    return block.segments.map((segment, idx) => {
      const isSelected = selectedSegment?.id === segment.id;
      const text =
        side === "source"
          ? segment.source_text
          : isSelected && isEditing
            ? draftTranslation
            : segment.final_translation;
      const ranges = buildHighlightRanges(segment, side);
      const wrapperProps =
        side === "target"
          ? getTranslationWrapperProps(segment)
          : { className: undefined, title: undefined };

      return (
        <span
          key={segment.id}
          onClick={() => {
            setSelectedId(segment.id);
            setMessage("");
            setError("");
          }}
          className={`rounded-md transition-colors cursor-pointer ${
            isSelected ? "bg-slate-100/80" : "hover:bg-slate-100/70"
          }`}
        >
          {renderHighlightedText(text, ranges, wrapperProps.className, wrapperProps.title)}
          {idx < block.segments.length - 1 ? " " : ""}
        </span>
      );
    });
  }

  function renderNode(node: DocumentNode, side: "source" | "target") {
    if (node.type === "bullet_list") {
      return (
        <ul className="list-disc space-y-2 pl-6 marker:text-slate-400">
          {node.blocks.map((block) => (
            <li key={block.id} className="pl-1">
              <p className="text-[15px] leading-7 whitespace-pre-wrap text-slate-900">
                {renderInlineSegments(block, side)}
              </p>
            </li>
          ))}
        </ul>
      );
    }

    const block = node.block;
    const body = renderInlineSegments(block, side);
    if (block.block_type === "heading") {
      const H = getHeadingTag(block);
      return <H className="text-xl font-semibold leading-8 text-slate-900">{body}</H>;
    }
    return <p className="text-[15px] leading-7 whitespace-pre-wrap text-slate-900">{body}</p>;
  }

  async function handleSaveDraft() {
    if (!selectedSegment) return;
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      await saveResult(selectedSegment.id, draftTranslation, "reviewed");
      setMessage("Draft saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApprove() {
    if (!selectedSegment) return;
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      await saveResult(selectedSegment.id, draftTranslation, "approved");
      setMessage("Item approved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRetryJob() {
    if (!job) return;
    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`${API_URL}/api/translation-jobs/${job.id}/retry`, {
        method: "POST",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.detail || `Retry failed (${res.status})`);
      }
      const updated = await res.json();
      setJob(updated);
      setMessage("Retry queued.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-50 p-6">Loading…</div>;
  if (error && !job) return <div className="min-h-screen bg-slate-50 p-6 text-red-600">{error}</div>;
  if (!job) return <div className="min-h-screen bg-slate-50 p-6 text-red-600">Job not found</div>;

  const glossaryMatches = selectedSegment?.glossary_matches?.matches ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-7xl px-6 py-12">
        <Link
          href={`/documents/${job.document_id}`}
          className="mb-6 inline-block text-sm text-slate-600 hover:text-slate-900"
        >
          ← Back to document
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Translation Review</h1>
          <p className="mt-1 text-sm text-slate-500">
            {doc?.filename ?? `#${job.document_id}`} • {getLanguageDisplayName(job.source_language)} →{" "}
            {getLanguageDisplayName(job.target_language)}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Job status: <span className="font-medium">{job.status}</span>
          </p>
          {job.error_message && <p className="mt-1 text-sm text-red-600">{job.error_message}</p>}
          <p className="mt-2 text-sm text-slate-600">
            Headings, paragraphs, and bullet lists render as continuous documents on both sides.
          </p>
          {job.status === "failed" && (
            <button
              type="button"
              onClick={handleRetryJob}
              disabled={actionLoading}
              className="mt-3 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Retry failed stages
            </button>
          )}
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "flagged", "ambiguities", "glossary", "memory"] as ReviewFilter[]).map((filter) => {
              const count =
                filter === "all"
                  ? allSegments.length
                  : filter === "flagged"
                    ? flagged.length
                    : allSegments.filter(({ segment }) => matchesFilter(segment, filter)).length;
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`rounded-full px-3 py-1.5 text-sm ${
                    activeFilter === filter
                      ? "bg-slate-900 text-white"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {filter} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {message && <p className="mb-4 text-sm text-green-600">{message}</p>}
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            {!displayedNodes.length ? (
              <div className="p-8 text-slate-600">No document content in the current filter.</div>
            ) : (
              <div className="h-[72vh] overflow-y-auto px-8 py-8">
                {displayedNodes.map((node) => {
                  const nodeSegments =
                    node.type === "bullet_list" ? node.blocks.flatMap((b) => b.segments) : node.block.segments;
                  return (
                    <div
                      key={node.key}
                      className={getNodeSpacing(node)}
                      ref={(el) => {
                        nodeSegments.forEach((s) => {
                          segmentRefs.current[s.id] = el;
                        });
                      }}
                    >
                      <div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <div className="min-w-0 pr-2">{renderNode(node, "source")}</div>
                        <div className="min-w-0 pl-2">{renderNode(node, "target")}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="border-t border-slate-200 px-6 py-3 text-sm text-slate-500">
              Showing {displayedNodes.length} of {allNodes.length} document sections
            </div>
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {!selectedSegment || !selectedBlock ? (
              <div className="text-sm text-slate-600">Select highlighted text to review details.</div>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-slate-900">Review details</h2>
                <p className="mt-1 text-sm text-slate-500">Block {selectedBlock.block_index + 1}</p>

                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="font-medium text-slate-900">Source</p>
                  <div className="mt-2 whitespace-pre-wrap text-slate-700">
                    {renderHighlightedText(
                      selectedSegment.source_text,
                      buildHighlightRanges(selectedSegment, "source")
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">Final translation</p>
                    <button
                      type="button"
                      onClick={() => setIsEditing((v) => !v)}
                      className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {isEditing ? "Cancel edit" : "Edit"}
                    </button>
                  </div>

                  {isEditing ? (
                    <textarea
                      value={draftTranslation}
                      onChange={(e) => setDraftTranslation(e.target.value)}
                      rows={8}
                      className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                  ) : (
                    <div className="mt-3 whitespace-pre-wrap text-slate-700">
                      {renderHighlightedText(
                        draftTranslation,
                        buildHighlightRanges(selectedSegment, "target"),
                        getTranslationWrapperProps(selectedSegment).className,
                        getTranslationWrapperProps(selectedSegment).title
                      )}
                    </div>
                  )}
                </div>

                {glossaryMatches.length > 0 && (
                  <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50/60 p-3 text-sm">
                    <p className="font-medium text-violet-900">Glossary matches</p>
                    <ul className="mt-2 space-y-1 text-slate-700">
                      {glossaryMatches.map((m, i) => (
                        <li key={`${m.source_term}-${m.target_term}-${i}`}>
                          {m.source_term} → {m.target_term}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={actionLoading || !draftTranslation.trim()}
                    className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-400"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={actionLoading || !draftTranslation.trim()}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Save draft
                  </button>
                  <p className="text-xs text-slate-500">
                    Flagged queue position:{" "}
                    {selectedFlaggedIndex === -1
                      ? "not in queue"
                      : `${selectedFlaggedIndex + 1} / ${flagged.length}`}
                  </p>
                </div>
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
