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
  last_saved_at: string | null;
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
  semantic_memory_details: {
    match_type: "semantic_memory";
    suggested_translation: string;
    similarity_score: number | null;
    source_text?: string;
  } | null;
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
type IssueType = "ambiguity" | "glossary" | "exact_memory" | "semantic_memory";
type IssueFilter = "all" | IssueType;

type HighlightRange = {
  start: number;
  end: number;
  className: string;
  title: string;
  issueKey: string;
};

type ReviewIssue = {
  key: string;
  type: IssueType;
  segmentId: number;
  segmentIndex: number;
  blockId: number | null;
  title: string;
};

type ReviewSummary = {
  job_id: number;
  total_segments: number;
  approved_segments: number;
  edited_segments: number;
  safe_unresolved_segments: number;
  review_complete: boolean;
  unresolved_count: number;
  unresolved_ambiguities: number;
  unresolved_semantic_reviews: number;
  unresolved_segments: number;
  ambiguity_count: number;
  semantic_memory_review_count: number;
  overall_status: string;
  last_saved_at: string | null;
  can_mark_ready_for_export: boolean;
};

type ExportResult = {
  job_id: number;
  status: string;
  export_format: string;
  filename: string;
  download_url: string;
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

function normalizeSegmentStatus(status: string) {
  if (status === "reviewed") return "edited";
  if (status === "semantic_memory_match") return "memory_match";
  return status;
}

function formatEta(seconds: number | null) {
  if (seconds == null) return "Calculating…";
  if (seconds <= 0) return "Almost done";
  if (seconds < 60) return `~${seconds}s remaining`;
  const mins = Math.ceil(seconds / 60);
  return `~${mins}m remaining`;
}

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
  if (node.block.block_type === "heading") return "mt-10 first:mt-0";
  return "mt-7 first:mt-0";
}

function buildHighlightRanges(
  segment: ReviewSegment,
  side: "source" | "target",
  selectedIssueKey?: string | null
) {
  return segment.annotations.flatMap((annotation) => {
    const start = side === "source" ? annotation.source_start : annotation.target_start;
    const end = side === "source" ? annotation.source_end : annotation.target_end;
    if (start == null || end == null || end <= start) return [];
    const issueKey = `issue-${annotation.id}`;
    const selectedClass = selectedIssueKey === issueKey ? " ring-2 ring-offset-1 ring-slate-500" : "";

    if (annotation.annotation_type === "glossary") {
      const sourceTerm = String(annotation.metadata_json?.source_term ?? annotation.source_span_text);
      const targetTerm = String(annotation.metadata_json?.target_term ?? annotation.target_span_text ?? "");
      return [
        {
          start,
          end,
          issueKey,
          className: `bg-teal-100/90 text-teal-900${selectedClass}`,
          title: `Glossary term applied: ${sourceTerm} -> ${targetTerm}`,
        },
      ] as HighlightRange[];
    }

    if (annotation.annotation_type === "ambiguity") {
      return [
        {
          start,
          end,
          issueKey,
          className: `bg-amber-100/90 text-amber-900${selectedClass}`,
          title: `Ambiguity to review: ${annotation.source_span_text}`,
        },
      ] as HighlightRange[];
    }
    if (annotation.annotation_type === "exact_memory") {
      return [
        {
          start,
          end,
          issueKey,
          className: `bg-emerald-100/80 text-emerald-900${selectedClass}`,
          title: "Trusted reuse from exact translation memory",
        },
      ] as HighlightRange[];
    }
    if (annotation.annotation_type === "semantic_memory") {
      return [
        {
          start,
          end,
          issueKey,
          className: `bg-sky-100/80 text-sky-900${selectedClass}`,
          title: "Intelligent reuse from semantic translation memory",
        },
      ] as HighlightRange[];
    }
    return [];
  });
}

function renderHighlightedText(
  text: string,
  ranges: HighlightRange[],
  wrapperClassName?: string,
  wrapperTitle?: string,
  onIssueSelect?: (issueKey: string) => void
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
        <span
          key={`mark-${key++}`}
          className={`rounded px-1 py-0.5 ${range.className} ${onIssueSelect ? "cursor-pointer" : ""}`}
          title={range.title}
          onClick={(event) => {
            event.stopPropagation();
            onIssueSelect?.(range.issueKey);
          }}
        >
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

function issueTypeLabel(issueType: IssueType) {
  if (issueType === "ambiguity") return "Ambiguity";
  if (issueType === "glossary") return "Glossary";
  if (issueType === "exact_memory") return "Exact memory";
  return "Semantic memory";
}

function issueBadgeClass(issueType: IssueType) {
  if (issueType === "ambiguity") return "bg-amber-100 text-amber-900 border-amber-200";
  if (issueType === "glossary") return "bg-teal-100 text-teal-900 border-teal-200";
  if (issueType === "exact_memory") return "bg-emerald-100 text-emerald-900 border-emerald-200";
  return "bg-sky-100 text-sky-900 border-sky-200";
}

export default function TranslationReviewPage() {
  const params = useParams();
  const jobId = Number(params.jobId);
  const [job, setJob] = useState<TranslationJob | null>(null);
  const [doc, setDoc] = useState<DocumentMeta | null>(null);
  const [blocks, setBlocks] = useState<DocumentBlock[]>([]);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [translationProgress, setTranslationProgress] = useState<TranslationProgress | null>(null);
  const [activeFilter, setActiveFilter] = useState<ReviewFilter>("all");
  const [activeIssueFilter, setActiveIssueFilter] = useState<IssueFilter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(null);
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
  const issues = useMemo(() => {
    const collected: ReviewIssue[] = [];
    for (const { segment } of allSegments) {
      for (const annotation of segment.annotations) {
        const annotationType = annotation.annotation_type;
        if (
          annotationType !== "ambiguity" &&
          annotationType !== "glossary" &&
          annotationType !== "exact_memory" &&
          annotationType !== "semantic_memory"
        ) {
          continue;
        }
        const issueType = annotationType as IssueType;
        const issueTitle =
          annotationType === "ambiguity"
            ? `Ambiguity: ${annotation.source_span_text}`
            : annotationType === "glossary"
              ? `Glossary: ${annotation.source_span_text}`
              : annotationType === "exact_memory"
                ? "Trusted exact memory reuse"
                : "Semantic memory reuse";
        collected.push({
          key: `issue-${annotation.id}`,
          type: issueType,
          segmentId: segment.id,
          segmentIndex: segment.segment_index,
          blockId: segment.block_id,
          title: issueTitle,
        });
      }
    }
    return collected.sort((a, b) => (a.segmentIndex === b.segmentIndex ? a.key.localeCompare(b.key) : a.segmentIndex - b.segmentIndex));
  }, [allSegments]);
  const issuesBySegmentId = useMemo(() => {
    const map = new Map<number, ReviewIssue[]>();
    for (const issue of issues) {
      const list = map.get(issue.segmentId) ?? [];
      list.push(issue);
      map.set(issue.segmentId, list);
    }
    return map;
  }, [issues]);
  const issuesByKey = useMemo(() => new Map(issues.map((issue) => [issue.key, issue])), [issues]);
  const visibleIssues = useMemo(
    () => (activeIssueFilter === "all" ? issues : issues.filter((issue) => issue.type === activeIssueFilter)),
    [activeIssueFilter, issues]
  );
  const currentIssueIndex = visibleIssues.findIndex((issue) => issue.key === selectedIssueKey);
  const selectedIssue = selectedIssueKey ? issuesByKey.get(selectedIssueKey) ?? null : null;
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

  useEffect(() => {
    if (!visibleIssues.length) {
      setSelectedIssueKey(null);
      return;
    }
    if (!selectedIssueKey || !visibleIssues.some((issue) => issue.key === selectedIssueKey)) {
      setSelectedIssueKey(visibleIssues[0].key);
    }
  }, [visibleIssues, selectedIssueKey]);

  useEffect(() => {
    if (!selectedIssueKey) return;
    const issue = issuesByKey.get(selectedIssueKey);
    if (!issue) return;
    if (selectedId !== issue.segmentId) {
      setSelectedId(issue.segmentId);
    }
  }, [selectedIssueKey, issuesByKey, selectedId]);

  function selectIssue(issueKey: string) {
    const issue = issuesByKey.get(issueKey);
    if (!issue) return;
    setSelectedIssueKey(issueKey);
    setSelectedId(issue.segmentId);
    setMessage("");
    setError("");
  }

  function goToIssue(step: 1 | -1) {
    if (!visibleIssues.length) return;
    const start = currentIssueIndex === -1 ? 0 : currentIssueIndex;
    const nextIndex = (start + step + visibleIssues.length) % visibleIssues.length;
    selectIssue(visibleIssues[nextIndex].key);
  }

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

  async function loadReviewSummary() {
    const payload = await fetch(`${API_URL}/api/translation-jobs/${jobId}/review-summary`).then(async (res) => {
      if (!res.ok) throw new Error("Failed to load review summary");
      return res.json();
    });
    setReviewSummary(payload);
    return payload as ReviewSummary;
  }

  async function loadTranslationProgress() {
    const payload = await fetch(`${API_URL}/api/translation-jobs/${jobId}/progress`).then(async (res) => {
      if (!res.ok) throw new Error("Failed to load translation progress");
      return res.json();
    });
    setTranslationProgress(payload);
    return payload as TranslationProgress;
  }

  useEffect(() => {
    if (Number.isNaN(jobId)) {
      setError("Invalid job ID");
      setLoading(false);
      return;
    }

    Promise.all([loadJobMeta(), loadReviewBlocks(), loadReviewSummary(), loadTranslationProgress()])
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
      void loadReviewSummary();
      void loadTranslationProgress();
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
    await Promise.all([loadReviewBlocks(), loadReviewSummary(), loadJobMeta(), loadTranslationProgress()]);
  }

  function renderInlineSegments(block: DocumentBlock, side: "source" | "target") {
    if (!block.segments.length) {
      return side === "source" ? block.text_original : (block.text_translated ?? "");
    }

    return block.segments.map((segment, idx) => {
      const isSelected = selectedSegment?.id === segment.id;
      const segmentHasSelectedIssue = Boolean(
        selectedIssueKey && issuesBySegmentId.get(segment.id)?.some((issue) => issue.key === selectedIssueKey)
      );
      const text =
        side === "source"
          ? segment.source_text
          : isSelected && isEditing
            ? draftTranslation
            : segment.final_translation;
      const ranges = buildHighlightRanges(segment, side, selectedIssueKey);
      const wrapperProps =
        side === "target"
          ? getTranslationWrapperProps(segment)
          : { className: undefined, title: undefined };

      return (
        <span
          key={segment.id}
          onClick={() => {
            setSelectedId(segment.id);
            const firstIssue = issuesBySegmentId.get(segment.id)?.[0];
            setSelectedIssueKey(firstIssue?.key ?? null);
            setMessage("");
            setError("");
          }}
          className={`rounded-md transition-colors cursor-pointer ${
            segmentHasSelectedIssue
              ? "bg-slate-100/90 ring-1 ring-slate-400"
              : isSelected
                ? "bg-slate-100/80"
                : "hover:bg-slate-100/70"
          }`}
        >
          {renderHighlightedText(text, ranges, wrapperProps.className, wrapperProps.title, selectIssue)}
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

  async function handleSaveSegmentDraft() {
    if (!selectedSegment) return;
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      await saveResult(selectedSegment.id, draftTranslation, "edited");
      setIsEditing(false);
      setMessage("Edited and saved.");
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
      setIsEditing(false);
      setMessage("Item approved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAcceptSemanticSuggestion() {
    if (!selectedSegment || !semanticSuggestion?.suggested_translation) return;
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      await saveResult(selectedSegment.id, semanticSuggestion.suggested_translation, "memory_match");
      setIsEditing(false);
      setMessage("Semantic memory suggestion accepted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept suggestion");
    } finally {
      setActionLoading(false);
    }
  }

  function handleEditSemanticSuggestion() {
    if (!semanticSuggestion?.suggested_translation) return;
    setDraftTranslation(semanticSuggestion.suggested_translation);
    setIsEditing(true);
    setMessage("Suggestion loaded for editing.");
    setError("");
  }

  async function handleIgnoreSemanticSuggestion() {
    if (!selectedSegment) return;
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      await saveResult(selectedSegment.id, draftTranslation, "edited");
      setIsEditing(false);
      setMessage("Semantic suggestion ignored. Current translation kept.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to ignore suggestion");
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

  async function handleSaveWorkflowDraft() {
    if (!job) return;
    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`${API_URL}/api/translation-jobs/${job.id}/save-draft`, {
        method: "POST",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.detail || "Failed to save workflow draft");
      await Promise.all([loadJobMeta(), loadReviewSummary(), loadTranslationProgress()]);
      setMessage("Review workflow draft saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save workflow draft");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMarkReadyForExport() {
    if (!job) return;
    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`${API_URL}/api/translation-jobs/${job.id}/mark-ready`, {
        method: "POST",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.detail || "Failed to mark ready for export");
      await Promise.all([loadJobMeta(), loadReviewSummary(), loadTranslationProgress()]);
      setMessage("Marked as ready for export.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark ready for export");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApproveAllSafeSegments() {
    if (!job) return;
    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`${API_URL}/api/translation-jobs/${job.id}/approve-safe-segments`, {
        method: "POST",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.detail || "Failed to approve safe segments");
      await Promise.all([loadJobMeta(), loadReviewSummary(), loadReviewBlocks(), loadTranslationProgress()]);
      setMessage("Approved all safe unresolved segments.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve safe segments");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleExportFinalDocument() {
    if (!job) return;
    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`${API_URL}/api/translation-jobs/${job.id}/export?export_format=txt`, {
        method: "POST",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.detail || "Failed to export document");
      setExportResult(payload as ExportResult);
      await Promise.all([loadJobMeta(), loadReviewSummary(), loadTranslationProgress()]);
      setMessage("Export completed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export document");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReopenReview() {
    if (!job) return;
    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`${API_URL}/api/translation-jobs/${job.id}/reopen-review`, {
        method: "POST",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.detail || "Failed to re-open review");
      await Promise.all([loadJobMeta(), loadReviewSummary(), loadReviewBlocks(), loadTranslationProgress()]);
      setMessage("Review re-opened. You can edit segments again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to re-open review");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-50 p-6">Loading…</div>;
  if (error && !job) return <div className="min-h-screen bg-slate-50 p-6 text-red-600">{error}</div>;
  if (!job) return <div className="min-h-screen bg-slate-50 p-6 text-red-600">Job not found</div>;

  const glossaryMatches = selectedSegment?.glossary_matches?.matches ?? [];
  const unresolvedSegments = reviewSummary?.unresolved_count ?? reviewSummary?.unresolved_segments ?? allSegments.length;
  const unresolvedAmbiguities =
    reviewSummary?.unresolved_ambiguities ?? reviewSummary?.ambiguity_count ?? 0;
  const unresolvedSemanticReviews =
    reviewSummary?.unresolved_semantic_reviews ?? reviewSummary?.semantic_memory_review_count ?? 0;
  const safeUnresolvedSegments = reviewSummary?.safe_unresolved_segments ?? 0;
  const reviewComplete = Boolean(reviewSummary?.review_complete);
  const workflowStatus = reviewSummary?.overall_status ?? job.status;
  const isReadOnly = workflowStatus === "exported";
  const selectedSegmentStatus = normalizeSegmentStatus(selectedSegment?.review_status ?? "unreviewed");
  const canEditSelectedSegment = !isReadOnly;
  const hasDraftChanges =
    (draftTranslation || "").trim() !== (selectedSegment?.final_translation || "").trim();
  const semanticSuggestion = selectedSegment?.semantic_memory_details ?? null;
  const workflowStatusLabel =
    workflowStatus === "exported"
      ? "Exported"
      : workflowStatus === "ready_for_export"
        ? "Ready for Export"
        : workflowStatus === "draft_saved"
          ? "Draft Saved"
          : "In Review";
  const showSaveWorkflowDraft = !reviewComplete && !["ready_for_export", "exported"].includes(workflowStatus);
  const showMarkReadyForExport =
    reviewComplete &&
    !["ready_for_export", "exported"].includes(workflowStatus);
  const showExportAction = workflowStatus === "ready_for_export";
  const showApproveAllSafeSegments =
    unresolvedSegments > 0 &&
    safeUnresolvedSegments > 0 &&
    !["ready_for_export", "exported"].includes(workflowStatus);
  const showDownloadLink = workflowStatus === "exported" && exportResult?.download_url;

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
          <p className="mt-2 text-sm text-slate-600">Follow the workflow below to save, finalize, and export.</p>
          {job.error_message && <p className="mt-1 text-sm text-red-600">{job.error_message}</p>}
        </div>

        {translationProgress && !translationProgress.is_complete && (
          <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
            <p className="text-sm font-medium text-emerald-900">Translation in progress…</p>
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
          </section>
        )}

        <section className="mb-6 rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Review Workflow</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{workflowStatusLabel}</p>
              <p className="mt-1 text-sm text-slate-600">
                Approved: <span className="font-semibold text-slate-900">{reviewSummary?.approved_segments ?? 0}</span>{" "}
                • Edited: <span className="font-semibold text-slate-900">{reviewSummary?.edited_segments ?? 0}</span> •
                Unresolved: <span className="font-semibold text-slate-900">{unresolvedSegments}</span>
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Safe unresolved: <span className="font-semibold text-slate-900">{safeUnresolvedSegments}</span>
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Ambiguities: <span className="font-semibold text-slate-900">{unresolvedAmbiguities}</span> •
                Semantic memory reviews:{" "}
                <span className="font-semibold text-slate-900">
                  {unresolvedSemanticReviews}
                </span>
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Progress: In Review → Draft Saved → Ready for Export → Exported
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Last saved:{" "}
                <span className="font-medium text-slate-900">
                  {reviewSummary?.last_saved_at
                    ? new Date(reviewSummary.last_saved_at).toLocaleString()
                    : "Not saved yet"}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {showSaveWorkflowDraft && (
                <button
                  type="button"
                  onClick={handleSaveWorkflowDraft}
                  disabled={actionLoading}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Save draft
                </button>
              )}
              {showApproveAllSafeSegments && (
                <button
                  type="button"
                  onClick={handleApproveAllSafeSegments}
                  disabled={actionLoading}
                  className="rounded-lg border border-indigo-300 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                >
                  Approve all safe segments
                </button>
              )}
              {showMarkReadyForExport && (
                <button
                  type="button"
                  onClick={handleMarkReadyForExport}
                  disabled={actionLoading}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-400"
                >
                  Mark ready for export
                </button>
              )}
              {showExportAction && (
                <button
                  type="button"
                  onClick={handleExportFinalDocument}
                  disabled={actionLoading}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:bg-emerald-300"
                >
                  Export final document
                </button>
              )}
              {isReadOnly && (
                <button
                  type="button"
                  onClick={handleReopenReview}
                  disabled={actionLoading}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Re-open review
                </button>
              )}
              {job.status === "failed" && (
                <button
                  type="button"
                  onClick={handleRetryJob}
                  disabled={actionLoading}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Retry failed stages
                </button>
              )}
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            {showSaveWorkflowDraft
              ? `In Review: ${unresolvedSegments} unresolved segments remain. Next step: approve all safe segments or review flagged items.`
              : showMarkReadyForExport
                ? "All segments must be in approved/edited/memory_match with zero unresolved ambiguities and semantic reviews. Mark this job ready for export."
                : showExportAction
                  ? "This job is finalized and ready to export."
                  : workflowStatus === "exported"
                    ? `Export completed successfully${reviewSummary?.last_saved_at ? ` at ${new Date(reviewSummary.last_saved_at).toLocaleString()}` : ""}.`
                    : "Continue reviewing translated segments."}
          </p>
          {showDownloadLink && (
            <a
              href={`${API_URL}${exportResult?.download_url ?? ""}`}
              className="mt-2 inline-block text-sm font-medium text-indigo-700 underline"
              target="_blank"
              rel="noreferrer"
            >
              Download latest export
            </a>
          )}
        </section>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "flagged", "ambiguities", "glossary", "memory"] as ReviewFilter[]).map((filter) => {
                const count =
                  filter === "all"
                    ? allSegments.length
                    : filter === "flagged"
                      ? flagged.length
                      : allSegments.filter(({ segment }) => matchesFilter(segment, filter)).length;
                const filterLabel =
                  filter === "all"
                    ? "All Content"
                    : filter === "flagged"
                      ? "Flagged only"
                      : filter === "ambiguities"
                        ? "Ambiguities"
                        : filter === "glossary"
                          ? "Glossary"
                          : "Memory";
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
                    {filterLabel} ({count})
                  </button>
                );
              })}
            </div>
            <div className="text-xs text-slate-500">
              Default view: full side-by-side document. Use filters to narrow to issues.
            </div>
          </div>
          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Issues</span>
                {(["all", "ambiguity", "glossary", "exact_memory", "semantic_memory"] as IssueFilter[]).map(
                  (filter) => {
                    const count =
                      filter === "all" ? issues.length : issues.filter((issue) => issue.type === filter).length;
                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setActiveIssueFilter(filter)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                          activeIssueFilter === filter
                            ? "bg-slate-900 text-white"
                            : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {filter === "all" ? "all" : issueTypeLabel(filter as IssueType)} ({count})
                      </button>
                    );
                  }
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToIssue(-1)}
                  disabled={!visibleIssues.length}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous issue
                </button>
                <button
                  type="button"
                  onClick={() => goToIssue(1)}
                  disabled={!visibleIssues.length}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Next issue
                </button>
                <span className="text-xs text-slate-500">
                  {visibleIssues.length
                    ? `Issue ${currentIssueIndex + 1} of ${visibleIssues.length}`
                    : "No issues in this filter"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {message && <p className="mb-4 text-sm text-green-600">{message}</p>}
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid border-b border-slate-200 bg-slate-50 px-8 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="pr-6">Source document</div>
              <div className="pl-6">Final translated document</div>
            </div>
            {!displayedNodes.length ? (
              <div className="p-8 text-slate-600">No document content in the current filter.</div>
            ) : (
              <div className="h-[74vh] overflow-y-auto bg-slate-50/40 px-8 py-9">
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
                        <div className="min-w-0 rounded-lg bg-white/80 p-2 pr-3">{renderNode(node, "source")}</div>
                        <div className="min-w-0 rounded-lg bg-white p-2 pl-3 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.14)]">
                          {renderNode(node, "target")}
                        </div>
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
                {selectedIssue && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${issueBadgeClass(selectedIssue.type)}`}
                      >
                        {issueTypeLabel(selectedIssue.type)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {visibleIssues.length ? `Issue ${currentIssueIndex + 1} of ${visibleIssues.length}` : "Issue"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{selectedIssue.title}</p>
                  </div>
                )}

                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="font-medium text-slate-900">Source</p>
                  <div className="mt-2 whitespace-pre-wrap text-slate-700">
                    {renderHighlightedText(
                      selectedSegment.source_text,
                      buildHighlightRanges(selectedSegment, "source", selectedIssueKey),
                      undefined,
                      undefined,
                      selectIssue
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900">Final translation</p>
                      {selectedSegmentStatus === "approved" && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Approved
                        </span>
                      )}
                      {selectedSegmentStatus === "edited" && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          Edited and saved
                        </span>
                      )}
                      {selectedSegmentStatus === "memory_match" && (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                          Accepted from memory
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={!canEditSelectedSegment}
                      onClick={() => setIsEditing((v) => !v)}
                      className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isReadOnly ? "Read only" : isEditing ? "Cancel edit" : "Edit again"}
                    </button>
                  </div>

                  {isEditing && canEditSelectedSegment ? (
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
                        buildHighlightRanges(selectedSegment, "target", selectedIssueKey),
                        getTranslationWrapperProps(selectedSegment).className,
                        getTranslationWrapperProps(selectedSegment).title,
                        selectIssue
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

                {!isReadOnly &&
                  semanticSuggestion &&
                  selectedSegmentStatus !== "memory_match" &&
                  selectedSegmentStatus !== "approved" && (
                    <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50/60 p-3 text-sm">
                      <p className="font-medium text-sky-900">Suggested from similar previous translation</p>
                      <p className="mt-1 whitespace-pre-wrap text-slate-700">
                        {semanticSuggestion.suggested_translation}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {typeof semanticSuggestion.similarity_score === "number"
                          ? `${Math.round(semanticSuggestion.similarity_score * 100)}% match`
                          : "Similarity score unavailable"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleAcceptSemanticSuggestion}
                          disabled={actionLoading}
                          className="rounded border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-100 disabled:opacity-60"
                        >
                          Accept suggestion
                        </button>
                        <button
                          type="button"
                          onClick={handleEditSemanticSuggestion}
                          disabled={actionLoading}
                          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          Edit suggestion
                        </button>
                        <button
                          type="button"
                          onClick={handleIgnoreSemanticSuggestion}
                          disabled={actionLoading}
                          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          Ignore
                        </button>
                      </div>
                    </div>
                  )}

                <div className="mt-6 space-y-3">
                  {!isReadOnly && (selectedSegmentStatus === "unreviewed" || selectedSegmentStatus === "edited") && (
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={actionLoading || !draftTranslation.trim()}
                      className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-400"
                    >
                      Approve
                    </button>
                  )}
                  {!isReadOnly && (selectedSegmentStatus === "unreviewed" || (isEditing && hasDraftChanges)) && (
                    <button
                      type="button"
                      onClick={handleSaveSegmentDraft}
                      disabled={actionLoading || !draftTranslation.trim()}
                      className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Save segment edit
                    </button>
                  )}
                  {isReadOnly && (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      This document is exported and read-only. Re-open review from the workflow banner to edit.
                    </p>
                  )}
                  <p className="text-xs text-slate-500">
                    {visibleIssues.length
                      ? `Issue queue position: ${Math.max(currentIssueIndex + 1, 1)} / ${visibleIssues.length}`
                      : selectedFlaggedIndex === -1
                        ? "No open issues in current filter."
                        : `Flagged queue position: ${selectedFlaggedIndex + 1} / ${flagged.length}`}
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
