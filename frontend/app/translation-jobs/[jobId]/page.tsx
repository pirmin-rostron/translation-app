"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DocumentDiffPane } from "./components/DocumentDiffPane";
import { ReviewDetailsPane } from "./components/ReviewDetailsPane";
import { ReviewGuidancePanel } from "./components/ReviewGuidancePanel";
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
  translation_style?: "natural" | "literal" | null;
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

type AmbiguityChoiceOption = {
  meaning: string;
  translation: string;
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
  semantic_match_found?: boolean;
  suggested_translation?: string | null;
  similarity_score?: number | null;
  current_translation?: string;
  ambiguity_choice_found?: boolean;
  ambiguity_source_phrase?: string | null;
  ambiguity_options?: AmbiguityChoiceOption[];
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

type SemanticChoiceOption = "current" | "suggested";

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

type ReviewFilter = "all" | "issues" | "ambiguities" | "glossary" | "memory";
type IssueType = "ambiguity" | "glossary" | "exact_memory" | "semantic_memory";
type ReviewMode = "document" | "issues";

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
  export_mode: "clean_text" | "preserve_formatting";
  filename: string;
  download_url: string;
  generated_at: string;
  version: number;
};

type ExportMode = "clean_text" | "preserve_formatting";
type ExportFormat = "docx" | "rtf" | "txt";

type ExportFile = {
  filename: string;
  download_url: string;
  generated_at: string;
  version: number;
  export_format?: string | null;
  export_mode?: "clean_text" | "preserve_formatting" | null;
  latest: boolean;
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

function isAcceptableFinalStatus(status: string) {
  const normalized = normalizeSegmentStatus(status);
  return normalized === "approved" || normalized === "edited" || normalized === "memory_match";
}

function isSafeSegment(segment: ReviewSegment) {
  return (
    !isAcceptableFinalStatus(segment.review_status) &&
    !hasValidAmbiguityChoice(segment) &&
    !segment.semantic_memory_used &&
    Boolean((segment.final_translation || "").trim())
  );
}

function isBlockResolved(block: DocumentBlock) {
  if (!block.segments.length) return false;
  return block.segments.every((segment) => isAcceptableFinalStatus(segment.review_status));
}

function cleanChoiceTranslationText(value: string) {
  return value
    .replace(/\\n/g, " ")
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\\[a-z]+-?\d*\s?/gi, " ")
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeChoiceText(value: string) {
  return cleanChoiceTranslationText(value).toLocaleLowerCase();
}

function cleanPanelText(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replace(/\\r\\n/g, " ")
    .replace(/\\n/g, " ")
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\\[a-z]+-?\d*\s?/gi, " ")
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function replaceFirstOccurrence(haystack: string, needle: string, replacement: string) {
  const idx = haystack.indexOf(needle);
  if (idx === -1) return haystack;
  return `${haystack.slice(0, idx)}${replacement}${haystack.slice(idx + needle.length)}`;
}

function replaceByRange(text: string, start: number, end: number, replacement: string) {
  if (start < 0 || end <= start || end > text.length) return text;
  return `${text.slice(0, start)}${replacement}${text.slice(end)}`;
}

function hasMultiSentenceOrLine(text: string) {
  const normalized = (text || "").trim();
  if (!normalized) return false;
  if (normalized.includes("\n")) return true;
  const sentenceMarkers = normalized.match(/[.!?。！？]/g)?.length ?? 0;
  return sentenceMarkers >= 2;
}

function isVeryShortSnippet(text: string) {
  const normalized = (text || "").trim();
  if (!normalized) return false;
  const words = normalized.split(/\s+/).filter(Boolean).length;
  return normalized.length <= 24 || words <= 3;
}

function preferFullBlockTranslationWhenCollapsed(
  block: DocumentBlock,
  side: "source" | "target",
  text: string,
  isSelected: boolean,
  isEditing: boolean
) {
  if (side !== "target") return text;
  if (isSelected && isEditing) return text;
  if (block.segments.length !== 1) return text;
  if (!hasMultiSentenceOrLine(block.text_original || "")) return text;
  const fallback = (block.text_translated || "").trim();
  const current = (text || "").trim();
  if (!fallback || !current) return text;
  if (!isVeryShortSnippet(current)) return text;
  if (fallback.length <= current.length + 20) return text;
  return fallback;
}

function hasSemanticChoiceInBlock(block: DocumentBlock) {
  return block.segments.some((segment) => getSemanticChoiceDetails(segment).semanticMatchFound);
}

function getAmbiguityChoiceDetails(segment: ReviewSegment | null) {
  if (!segment) {
    return {
      ambiguityChoiceFound: false,
      sourcePhrase: "",
      explanation: "",
      options: [] as AmbiguityChoiceOption[],
      currentTranslation: "",
    };
  }

  const rawOptions = Array.isArray(segment.ambiguity_options) ? segment.ambiguity_options : [];
  const seen = new Set<string>();
  const options = rawOptions.reduce<AmbiguityChoiceOption[]>((acc, option, idx) => {
    const translation = cleanChoiceTranslationText(option?.translation || "");
    if (!translation) return acc;
    const normalized = normalizeChoiceText(translation);
    if (seen.has(normalized)) return acc;
    seen.add(normalized);
    const meaning = (option?.meaning || "").trim() || `Possible meaning ${idx + 1}`;
    acc.push({ meaning, translation });
    return acc;
  }, []);
  const sourcePhrase =
    (segment.ambiguity_source_phrase || "").trim() || (segment.ambiguity_details?.source_span || "").trim();
  const explanation = (segment.ambiguity_details?.explanation || "").trim();
  const currentTranslation = cleanChoiceTranslationText(segment.current_translation || segment.final_translation || "");
  const ambiguityChoiceFound = Boolean(segment.ambiguity_choice_found ?? (segment.ambiguity_detected && options.length > 1));
  return { ambiguityChoiceFound, sourcePhrase, explanation, options, currentTranslation };
}

function hasValidAmbiguityChoice(segment: ReviewSegment) {
  return getAmbiguityChoiceDetails(segment).ambiguityChoiceFound;
}

function hasAmbiguityChoiceInBlock(block: DocumentBlock) {
  return block.segments.some((segment) => getAmbiguityChoiceDetails(segment).ambiguityChoiceFound);
}

function getSemanticChoiceDetails(segment: ReviewSegment | null) {
  if (!segment) {
    return {
      semanticMatchFound: false,
      suggestedTranslation: "",
      similarityScore: null as number | null,
      currentTranslation: "",
    };
  }
  const suggestedFromPayload = (segment.suggested_translation || "").trim();
  const suggestedFromDetails = (segment.semantic_memory_details?.suggested_translation || "").trim();
  const suggestedTranslation = suggestedFromPayload || suggestedFromDetails;
  const similarityScore =
    typeof segment.similarity_score === "number"
      ? segment.similarity_score
      : typeof segment.semantic_memory_details?.similarity_score === "number"
        ? segment.semantic_memory_details.similarity_score
        : null;
  const semanticMatchFound = Boolean(segment.semantic_match_found ?? (segment.semantic_memory_used && suggestedTranslation));
  const currentTranslation = segment.current_translation || segment.final_translation || "";
  return { semanticMatchFound, suggestedTranslation, similarityScore, currentTranslation };
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
  return hasValidAmbiguityChoice(segment) || segment.glossary_applied || hasMemory(segment);
}

function isFlagged(segment: ReviewSegment) {
  return segment.review_status !== "approved" && hasReviewSignal(segment);
}

function matchesFilter(segment: ReviewSegment, filter: ReviewFilter) {
  if (filter === "all") return true;
  if (filter === "issues") return isFlagged(segment);
  if (filter === "ambiguities") return hasValidAmbiguityChoice(segment);
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
  const [exportHistory, setExportHistory] = useState<ExportFile[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>("preserve_formatting");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("docx");
  const [translationProgress, setTranslationProgress] = useState<TranslationProgress | null>(null);
  const [reviewMode, setReviewMode] = useState<ReviewMode>("document");
  const [activeFilter, setActiveFilter] = useState<ReviewFilter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(null);
  const [draftTranslation, setDraftTranslation] = useState("");
  const [semanticChoice, setSemanticChoice] = useState<SemanticChoiceOption>("current");
  const [ambiguityChoiceIndex, setAmbiguityChoiceIndex] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const segmentRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const blockRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const reviewGuidanceRef = useRef<HTMLElement | null>(null);
  const reviewCompleteState = Boolean(reviewSummary?.review_complete);

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
  const safeSegments = useMemo(
    () =>
      allSegments
        .filter(({ segment }) => isSafeSegment(segment))
        .sort((a, b) => a.segment.segment_index - b.segment.segment_index),
    [allSegments]
  );
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
  const visibleIssues = useMemo(() => {
    if (activeFilter === "ambiguities") return issues.filter((issue) => issue.type === "ambiguity");
    if (activeFilter === "glossary") return issues.filter((issue) => issue.type === "glossary");
    if (activeFilter === "memory")
      return issues.filter((issue) => issue.type === "exact_memory" || issue.type === "semantic_memory");
    return issues;
  }, [activeFilter, issues]);
  const currentIssueIndex = visibleIssues.findIndex((issue) => issue.key === selectedIssueKey);
  const selectedIssue = selectedIssueKey ? issuesByKey.get(selectedIssueKey) ?? null : null;
  const selectedEntry = useMemo(
    () => allSegments.find(({ segment }) => segment.id === selectedId) ?? filteredSegments[0] ?? null,
    [allSegments, filteredSegments, selectedId]
  );
  const selectedSegment = selectedEntry?.segment ?? null;
  const selectedBlock = selectedEntry?.block ?? null;
  const orderedBlocks = useMemo(
    () =>
      [...blocks]
        .filter((block) => block.segments.length > 0)
        .sort((a, b) => a.block_index - b.block_index),
    [blocks]
  );
  const blockIndexById = useMemo(
    () => new Map(orderedBlocks.map((block, idx) => [block.id, idx])),
    [orderedBlocks]
  );
  const completedBlocks = useMemo(() => orderedBlocks.filter((block) => isBlockResolved(block)).length, [orderedBlocks]);
  const unresolvedBlocks = Math.max(orderedBlocks.length - completedBlocks, 0);
  const selectedFlaggedIndex = flagged.findIndex(({ segment }) => segment.id === selectedSegment?.id);
  const selectedSafeIndex = safeSegments.findIndex(({ segment }) => segment.id === selectedSegment?.id);
  const selectedBlockPosition = selectedBlock ? (blockIndexById.get(selectedBlock.id) ?? -1) : -1;

  useEffect(() => {
    if (!filteredSegments.length) {
      setSelectedId(null);
      return;
    }
    if (reviewCompleteState && reviewMode === "document" && selectedId == null) {
      return;
    }
    if (!filteredSegments.some(({ segment }) => segment.id === selectedId)) {
      setSelectedId(filteredSegments[0].segment.id);
    }
  }, [filteredSegments, selectedId, reviewCompleteState, reviewMode]);

  useEffect(() => {
    if (!selectedSegment) return;
    setDraftTranslation(selectedSegment.final_translation);
    setSemanticChoice("current");
    const ambiguityDetails = getAmbiguityChoiceDetails(selectedSegment);
    const currentTranslationNormalized = normalizeChoiceText(ambiguityDetails.currentTranslation);
    const matchingIndices = ambiguityDetails.options
      .map((option, idx) => ({ idx, normalized: normalizeChoiceText(option.translation) }))
      .filter((entry) => entry.normalized.length > 0 && entry.normalized === currentTranslationNormalized)
      .map((entry) => entry.idx);
    setAmbiguityChoiceIndex(matchingIndices.length === 1 ? matchingIndices[0] : null);
    setIsEditing(false);
  }, [selectedSegment?.id, selectedSegment?.final_translation]);

  useEffect(() => {
    if (!selectedId) return;
    segmentRefs.current[selectedId]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selectedId]);

  useEffect(() => {
    if (reviewMode !== "document") return;
    if (!orderedBlocks.length) return;
    if (selectedBlockPosition !== -1) return;
    const firstBlock = orderedBlocks.find((block) => !isBlockResolved(block)) ?? orderedBlocks[0];
    setSelectedIssueKey(null);
    setSelectedId(firstBlock.segments[0]?.id ?? null);
    blockRefs.current[firstBlock.id]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [reviewMode, orderedBlocks, selectedBlockPosition]);

  useEffect(() => {
    if (reviewMode !== "issues") return;
    if (!visibleIssues.length) {
      setSelectedIssueKey(null);
      return;
    }
    if (!selectedIssueKey || !visibleIssues.some((issue) => issue.key === selectedIssueKey)) {
      setSelectedIssueKey(visibleIssues[0].key);
    }
  }, [reviewMode, visibleIssues, selectedIssueKey]);

  useEffect(() => {
    if (reviewMode !== "issues") return;
    if (!selectedIssueKey) return;
    const issue = issuesByKey.get(selectedIssueKey);
    if (!issue) return;
    if (selectedId !== issue.segmentId) {
      setSelectedId(issue.segmentId);
    }
  }, [reviewMode, selectedIssueKey, issuesByKey, selectedId]);

  function selectIssue(issueKey: string) {
    const issue = issuesByKey.get(issueKey);
    if (!issue) return;
    setReviewMode("issues");
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

  function selectBlockById(blockId: number, preferredSegmentId?: number) {
    const block = orderedBlocks.find((candidate) => candidate.id === blockId);
    if (!block || !block.segments.length) return;
    const ambiguityChoiceSegment = block.segments.find((segment) => getAmbiguityChoiceDetails(segment).ambiguityChoiceFound);
    const semanticChoiceSegment = block.segments.find((segment) => getSemanticChoiceDetails(segment).semanticMatchFound);
    const fallbackSegmentId = preferredSegmentId ?? ambiguityChoiceSegment?.id ?? semanticChoiceSegment?.id ?? block.segments[0].id;
    if (reviewMode === "issues") {
      const firstIssue = block.segments
        .flatMap((segment) => issuesBySegmentId.get(segment.id) ?? [])
        .sort((a, b) => a.segmentIndex - b.segmentIndex)[0];
      setSelectedIssueKey(firstIssue?.key ?? null);
    } else {
      setSelectedIssueKey(null);
    }
    setSelectedId(fallbackSegmentId);
    setMessage("");
    setError("");
  }

  function handlePreviousBlock() {
    if (selectedBlockPosition <= 0) return;
    const previousBlock = orderedBlocks[selectedBlockPosition - 1];
    setActiveFilter("all");
    selectBlockById(previousBlock.id);
    blockRefs.current[previousBlock.id]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function handleNextBlock() {
    if (selectedBlockPosition === -1 || selectedBlockPosition >= orderedBlocks.length - 1) return;
    const nextBlock = orderedBlocks[selectedBlockPosition + 1];
    setActiveFilter("all");
    selectBlockById(nextBlock.id);
    blockRefs.current[nextBlock.id]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function getNextUnresolvedBlockIdFromCurrent() {
    if (selectedBlockPosition === -1 || selectedBlockPosition >= orderedBlocks.length - 1) return null;
    for (let idx = selectedBlockPosition + 1; idx < orderedBlocks.length; idx += 1) {
      const candidate = orderedBlocks[idx];
      if (!isBlockResolved(candidate)) {
        return candidate.id;
      }
    }
    return null;
  }

  function getFirstBlockForDocumentReview() {
    if (!orderedBlocks.length) return null;
    const firstUnresolved = orderedBlocks.find((block) => !isBlockResolved(block));
    return firstUnresolved?.id ?? orderedBlocks[0].id;
  }

  function moveToBlockById(blockId: number | null) {
    if (blockId == null) return;
    setActiveFilter("all");
    selectBlockById(blockId);
    blockRefs.current[blockId]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function handleReviewAmbiguities() {
    setReviewMode("issues");
    setActiveFilter("ambiguities");
    const firstAmbiguity = issues.find((issue) => issue.type === "ambiguity");
    if (firstAmbiguity) {
      selectIssue(firstAmbiguity.key);
    }
  }

  function handleReviewSafeSegments() {
    setReviewMode("document");
    setActiveFilter("all");
    if (!safeSegments.length) return;
    setSelectedIssueKey(null);
    setSelectedId(safeSegments[0].segment.id);
    setMessage("");
    setError("");
  }

  function handleNextSafeSegment() {
    if (!safeSegments.length) return;
    const start = selectedSafeIndex === -1 ? 0 : selectedSafeIndex;
    const nextIndex = (start + 1) % safeSegments.length;
    setSelectedIssueKey(null);
    setSelectedId(safeSegments[nextIndex].segment.id);
    setMessage("");
    setError("");
  }

  function switchToDocumentMode() {
    setReviewMode("document");
    setActiveFilter("all");
    const firstBlockId = getFirstBlockForDocumentReview();
    if (firstBlockId != null) {
      const firstBlock = orderedBlocks.find((block) => block.id === firstBlockId);
      setSelectedIssueKey(null);
      setSelectedId(firstBlock?.segments[0]?.id ?? null);
      blockRefs.current[firstBlockId]?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  function switchToIssuesMode() {
    setReviewMode("issues");
    if (activeFilter === "all") {
      setActiveFilter("issues");
    }
    if (!selectedIssueKey && visibleIssues.length > 0) {
      selectIssue(visibleIssues[0].key);
    }
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

  async function loadExportHistory() {
    const payload = await fetch(`${API_URL}/api/translation-jobs/${jobId}/exports`).then(async (res) => {
      if (!res.ok) throw new Error("Failed to load export history");
      return res.json();
    });
    setExportHistory(payload as ExportFile[]);
    return payload as ExportFile[];
  }

  useEffect(() => {
    if (Number.isNaN(jobId)) {
      setError("Invalid job ID");
      setLoading(false);
      return;
    }

    Promise.all([loadJobMeta(), loadReviewBlocks(), loadReviewSummary(), loadTranslationProgress(), loadExportHistory()])
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
    if (!["translation_queued", "translating"].includes(job.status)) return;
    const timer = window.setInterval(() => {
      void loadJobMeta();
      void loadReviewBlocks();
      void loadReviewSummary();
      void loadTranslationProgress();
      void loadExportHistory();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [job?.status]);

  async function persistResult(resultId: number, finalTranslation: string, reviewStatus: string) {
    const res = await fetch(`${API_URL}/api/translation-results/${resultId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ final_translation: finalTranslation, review_status: reviewStatus }),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.detail || "Failed to save translation result");
  }

  async function saveResult(resultId: number, finalTranslation: string, reviewStatus: string) {
    await persistResult(resultId, finalTranslation, reviewStatus);
    const [, summary] = await Promise.all([loadReviewBlocks(), loadReviewSummary(), loadJobMeta(), loadTranslationProgress()]);
    return summary as ReviewSummary;
  }

  function focusReviewGuidance() {
    setSelectedIssueKey(null);
    setSelectedId(null);
    setIsEditing(false);
    setReviewMode("document");
    setActiveFilter("all");
    reviewGuidanceRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function transitionToReviewCompleteState(summary: ReviewSummary | null | undefined) {
    if (!summary?.review_complete) return false;
    focusReviewGuidance();
    setMessage("Review complete. Continue in Review Guidance to export.");
    setError("");
    return true;
  }

  function renderInlineSegments(block: DocumentBlock, side: "source" | "target") {
    if (!block.segments.length) {
      return side === "source" ? block.text_original : (block.text_translated ?? "");
    }

    return block.segments.map((segment, idx) => {
      const isSelected = selectedSegment?.id === segment.id;
      const isSafe = isSafeSegment(segment);
      const segmentHasSelectedIssue = Boolean(
        selectedIssueKey && issuesBySegmentId.get(segment.id)?.some((issue) => issue.key === selectedIssueKey)
      );
      const text =
        side === "source"
          ? segment.source_text
          : isSelected && isEditing
            ? draftTranslation
            : segment.final_translation;
      const displayText = preferFullBlockTranslationWhenCollapsed(block, side, text, isSelected, isEditing);
      const ranges = buildHighlightRanges(segment, side, selectedIssueKey);
      const wrapperProps =
        side === "target"
          ? getTranslationWrapperProps(segment)
          : { className: undefined, title: undefined };

      return (
        <span
          key={segment.id}
          onClick={() => {
            selectBlockById(block.id, segment.id);
          }}
          className={`rounded-md transition-colors cursor-pointer ${
            segmentHasSelectedIssue
              ? "bg-slate-100/90 ring-1 ring-slate-400"
              : isSafe
                ? "bg-emerald-50/60 ring-1 ring-emerald-100"
              : isSelected
                ? "bg-slate-100/80"
                : "hover:bg-slate-100/70"
          }`}
        >
          {renderHighlightedText(displayText, ranges, wrapperProps.className, wrapperProps.title, selectIssue)}
          {idx < block.segments.length - 1 ? " " : ""}
        </span>
      );
    });
  }

  function renderNode(node: DocumentNode, side: "source" | "target") {
    if (node.type === "bullet_list") {
      return (
        <ul className="list-disc space-y-3 pl-6 marker:text-slate-400">
          {node.blocks.map((block) => {
            const isActiveBlock = selectedBlock?.id === block.id;
            const hasSemanticChoice = hasSemanticChoiceInBlock(block);
            const hasAmbiguityChoice = hasAmbiguityChoiceInBlock(block);
            return (
              <li
                key={block.id}
                className={`rounded-md pl-1 transition-colors ${isActiveBlock ? "bg-slate-100/70 ring-1 ring-slate-300" : ""}`}
                ref={(el) => {
                  blockRefs.current[block.id] = el;
                }}
              >
                <div className="mb-1 flex flex-wrap items-center gap-1">
                  <span className="inline-block rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Block {block.block_index + 1}
                  </span>
                  {hasSemanticChoice && (
                    <span className="inline-block rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-700">
                      Semantic choice available
                    </span>
                  )}
                  {hasAmbiguityChoice && (
                    <span className="inline-block rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
                      Ambiguity
                    </span>
                  )}
                </div>
                <p className="text-[15px] leading-7 whitespace-pre-wrap text-slate-900">
                  {renderInlineSegments(block, side)}
                </p>
              </li>
            );
          })}
        </ul>
      );
    }

    const block = node.block;
    const body = renderInlineSegments(block, side);
    const isActiveBlock = selectedBlock?.id === block.id;
    const hasSemanticChoice = hasSemanticChoiceInBlock(block);
    const hasAmbiguityChoice = hasAmbiguityChoiceInBlock(block);
    if (block.block_type === "heading") {
      const H = getHeadingTag(block);
      return (
        <div
          ref={(el) => {
            blockRefs.current[block.id] = el;
          }}
          className={`rounded-md p-1 ${isActiveBlock ? "bg-slate-100/70 ring-1 ring-slate-300" : ""}`}
        >
          <div className="mb-1 flex flex-wrap items-center gap-1">
            <span className="inline-block rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Block {block.block_index + 1}
            </span>
            {hasSemanticChoice && (
              <span className="inline-block rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-700">
                Semantic choice available
              </span>
            )}
            {hasAmbiguityChoice && (
              <span className="inline-block rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
                Ambiguity
              </span>
            )}
          </div>
          <H className="text-xl font-semibold leading-8 text-slate-900">{body}</H>
        </div>
      );
    }
    return (
      <div
        ref={(el) => {
          blockRefs.current[block.id] = el;
        }}
        className={`rounded-md p-1 ${isActiveBlock ? "bg-slate-100/70 ring-1 ring-slate-300" : ""}`}
      >
        <div className="mb-1 flex flex-wrap items-center gap-1">
          <span className="inline-block rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Block {block.block_index + 1}
          </span>
          {hasSemanticChoice && (
            <span className="inline-block rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-700">
              Semantic choice available
            </span>
          )}
          {hasAmbiguityChoice && (
            <span className="inline-block rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
              Ambiguity
            </span>
          )}
        </div>
        <p className="text-[15px] leading-7 whitespace-pre-wrap text-slate-900">{body}</p>
      </div>
    );
  }

  function getSelectedDecisionTranslation() {
    if (!selectedSegment) return "";
    const current = selectedSegment.final_translation || "";
    if (hasAmbiguityChoice && selectedAmbiguityTranslation.trim()) {
      return applyAmbiguityChoiceToSegment(selectedSegment, selectedAmbiguityTranslation);
    }
    if (!hasAmbiguityChoice && hasSemanticChoice && semanticChoice === "suggested" && semanticSuggestionText.trim()) {
      return semanticSuggestionText.trim();
    }
    const draft = draftTranslation.trim();
    return draft || current;
  }

  function getSelectedDecisionStatus() {
    if (!hasAmbiguityChoice && hasSemanticChoice && semanticChoice === "suggested") {
      return "memory_match";
    }
    return "approved";
  }

  function handleAmbiguityChoiceChange(idx: number) {
    setAmbiguityChoiceIndex(idx);
    if (!selectedSegment) return;
    const option = ambiguityOptions[idx];
    if (!option) return;
    const updatedTranslation = applyAmbiguityChoiceToSegment(selectedSegment, option.translation);
    setDraftTranslation(updatedTranslation);
    setBlocks((currentBlocks) =>
      currentBlocks.map((block) => ({
        ...block,
        segments: block.segments.map((segment) =>
          segment.id === selectedSegment.id ? { ...segment, final_translation: updatedTranslation } : segment
        ),
      }))
    );
  }

  function handleSemanticChoiceChange(value: SemanticChoiceOption) {
    setSemanticChoice(value);
    if (!selectedSegment) return;
    if (value === "suggested" && semanticSuggestionText.trim()) {
      setDraftTranslation(semanticSuggestionText.trim());
      return;
    }
    setDraftTranslation(selectedSegment.final_translation || "");
  }

  async function handleSaveSegmentEdit() {
    if (!selectedSegment) return;
    const nextBlockId = reviewMode === "document" ? getNextUnresolvedBlockIdFromCurrent() : null;
    const finalTranslation = getSelectedDecisionTranslation();
    const reviewStatus = getSelectedDecisionStatus();
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      const summary = await saveResult(selectedSegment.id, finalTranslation, reviewStatus);
      setIsEditing(false);
      if (reviewMode === "document" && transitionToReviewCompleteState(summary)) {
        return;
      }
      if (reviewMode === "document") {
        moveToBlockById(nextBlockId);
        setMessage("Saved and approved. Moved to next block.");
      } else {
        setMessage("Saved and approved.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApprove() {
    if (!selectedSegment) return;
    const nextBlockId = reviewMode === "document" ? getNextUnresolvedBlockIdFromCurrent() : null;
    const finalTranslation = getSelectedDecisionTranslation();
    const reviewStatus = getSelectedDecisionStatus();
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      const summary = await saveResult(selectedSegment.id, finalTranslation, reviewStatus);
      setIsEditing(false);
      if (reviewMode === "document" && transitionToReviewCompleteState(summary)) {
        return;
      }
      if (reviewMode === "document") {
        moveToBlockById(nextBlockId);
        setMessage("Block approved. Moved to next block.");
      } else {
        setMessage("Item approved.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApproveCurrentBlock() {
    if (!selectedBlock) return;
    const nextBlockId = getNextUnresolvedBlockIdFromCurrent();
    const selectedDecisionTranslation = getSelectedDecisionTranslation();
    const selectedDecisionStatus = getSelectedDecisionStatus();
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      const toApprove = selectedBlock.segments.filter(
        (segment) => !isAcceptableFinalStatus(segment.review_status) && segment.final_translation.trim().length > 0
      );
      for (const segment of toApprove) {
        if (selectedSegment && segment.id === selectedSegment.id) {
          await persistResult(segment.id, selectedDecisionTranslation, selectedDecisionStatus);
        } else {
          await persistResult(segment.id, segment.final_translation, "approved");
        }
      }
      const [, summary] = await Promise.all([loadReviewBlocks(), loadReviewSummary(), loadJobMeta(), loadTranslationProgress()]);
      if (transitionToReviewCompleteState(summary as ReviewSummary)) {
        return;
      }
      moveToBlockById(nextBlockId);
      setMessage(
        toApprove.length > 0
          ? `Approved ${toApprove.length} segment${toApprove.length === 1 ? "" : "s"} in Block ${selectedBlock.block_index + 1}.`
          : "Block already reviewed. Moved to next block."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve block");
    } finally {
      setActionLoading(false);
    }
  }

  function handleSkipBlock() {
    const nextBlockId = getNextUnresolvedBlockIdFromCurrent();
    if (nextBlockId == null) {
      setMessage("Reached the end of the document.");
      return;
    }
    moveToBlockById(nextBlockId);
    setMessage("Skipped block. Moved to next block.");
    setError("");
  }

  function applyAmbiguityChoiceToSegment(segment: ReviewSegment, choiceTranslation: string) {
    const selectedChoice = (choiceTranslation || "").trim();
    if (!selectedChoice) return segment.final_translation || "";
    const currentText = segment.final_translation || "";
    if (!currentText.trim()) return selectedChoice;
    const ambiguityAnnotation = segment.annotations.find((annotation) => annotation.annotation_type === "ambiguity");
    const hasTargetRange =
      ambiguityAnnotation?.target_start != null &&
      ambiguityAnnotation?.target_end != null &&
      ambiguityAnnotation.target_end > ambiguityAnnotation.target_start;
    if (hasTargetRange) {
      return replaceByRange(
        currentText,
        ambiguityAnnotation.target_start as number,
        ambiguityAnnotation.target_end as number,
        selectedChoice
      );
    }
    const rawAmbiguousTarget = (ambiguityAnnotation?.target_span_text || "").trim();
    const currentAmbiguousTarget = cleanChoiceTranslationText(ambiguityAnnotation?.target_span_text || "");
    if (rawAmbiguousTarget && currentText.includes(rawAmbiguousTarget)) {
      return replaceFirstOccurrence(currentText, rawAmbiguousTarget, selectedChoice);
    }
    if (currentAmbiguousTarget && currentText.includes(currentAmbiguousTarget)) {
      return replaceFirstOccurrence(currentText, currentAmbiguousTarget, selectedChoice);
    }
    // No reliable in-context span match: keep full segment text to avoid collapsing content.
    return currentText;
  }

  function handleEditSelectedTranslation() {
    if (selectedSegment) {
      setDraftTranslation(selectedSegment.final_translation || "");
    }
    setIsEditing(true);
    setMessage("Edit mode enabled. Update the translation and save.");
    setError("");
  }

  function handleToggleEdit() {
    if (!isEditing) {
      handleEditSelectedTranslation();
      return;
    }
    setIsEditing((current) => {
      if (!current) {
        setDraftTranslation(selectedSegment?.final_translation || "");
      }
      return !current;
    });
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

  async function handleApproveAllSafeSegments() {
    if (!job) return;
    const safeCountToApprove = safeUnresolvedSegments;
    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`${API_URL}/api/translation-jobs/${job.id}/approve-safe-segments`, {
        method: "POST",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.detail || "Failed to approve safe segments");
      if (payload && typeof payload === "object") {
        setReviewSummary(payload as ReviewSummary);
      }
      await Promise.all([loadJobMeta(), loadReviewSummary(), loadReviewBlocks(), loadTranslationProgress()]);
      const label = safeCountToApprove === 1 ? "segment" : "segments";
      setMessage(`✓ ${safeCountToApprove} ${label} approved`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve safe segments");
    } finally {
      setActionLoading(false);
    }
  }

  function getFirstUnresolvedAmbiguityBlockId() {
    const firstAmbiguity = orderedBlocks.find((block) =>
      block.segments.some(
        (segment) => !isAcceptableFinalStatus(segment.review_status) && getAmbiguityChoiceDetails(segment).ambiguityChoiceFound
      )
    );
    return firstAmbiguity?.id ?? null;
  }

  function getNextUnresolvedBlockId() {
    const nextUnresolved = orderedBlocks.find((block) => !isBlockResolved(block));
    return nextUnresolved?.id ?? null;
  }

  function getRecommendedReviewBlockId() {
    return getFirstUnresolvedAmbiguityBlockId() ?? getNextUnresolvedBlockId();
  }

  function handleDownloadLatestExport() {
    if (!latestExport?.download_url) return;
    const url = `${API_URL}${latestExport.download_url}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handlePrimaryGuidanceAction() {
    if (guidanceStatusLabel === "Exported") {
      handleDownloadLatestExport();
      return;
    }
    if (guidanceStatusLabel === "Review Complete") {
      handleOpenExportModal();
      return;
    }
    switchToDocumentMode();
    moveToBlockById(getRecommendedReviewBlockId());
  }

  function triggerExportDownload(payload: ExportResult) {
    if (!payload.download_url) return;
    const url = `${API_URL}${payload.download_url}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleExportFinalDocument(selectedMode: ExportMode, selectedFormat: ExportFormat) {
    if (!job) return;
    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(
        `${API_URL}/api/translation-jobs/${job.id}/export?file_type=${selectedFormat}&formatting_mode=${selectedMode}`,
        {
          method: "POST",
        }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.detail || "Failed to export document");
      const exportPayload = payload as ExportResult;
      setExportResult(exportPayload);
      triggerExportDownload(exportPayload);
      await Promise.all([loadJobMeta(), loadReviewSummary(), loadTranslationProgress(), loadExportHistory()]);
      setMessage("Export successful. Your file is downloading.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export document");
    } finally {
      setActionLoading(false);
    }
  }

  function handleOpenExportModal() {
    setExportFormat("docx");
    setExportMode("preserve_formatting");
    setShowExportModal(true);
  }

  async function handleExportDocumentWorkflow() {
    if (!job) return;
    const selectedMode = exportMode;
    const selectedFormat = exportFormat;
    setShowExportModal(false);
    if (workflowStatus === "ready_for_export" || workflowStatus === "exported") {
      await handleExportFinalDocument(selectedMode, selectedFormat);
      return;
    }
    if (!reviewComplete) {
      setError("Resolve all review items before export.");
      return;
    }
    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      const markReady = await fetch(`${API_URL}/api/translation-jobs/${job.id}/mark-ready`, {
        method: "POST",
      });
      const readyPayload = await markReady.json().catch(() => ({}));
      if (!markReady.ok) throw new Error(readyPayload.detail || "Failed to mark ready for export");

      const exportUrl = `${API_URL}/api/translation-jobs/${job.id}/export?file_type=${selectedFormat}&formatting_mode=${selectedMode}`;
      const exportRes2 = await fetch(exportUrl, { method: "POST" });
      const exportPayload = await exportRes2.json().catch(() => ({}));
      if (!exportRes2.ok) throw new Error(exportPayload.detail || "Failed to export document");
      const payload = exportPayload as ExportResult;
      setExportResult(payload);
      triggerExportDownload(payload);
      await Promise.all([loadJobMeta(), loadReviewSummary(), loadTranslationProgress(), loadExportHistory()]);
      setMessage("Export successful. Your file is downloading.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export document");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-50 p-6">Loading…</div>;
  if (error && !job) return <div className="min-h-screen bg-slate-50 p-6 text-red-600">{error}</div>;
  if (!job) return <div className="min-h-screen bg-slate-50 p-6 text-red-600">Job not found</div>;

  const glossaryMatches = selectedSegment?.glossary_matches?.matches ?? [];
  const totalSegments = reviewSummary?.total_segments ?? allSegments.length;
  const unresolvedSegments = reviewSummary?.unresolved_count ?? reviewSummary?.unresolved_segments ?? allSegments.length;
  const unresolvedAmbiguities =
    reviewSummary?.unresolved_ambiguities ?? reviewSummary?.ambiguity_count ?? 0;
  const unresolvedSemanticReviews =
    reviewSummary?.unresolved_semantic_reviews ?? reviewSummary?.semantic_memory_review_count ?? 0;
  const unresolvedGlossaryReviews = allSegments.filter(
    ({ segment }) => !isAcceptableFinalStatus(segment.review_status) && segment.glossary_applied
  ).length;
  const unresolvedMemoryReviews = allSegments.filter(
    ({ segment }) => !isAcceptableFinalStatus(segment.review_status) && (segment.exact_memory_used || segment.semantic_memory_used)
  ).length;
  const safeUnresolvedSegments = reviewSummary?.safe_unresolved_segments ?? 0;
  const segmentsRequiringAttention = Math.max(unresolvedSegments - safeUnresolvedSegments, 0);
  const reviewComplete = Boolean(reviewSummary?.review_complete);
  const workflowStatus = reviewSummary?.overall_status ?? job.status;
  const isReadOnly = workflowStatus === "exported";
  const selectedSegmentStatus = normalizeSegmentStatus(selectedSegment?.review_status ?? "unreviewed");
  const selectedSegmentIsSafe = Boolean(selectedSegment && isSafeSegment(selectedSegment));
  const canEditSelectedSegment = !isReadOnly;
  const hasDraftChanges =
    (draftTranslation || "").trim() !== (selectedSegment?.final_translation || "").trim();
  const ambiguityChoiceDetails = getAmbiguityChoiceDetails(selectedSegment);
  const hasAmbiguityChoice = ambiguityChoiceDetails.ambiguityChoiceFound;
  const ambiguityOptions = ambiguityChoiceDetails.options;
  const currentSuggestionMatches = ambiguityOptions
    .map((option, idx) => ({ idx, normalized: normalizeChoiceText(option.translation) }))
    .filter(
      (entry) =>
        entry.normalized.length > 0 &&
        entry.normalized === normalizeChoiceText(ambiguityChoiceDetails.currentTranslation)
    )
    .map((entry) => entry.idx);
  const currentSuggestionIndex = currentSuggestionMatches.length === 1 ? currentSuggestionMatches[0] : null;
  const selectedAmbiguityOption = ambiguityChoiceIndex == null ? null : ambiguityOptions[ambiguityChoiceIndex] ?? null;
  const selectedAmbiguityTranslation = selectedAmbiguityOption?.translation ?? "";
  const blockAmbiguityIssues = !selectedBlock
    ? ([] as ReviewIssue[])
    : selectedBlock.segments
        .filter((segment) => !isAcceptableFinalStatus(segment.review_status))
        .flatMap((segment) =>
          (issuesBySegmentId.get(segment.id) ?? []).filter((issue) => issue.type === "ambiguity")
        )
        .sort((a, b) => (a.segmentIndex === b.segmentIndex ? a.key.localeCompare(b.key) : a.segmentIndex - b.segmentIndex));
  const activeBlockAmbiguityIndex = blockAmbiguityIssues.findIndex((issue) => issue.key === selectedIssueKey);
  const activeBlockAmbiguityPosition = activeBlockAmbiguityIndex === -1 ? 1 : activeBlockAmbiguityIndex + 1;
  const semanticChoiceDetails = getSemanticChoiceDetails(selectedSegment);
  const hasSemanticChoice = semanticChoiceDetails.semanticMatchFound;
  const semanticSuggestionText = semanticChoiceDetails.suggestedTranslation;
  const semanticSimilarityScore = semanticChoiceDetails.similarityScore;
  const isSafeDecisionOnlyMode = selectedSegmentIsSafe;
  const currentBlockResolved = Boolean(selectedBlock && isBlockResolved(selectedBlock));
  const isDocumentMode = reviewMode === "document";
  const isLastBlock = selectedBlockPosition !== -1 && selectedBlockPosition === orderedBlocks.length - 1;
  const primaryActionDisabled = actionLoading || (hasAmbiguityChoice && !selectedAmbiguityTranslation.trim()) || currentBlockResolved;
  const guidanceStatusLabel = workflowStatus === "exported" ? "Exported" : reviewComplete ? "Review Complete" : "In Review";
  const latestExport = exportHistory.find((entry) => entry.latest) ?? exportHistory[0] ?? null;
  const lastExportTimestamp = latestExport?.generated_at ?? exportResult?.generated_at ?? null;
  const lastExportMode = latestExport?.export_mode ?? exportResult?.export_mode ?? null;
  const lastExportFormat = latestExport?.export_format ?? exportResult?.export_format ?? "txt";
  const totalBlocks = orderedBlocks.length;
  const filterChips: { key: ReviewFilter; label: string; count: number }[] = [
    { key: "all", label: "All Content", count: allSegments.length },
    { key: "issues", label: "Issues", count: flagged.length },
    { key: "ambiguities", label: "Ambiguities", count: allSegments.filter(({ segment }) => matchesFilter(segment, "ambiguities")).length },
    { key: "glossary", label: "Glossary", count: allSegments.filter(({ segment }) => matchesFilter(segment, "glossary")).length },
    { key: "memory", label: "Memory", count: allSegments.filter(({ segment }) => matchesFilter(segment, "memory")).length },
  ];
  const firstUnresolvedAmbiguityBlockId = getFirstUnresolvedAmbiguityBlockId();
  const nextUnresolvedBlockId = getNextUnresolvedBlockId();
  const recommendedNextStep =
    guidanceStatusLabel === "Exported"
      ? "Download the latest exported file."
      : guidanceStatusLabel === "Review Complete"
        ? "Review complete — ready to export."
        : firstUnresolvedAmbiguityBlockId != null
          ? `Resolve ambiguity in Block ${((orderedBlocks.find((b) => b.id === firstUnresolvedAmbiguityBlockId)?.block_index ?? 0) + 1).toString()} next.`
          : nextUnresolvedBlockId != null
            ? `Continue with Block ${((orderedBlocks.find((b) => b.id === nextUnresolvedBlockId)?.block_index ?? 0) + 1).toString()}.`
            : "Review complete — ready to export.";
  const primaryGuidanceLabel =
    guidanceStatusLabel === "Exported"
      ? "Download Latest Export"
      : guidanceStatusLabel === "Review Complete"
        ? "Export Document"
        : "Continue Review";
  const isPrimaryGuidanceDisabled = guidanceStatusLabel === "Exported" && !latestExport?.download_url;

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
          <p className="mt-2 text-sm text-slate-600">Follow the workflow below to review and export.</p>
          {job.error_message && <p className="mt-1 text-sm text-red-600">{job.error_message}</p>}
          <div className="mt-4 inline-flex rounded-lg border border-slate-300 bg-white p-1">
            <button
              type="button"
              onClick={switchToDocumentMode}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                reviewMode === "document"
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Full Document
            </button>
            <button
              type="button"
              onClick={switchToIssuesMode}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                reviewMode === "issues"
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Issues Only
            </button>
          </div>
        </div>

        <ReviewGuidancePanel
          reviewGuidanceRef={reviewGuidanceRef}
          statusLabel={guidanceStatusLabel}
          completedBlocks={completedBlocks}
          totalBlocks={totalBlocks}
          unresolvedBlocks={unresolvedBlocks}
          unresolvedAmbiguities={unresolvedAmbiguities}
          recommendedNextStep={recommendedNextStep}
          translationStyle={job.translation_style === "literal" ? "literal" : "natural"}
          primaryActionLabel={primaryGuidanceLabel}
          isPrimaryActionDisabled={isPrimaryGuidanceDisabled}
          actionLoading={actionLoading}
          onPrimaryAction={handlePrimaryGuidanceAction}
        />

        {message && <p className="mb-4 text-sm text-green-600">{message}</p>}
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <DocumentDiffPane
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            reviewMode={reviewMode}
            filterChips={filterChips}
            visibleIssuesLength={visibleIssues.length}
            displayedNodes={displayedNodes}
            allNodesCount={allNodes.length}
            getNodeSpacing={getNodeSpacing}
            renderNode={(node, side) => renderNode(node as DocumentNode, side)}
            segmentRefs={segmentRefs}
          />

          <ReviewDetailsPane
            selectedSegment={selectedSegment}
            selectedBlock={selectedBlock}
            reviewComplete={reviewComplete}
            onFocusReviewGuidance={focusReviewGuidance}
            reviewMode={reviewMode}
            orderedBlocksLength={orderedBlocks.length}
            completedBlocks={completedBlocks}
            selectedBlockPosition={selectedBlockPosition}
            onPreviousBlock={handlePreviousBlock}
            onNextBlock={handleNextBlock}
            isLastBlock={isLastBlock}
            unresolvedBlocks={unresolvedBlocks}
            visibleIssuesLength={visibleIssues.length}
            currentIssueIndex={currentIssueIndex}
            onPreviousIssue={() => goToIssue(-1)}
            onNextIssue={() => goToIssue(1)}
            selectedIssue={selectedIssue}
            issueTypeLabel={issueTypeLabel}
            selectedSegmentIsSafe={selectedSegmentIsSafe}
            selectedSafeIndex={selectedSafeIndex}
            safeSegmentsLength={safeSegments.length}
            isSafeDecisionOnlyMode={isSafeDecisionOnlyMode}
            issueBadgeClass={issueBadgeClass}
            cleanPanelText={cleanPanelText}
            hasAmbiguityChoice={hasAmbiguityChoice}
            ambiguityExplanation={ambiguityChoiceDetails.explanation}
            blockAmbiguityIssuesLength={blockAmbiguityIssues.length}
            activeBlockAmbiguityPosition={activeBlockAmbiguityPosition}
            ambiguityChoiceIndex={ambiguityChoiceIndex}
            ambiguityOptions={ambiguityOptions}
            currentSuggestionIndex={currentSuggestionIndex}
            onAmbiguityChoiceChange={handleAmbiguityChoiceChange}
            isReadOnly={isReadOnly}
            selectedSegmentStatus={selectedSegmentStatus as "approved" | "edited" | "memory_match" | "unreviewed"}
            isEditing={isEditing}
            canEditSelectedSegment={canEditSelectedSegment}
            draftTranslation={draftTranslation}
            onDraftTranslationChange={setDraftTranslation}
            glossaryMatches={glossaryMatches}
            hasSemanticChoice={hasSemanticChoice}
            semanticSimilarityScore={semanticSimilarityScore}
            semanticChoice={semanticChoice}
            onSemanticChoiceChange={handleSemanticChoiceChange}
            isDocumentMode={isDocumentMode}
            currentBlockResolved={currentBlockResolved}
            onApprove={handleApprove}
            onApproveCurrentBlock={handleApproveCurrentBlock}
            primaryActionDisabled={primaryActionDisabled}
            onToggleEdit={handleToggleEdit}
            actionLoading={actionLoading}
            onSkipBlock={handleSkipBlock}
            hasDraftChanges={hasDraftChanges}
            onSaveSegmentEdit={handleSaveSegmentEdit}
            onNextSafeSegment={handleNextSafeSegment}
            selectedFlaggedIndex={selectedFlaggedIndex}
            flaggedLength={flagged.length}
          />
        </div>
        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900">Export settings</h3>
              <p className="mt-1 text-sm text-slate-600">
                Choose export options for this download.
              </p>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Export format</p>
                  <label className="mt-2 block rounded-lg border border-slate-200 bg-white px-3 py-3">
                    <div className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="export-format"
                        value="docx"
                        checked={exportFormat === "docx"}
                        onChange={() => setExportFormat("docx")}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-900">DOCX</p>
                        <p className="mt-1 text-xs text-slate-600">Best for sharing editable documents.</p>
                      </div>
                    </div>
                  </label>
                  <label className="mt-2 block rounded-lg border border-slate-200 bg-white px-3 py-3">
                    <div className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="export-format"
                        value="rtf"
                        checked={exportFormat === "rtf"}
                        onChange={() => setExportFormat("rtf")}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-900">RTF</p>
                        <p className="mt-1 text-xs text-slate-600">Rich text output compatible with many editors.</p>
                      </div>
                    </div>
                  </label>
                  <label className="mt-2 block rounded-lg border border-slate-200 bg-white px-3 py-3">
                    <div className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="export-format"
                        value="txt"
                        checked={exportFormat === "txt"}
                        onChange={() => setExportFormat("txt")}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-900">TXT</p>
                        <p className="mt-1 text-xs text-slate-600">Plain text export for simple delivery.</p>
                      </div>
                    </div>
                  </label>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Formatting</p>
                </div>
                <label className="block cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-3">
                  <div className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="export-mode"
                      value="preserve_formatting"
                      checked={exportMode === "preserve_formatting"}
                      onChange={() => setExportMode("preserve_formatting")}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Preserve original formatting</p>
                      <p className="mt-1 text-xs text-slate-600">
                        Preserve original formatting: keeps headings, spacing, and structure where possible.
                      </p>
                    </div>
                  </div>
                </label>
                <label className="block cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-3">
                  <div className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="export-mode"
                      value="clean_text"
                      checked={exportMode === "clean_text"}
                      onChange={() => setExportMode("clean_text")}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Clean text only</p>
                      <p className="mt-1 text-xs text-slate-600">
                        Clean text only: removes formatting and exports plain reviewed text.
                      </p>
                    </div>
                  </div>
                </label>
                {lastExportTimestamp && (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Last export: {new Date(lastExportTimestamp).toLocaleString()} • Format:{" "}
                    {lastExportFormat.toUpperCase()} • Last mode:{" "}
                    {lastExportMode === "preserve_formatting"
                      ? "Preserve original formatting"
                      : lastExportMode === "clean_text"
                        ? "Clean text only"
                        : "Not available"}
                  </p>
                )}
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExportDocumentWorkflow}
                  disabled={actionLoading}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:bg-emerald-300"
                >
                  Export document
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
