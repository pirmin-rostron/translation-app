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

function isAcceptableFinalStatus(status: string) {
  const normalized = normalizeSegmentStatus(status);
  return normalized === "approved" || normalized === "edited" || normalized === "memory_match";
}

function isSafeSegment(segment: ReviewSegment) {
  return (
    !isAcceptableFinalStatus(segment.review_status) &&
    !segment.ambiguity_detected &&
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
  const ambiguityChoiceFound = Boolean(segment.ambiguity_choice_found ?? (segment.ambiguity_detected && options.length > 0));
  return { ambiguityChoiceFound, sourcePhrase, explanation, options, currentTranslation };
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
  return segment.ambiguity_detected || segment.glossary_applied || hasMemory(segment);
}

function isFlagged(segment: ReviewSegment) {
  return segment.review_status !== "approved" && hasReviewSignal(segment);
}

function matchesFilter(segment: ReviewSegment, filter: ReviewFilter) {
  if (filter === "all") return true;
  if (filter === "issues") return isFlagged(segment);
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
    if (!filteredSegments.some(({ segment }) => segment.id === selectedId)) {
      setSelectedId(filteredSegments[0].segment.id);
    }
  }, [filteredSegments, selectedId]);

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
    await Promise.all([loadReviewBlocks(), loadReviewSummary(), loadJobMeta(), loadTranslationProgress()]);
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
          {renderHighlightedText(text, ranges, wrapperProps.className, wrapperProps.title, selectIssue)}
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

  async function handleSaveSegmentDraft() {
    if (!selectedSegment) return;
    const nextBlockId = reviewMode === "document" ? getNextUnresolvedBlockIdFromCurrent() : null;
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      await saveResult(selectedSegment.id, draftTranslation, "edited");
      setIsEditing(false);
      if (reviewMode === "document") {
        moveToBlockById(nextBlockId);
        setMessage("Edited and saved. Moved to next block.");
      } else {
        setMessage("Edited and saved.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApprove() {
    if (!selectedSegment) return;
    const nextBlockId = reviewMode === "document" ? getNextUnresolvedBlockIdFromCurrent() : null;
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      await saveResult(selectedSegment.id, draftTranslation, "approved");
      setIsEditing(false);
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
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      const toApprove = selectedBlock.segments.filter(
        (segment) => !isAcceptableFinalStatus(segment.review_status) && segment.final_translation.trim().length > 0
      );
      for (const segment of toApprove) {
        await persistResult(segment.id, segment.final_translation, "approved");
      }
      await Promise.all([loadReviewBlocks(), loadReviewSummary(), loadJobMeta(), loadTranslationProgress()]);
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

  async function handleUseSelectedTranslation() {
    if (!selectedSegment) return;
    if (hasAmbiguityChoice && !selectedAmbiguityTranslation.trim()) return;
    if (!hasAmbiguityChoice && semanticChoice === "suggested" && !semanticSuggestionText.trim()) return;
    const nextBlockId = reviewMode === "document" ? getNextUnresolvedBlockIdFromCurrent() : null;
    const chosenTranslation = hasAmbiguityChoice
      ? selectedAmbiguityTranslation
      : semanticChoice === "suggested"
        ? semanticSuggestionText
        : draftTranslation;
    const chosenStatus = hasAmbiguityChoice ? "approved" : semanticChoice === "suggested" ? "memory_match" : "approved";
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      await saveResult(selectedSegment.id, chosenTranslation, chosenStatus);
      setIsEditing(false);
      if (reviewMode === "document") {
        moveToBlockById(nextBlockId);
      }
      setMessage(hasAmbiguityChoice ? "Selected ambiguity meaning and moved forward." : semanticChoice === "suggested"
        ? "Selected semantic memory translation and moved forward."
        : "Selected current translation and moved forward.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply selected translation");
    } finally {
      setActionLoading(false);
    }
  }

  function handleEditSelectedTranslation() {
    if (hasAmbiguityChoice && selectedAmbiguityTranslation.trim()) {
      setDraftTranslation(selectedAmbiguityTranslation);
    } else if (semanticChoice === "suggested" && semanticSuggestionText.trim()) {
      setDraftTranslation(semanticSuggestionText);
    } else {
      setDraftTranslation(selectedSegment?.final_translation ?? draftTranslation);
    }
    setIsEditing(true);
    setMessage("Selected translation loaded for editing.");
    setError("");
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
  const totalSegments = reviewSummary?.total_segments ?? allSegments.length;
  const unresolvedSegments = reviewSummary?.unresolved_count ?? reviewSummary?.unresolved_segments ?? allSegments.length;
  const unresolvedAmbiguities =
    reviewSummary?.unresolved_ambiguities ?? reviewSummary?.ambiguity_count ?? 0;
  const unresolvedSemanticReviews =
    reviewSummary?.unresolved_semantic_reviews ?? reviewSummary?.semantic_memory_review_count ?? 0;
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
  const semanticChoiceDetails = getSemanticChoiceDetails(selectedSegment);
  const hasSemanticChoice = semanticChoiceDetails.semanticMatchFound;
  const semanticSuggestionText = semanticChoiceDetails.suggestedTranslation;
  const semanticSimilarityScore = semanticChoiceDetails.similarityScore;
  const hasGuidedChoice = hasAmbiguityChoice || hasSemanticChoice;
  const isDocumentMode = reviewMode === "document";
  const isLastBlock = selectedBlockPosition !== -1 && selectedBlockPosition === orderedBlocks.length - 1;
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
  const showReviewSafeSegments =
    safeUnresolvedSegments > 0 && !["ready_for_export", "exported"].includes(workflowStatus);
  const showDownloadLink = workflowStatus === "exported" && exportResult?.download_url;
  const guidanceTitle =
    workflowStatus === "exported"
      ? "Document exported"
      : showExportAction
        ? "Ready for export"
        : showMarkReadyForExport
          ? "All segments reviewed"
          : segmentsRequiringAttention > 0
            ? `${segmentsRequiringAttention} items still require review`
            : `Review in progress — ${unresolvedSegments} segments remaining`;
  const guidanceDetail =
    workflowStatus === "exported"
      ? "Download the final file or re-open review if you need changes."
      : showExportAction
        ? "Export the finalized document."
        : showMarkReadyForExport
          ? "All required review items are resolved."
          : segmentsRequiringAttention > 0
            ? "Review flagged items next to finish the document review."
            : "Approve safe segments first, then review any remaining flagged items.";

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
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Review Guidance</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{workflowStatusLabel}</p>
              <p className="mt-2 text-sm font-medium text-slate-800">{guidanceTitle}</p>
              <p className="mt-1 text-sm text-slate-600">{guidanceDetail}</p>
              <p className="mt-1 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{totalSegments}</span> total segments
              </p>
              <p className="mt-1 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{safeUnresolvedSegments}</span> safe to approve
              </p>
              <p className="mt-1 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{segmentsRequiringAttention}</span> require attention
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Ambiguities: <span className="font-semibold text-slate-900">{unresolvedAmbiguities}</span> • Semantic
                memory reviews: <span className="font-semibold text-slate-900">{unresolvedSemanticReviews}</span>
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
              {unresolvedAmbiguities > 0 && !["ready_for_export", "exported"].includes(workflowStatus) && (
                <button
                  type="button"
                  onClick={handleReviewAmbiguities}
                  disabled={actionLoading}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60"
                >
                  Review ambiguity
                </button>
              )}
              {showReviewSafeSegments && (
                <button
                  type="button"
                  onClick={handleReviewSafeSegments}
                  disabled={actionLoading}
                  className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                >
                  Review safe segments
                </button>
              )}
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
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={handleApproveAllSafeSegments}
                    disabled={actionLoading}
                    className="rounded-lg border border-indigo-300 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                  >
                    Approve {safeUnresolvedSegments} safe {safeUnresolvedSegments === 1 ? "segment" : "segments"}
                  </button>
                  <p className="text-xs text-slate-500">Safe segments have no ambiguity or conflicts.</p>
                </div>
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
            Next best action:{" "}
            <span className="font-medium text-slate-800">
              {workflowStatus === "exported"
                ? "Download file or re-open review"
                : showExportAction
                  ? "Export document"
                  : showMarkReadyForExport
                    ? "Mark ready for export"
                    : segmentsRequiringAttention > 0
                      ? "Review issues"
                      : showApproveAllSafeSegments
                        ? "Approve all safe segments"
                        : "Save draft and continue review"}
            </span>
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
              {(["all", "issues", "ambiguities", "glossary", "memory"] as ReviewFilter[]).map((filter) => {
                const count =
                  filter === "all"
                    ? allSegments.length
                    : filter === "issues"
                      ? flagged.length
                      : allSegments.filter(({ segment }) => matchesFilter(segment, filter)).length;
                const filterLabel =
                  filter === "all"
                    ? "All Content"
                    : filter === "issues"
                      ? "Issues"
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
          {reviewMode === "issues" ? (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Issue navigation
                </span>
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
                      ? `Reviewing Issue ${currentIssueIndex + 1} of ${visibleIssues.length}`
                      : "No issues found — you're all good here"}
                  </span>
                </div>
              </div>
              {!visibleIssues.length && (
                <p className="mt-2 text-xs text-slate-500">
                  Try <span className="font-medium">All Content</span> to continue full document review.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500">
              Issue navigation is available in <span className="font-medium">Issues Only</span> mode.
            </div>
          )}
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
              <div className="p-8 text-slate-600">
                No issues found — you're all good here. Try switching back to All Content for full document context.
              </div>
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
                {reviewMode === "document" ? (
                  <>
                    <p className="mt-1 text-sm text-slate-500">
                      Reviewing Block {selectedBlock.block_index + 1} of {orderedBlocks.length}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-600">
                      Review progress: {completedBlocks} of {orderedBlocks.length} completed
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePreviousBlock}
                        disabled={selectedBlockPosition <= 0}
                        className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Previous block
                      </button>
                      <button
                        type="button"
                        onClick={handleNextBlock}
                        disabled={selectedBlockPosition === -1 || selectedBlockPosition >= orderedBlocks.length - 1}
                        className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Next block
                      </button>
                    </div>
                    {isLastBlock && (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {unresolvedBlocks === 0 ? (
                          <span>Review complete. You can mark this document ready for export.</span>
                        ) : (
                          <span>{unresolvedBlocks} items still unresolved. Review skipped blocks or unresolved segments.</span>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">
                    {visibleIssues.length
                      ? `Reviewing Issue ${currentIssueIndex + 1} of ${visibleIssues.length}${
                          selectedIssue ? ` (${issueTypeLabel(selectedIssue.type)} • Block ${selectedBlock.block_index + 1})` : ""
                        }`
                      : "No issue selected"}
                  </p>
                )}
                {selectedSegmentIsSafe && (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                    <span className="inline-flex rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-xs font-medium text-emerald-800">
                      Safe segment
                    </span>
                    <p className="mt-2 text-sm text-slate-700">No ambiguity or conflicts detected.</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Safe queue position: {selectedSafeIndex + 1} / {safeSegments.length}
                    </p>
                  </div>
                )}
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
                {hasAmbiguityChoice && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm">
                    <p className="font-medium text-amber-900">Ambiguity detected</p>
                    <p className="mt-1 text-xs text-amber-800">
                      Source phrase:{" "}
                      <span className="font-medium">
                        {ambiguityChoiceDetails.sourcePhrase || selectedSegment.ambiguity_details?.source_span || "Ambiguous phrase"}
                      </span>
                    </p>
                    {ambiguityChoiceDetails.explanation && (
                      <p className="mt-2 text-xs text-slate-700">{ambiguityChoiceDetails.explanation}</p>
                    )}
                    {ambiguityChoiceIndex == null && (
                      <p className="mt-2 text-xs text-amber-800">Choose one meaning to continue.</p>
                    )}
                    <div className="mt-3 space-y-2">
                      {ambiguityOptions.map((option, idx) => (
                        <label
                          key={`${option.meaning}-${idx}`}
                          className="block cursor-pointer rounded-lg border border-amber-200 bg-white px-3 py-2"
                        >
                          <div className="flex items-start gap-2">
                            <input
                              type="radio"
                              name="ambiguity-choice"
                              value={`option-${idx}`}
                              checked={ambiguityChoiceIndex === idx}
                              onChange={() => setAmbiguityChoiceIndex(idx)}
                              disabled={isReadOnly}
                              className="mt-0.5"
                            />
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                                {option.meaning}
                                {idx === currentSuggestionIndex
                                  ? " - Current suggestion"
                                  : ""}
                              </p>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
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

                {hasSemanticChoice && !hasAmbiguityChoice && (
                  <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50/60 p-3 text-sm">
                    <p className="font-medium text-sky-900">Semantic translation choice available</p>
                    <p className="mt-1 text-xs text-sky-700">
                      Suggested from similar previous translation
                      {typeof semanticSimilarityScore === "number"
                        ? ` (${Math.round(semanticSimilarityScore * 100)}%)`
                        : ""}
                    </p>
                    <div className="mt-3 space-y-2">
                      <label className="block cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div className="flex items-start gap-2">
                          <input
                            type="radio"
                            name="semantic-choice"
                            value="current"
                            checked={semanticChoice === "current"}
                            onChange={() => setSemanticChoice("current")}
                            disabled={isReadOnly}
                            className="mt-0.5"
                          />
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current translation</p>
                            <p className="mt-1 whitespace-pre-wrap text-slate-700">{semanticChoiceDetails.currentTranslation}</p>
                          </div>
                        </div>
                      </label>
                      <label className="block cursor-pointer rounded-lg border border-sky-200 bg-white px-3 py-2">
                        <div className="flex items-start gap-2">
                          <input
                            type="radio"
                            name="semantic-choice"
                            value="suggested"
                            checked={semanticChoice === "suggested"}
                            onChange={() => setSemanticChoice("suggested")}
                            disabled={isReadOnly}
                            className="mt-0.5"
                          />
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                              Previous similar approved translation
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-slate-700">{semanticSuggestionText}</p>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                <div className="mt-6 space-y-3">
                  {!isReadOnly && isDocumentMode && (
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={hasGuidedChoice ? handleUseSelectedTranslation : handleApproveCurrentBlock}
                        disabled={
                          actionLoading ||
                          (hasAmbiguityChoice && !selectedAmbiguityTranslation.trim()) ||
                          (!hasAmbiguityChoice && hasSemanticChoice && semanticChoice === "suggested" && !semanticSuggestionText.trim())
                        }
                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-400"
                      >
                        {hasAmbiguityChoice ? "Use selected meaning" : hasGuidedChoice ? "Use selected translation" : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={hasGuidedChoice ? handleEditSelectedTranslation : () => setIsEditing(true)}
                        disabled={actionLoading || !canEditSelectedSegment}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {hasAmbiguityChoice ? "Edit" : hasGuidedChoice ? "Edit selected translation" : "Edit"}
                      </button>
                      <button
                        type="button"
                        onClick={handleSkipBlock}
                        disabled={actionLoading}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Skip
                      </button>
                    </div>
                  )}
                  {!isReadOnly && !isDocumentMode && (selectedSegmentStatus === "unreviewed" || selectedSegmentStatus === "edited") && (
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={actionLoading || !draftTranslation.trim()}
                      className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-400"
                    >
                      Approve
                    </button>
                  )}
                  {!isReadOnly && !isDocumentMode && (selectedSegmentStatus === "unreviewed" || (isEditing && hasDraftChanges)) && (
                    <button
                      type="button"
                      onClick={handleSaveSegmentDraft}
                      disabled={actionLoading || !draftTranslation.trim()}
                      className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Save segment edit
                    </button>
                  )}
                  {!isReadOnly && isDocumentMode && isEditing && hasDraftChanges && (
                    <button
                      type="button"
                      onClick={handleSaveSegmentDraft}
                      disabled={actionLoading || !draftTranslation.trim()}
                      className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Save edit and next block
                    </button>
                  )}
                  {!isReadOnly && selectedSegmentIsSafe && safeSegments.length > 1 && (
                    <button
                      type="button"
                      onClick={handleNextSafeSegment}
                      disabled={actionLoading}
                      className="w-full rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                    >
                      Next safe segment
                    </button>
                  )}
                  {isReadOnly && (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      This document is exported and read-only. Re-open review from the workflow banner to edit.
                    </p>
                  )}
                  <p className="text-xs text-slate-500">
                    {isDocumentMode
                      ? isLastBlock
                        ? unresolvedBlocks === 0
                          ? "End of document reached. Ready to finalize workflow."
                          : `${unresolvedBlocks} blocks still unresolved.`
                        : "Complete this block or skip to continue sequential review."
                      : visibleIssues.length
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
