"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DocumentDiffPane } from "./components/DocumentDiffPane";
import { ReviewDetailsPane } from "./components/ReviewDetailsPane";
import { ReviewGuidancePanel } from "./components/ReviewGuidancePanel";
import { getLanguageDisplayName } from "../../utils/language";

import { API_URL, documentsApi, translationJobsApi, translationResultsApi } from "../../services/api";

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
  source_text_raw: string;
  source_text_display: string;
  translated_text_raw: string | null;
  translated_text_display: string | null;
  text_original: string;
  text_translated: string | null;
  segments: ReviewSegment[];
};

type DocumentNode =
  | { key: string; type: "block"; block: DocumentBlock }
  | { key: string; type: "bullet_list"; blocks: DocumentBlock[] };

type ReviewFilter = "all" | "ambiguities" | "glossary" | "memory";

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

type CanonicalReviewCounts = {
  total_blocks: number;
  completed_blocks: number;
  remaining_blocks: number;
  ambiguity_count: number;
  glossary_count: number;
  memory_count: number;
  issues_count: number;
  total_segments: number;
  unresolved_segments: number;
  safe_unresolved_segments: number;
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

type PreviewPayload = {
  job_id: number;
  document_name: string;
  content_raw: string;
  content_display: string;
};

type TranslationProgress = {
  job_id: number;
  stage_label: string;
  total_segments: number;
  completed_segments: number;
  percentage: number;
  eta_seconds: number | null;
  is_complete: boolean;
  blocks_completed: number;
  blocks_total: number;
};

type ReviewBlocksPage = {
  blocks: DocumentBlock[];
  page: number;
  page_size: number;
  total_blocks: number;
  total_pages: number;
  job_status: string;
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

  const rawFromOptions = Array.isArray(segment.ambiguity_options) ? segment.ambiguity_options : [];
  const rawFromDetails = Array.isArray(segment.ambiguity_details?.alternatives) ? segment.ambiguity_details.alternatives : [];
  const rawOptions = rawFromOptions.length > 0 ? rawFromOptions : rawFromDetails;
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
  const ambiguityChoiceFound = (segment.ambiguity_detected && options.length > 1) || Boolean(segment.ambiguity_choice_found);
  return { ambiguityChoiceFound, sourcePhrase, explanation, options, currentTranslation };
}

function hasValidAmbiguityChoice(segment: ReviewSegment) {
  return getAmbiguityChoiceDetails(segment).ambiguityChoiceFound;
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
  if (filter === "ambiguities") return hasValidAmbiguityChoice(segment);
  if (filter === "glossary") return segment.glossary_applied;
  return hasMemory(segment);
}

function buildDocumentNodes(blocks: DocumentBlock[]) {
  return blocks.map((block) => ({ key: `block-${block.id}`, type: "block" as const, block }));
}

function _stripDisplayArtifacts(value: string | null | undefined) {
  return (value || "")
    .replace(/\\[a-z]+-?\d*\s?/gi, " ")
    .replace(/\b(fonttbl|colortbl|stylesheet|pard|plain|rtf1|ansi|deff\d+)\b/gi, " ")
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasMeaningfulCleanBlockContent(block: DocumentBlock) {
  const source = _stripDisplayArtifacts(block.source_text_display);
  const translated = _stripDisplayArtifacts(block.translated_text_display);
  return Boolean(source || translated);
}

function deriveCanonicalReviewCounts(
  orderedBlocks: DocumentBlock[],
  allSegments: { block: DocumentBlock; segment: ReviewSegment }[],
  reviewSummary: ReviewSummary | null
): CanonicalReviewCounts {
  const unresolvedSegmentCount = allSegments.filter(
    ({ segment }) => !isAcceptableFinalStatus(segment.review_status)
  ).length;
  const unresolvedBlocks = orderedBlocks.filter((block) => !isBlockResolved(block));
  const totalBlocks = orderedBlocks.length;
  const completedBlocks = orderedBlocks.filter((block) => isBlockResolved(block)).length;
  const remainingBlocks = Math.max(totalBlocks - completedBlocks, 0);
  const unresolvedAmbiguityBlocks =
    reviewSummary?.unresolved_ambiguities ??
    unresolvedBlocks.filter((block) =>
      block.segments.some(
        (segment) => !isAcceptableFinalStatus(segment.review_status) && hasValidAmbiguityChoice(segment)
      )
    ).length;
  const unresolvedGlossaryBlocks = unresolvedBlocks.filter((block) =>
    block.segments.some((segment) => !isAcceptableFinalStatus(segment.review_status) && segment.glossary_applied)
  ).length;
  const unresolvedMemoryBlocks = unresolvedBlocks.filter((block) =>
    block.segments.some(
      (segment) => !isAcceptableFinalStatus(segment.review_status) && (segment.exact_memory_used || segment.semantic_memory_used)
    )
  ).length;
  const unresolvedIssueBlocks = unresolvedBlocks.filter((block) =>
    block.segments.some((segment) => !isAcceptableFinalStatus(segment.review_status) && isFlagged(segment))
  ).length;
  const unresolvedSegments = reviewSummary?.unresolved_count ?? reviewSummary?.unresolved_segments ?? unresolvedSegmentCount;
  const totalSegments = reviewSummary?.total_segments ?? allSegments.length;
  const safeUnresolvedSegments = reviewSummary?.safe_unresolved_segments ?? 0;
  return {
    total_blocks: totalBlocks,
    completed_blocks: completedBlocks,
    remaining_blocks: remainingBlocks,
    ambiguity_count: unresolvedAmbiguityBlocks,
    glossary_count: unresolvedGlossaryBlocks,
    memory_count: unresolvedMemoryBlocks,
    issues_count: unresolvedIssueBlocks,
    total_segments: totalSegments,
    unresolved_segments: unresolvedSegments,
    safe_unresolved_segments: safeUnresolvedSegments,
  };
}

function getHeadingTag(block: DocumentBlock): "h1" | "h2" | "h3" {
  const style = String(block.formatting_json?.style_name ?? "").toLowerCase();
  if (style.includes("heading 1")) return "h1";
  if (style.includes("heading 2")) return "h2";
  return "h3";
}

const PAGE_SIZE = 10;

function TranslationReviewPageInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = Number(params.jobId);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  // Keep a ref so interval callbacks always read the latest page without recreating the interval.
  const pageRef = useRef(page);
  pageRef.current = page;
  // Track the previous page to detect page-change navigations without triggering the full job reset.
  const prevPageRef = useRef(page);

  const [job, setJob] = useState<TranslationJob | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBlocks, setTotalBlocks] = useState(0);
  const [doc, setDoc] = useState<DocumentMeta | null>(null);
  const [blocks, setBlocks] = useState<DocumentBlock[]>([]);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [exportHistory, setExportHistory] = useState<ExportFile[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewDocumentName, setPreviewDocumentName] = useState("");
  const [previewContentDisplay, setPreviewContentDisplay] = useState("");
  const [exportMode, setExportMode] = useState<ExportMode>("preserve_formatting");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("docx");
  const [translationProgress, setTranslationProgress] = useState<TranslationProgress | null>(null);
  const [activeFilter, setActiveFilter] = useState<ReviewFilter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draftTranslation, setDraftTranslation] = useState("");
  const [semanticChoice, setSemanticChoice] = useState<SemanticChoiceOption>("current");
  const [ambiguityChoiceIndex, setAmbiguityChoiceIndex] = useState<number | null>(null);
  const [prevAmbiguityChoiceIndex, setPrevAmbiguityChoiceIndex] = useState<number | null>(null);
  const [isAmbiguityChoiceUserSelected, setIsAmbiguityChoiceUserSelected] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const segmentRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const blockRefs = useRef<Record<number, HTMLElement | null>>({});
  const reviewGuidanceRef = useRef<HTMLElement>(null);
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
  const visibleBlocks = useMemo(
    () => filteredBlocks.filter((block) => block.segments.length > 0 || hasMeaningfulCleanBlockContent(block)),
    [filteredBlocks]
  );
  const filteredSegments = useMemo(
    () =>
      visibleBlocks
        .flatMap((block) => block.segments.map((segment) => ({ block, segment })))
        .sort((a, b) => a.segment.segment_index - b.segment.segment_index),
    [visibleBlocks]
  );
  const displayedNodes = useMemo(() => buildDocumentNodes(visibleBlocks), [visibleBlocks]);
  const blockMemoryStates = useMemo(() => {
    const map = new Map<string, { hasExact: boolean; hasSemantic: boolean; similarityScore: number | null }>();
    for (const block of visibleBlocks) {
      const key = `block-${block.id}`;
      const hasExact = block.segments.some((s) => s.exact_memory_used);
      const hasSemantic = !hasExact && block.segments.some((s) => s.semantic_memory_used);
      let similarityScore: number | null = null;
      if (hasSemantic) {
        for (const s of block.segments) {
          const score = s.semantic_memory_details?.similarity_score ?? null;
          if (score !== null && (similarityScore === null || score > similarityScore)) {
            similarityScore = score;
          }
        }
      }
      map.set(key, { hasExact, hasSemantic, similarityScore });
    }
    return map;
  }, [visibleBlocks]);
  const segmentColorStates = useMemo(() => {
    const map = new Map<number, string>();
    for (const { segment } of allSegments) {
      const hasAmbiguity = segment.ambiguity_detected && hasValidAmbiguityChoice(segment);
      const normalized = normalizeSegmentStatus(segment.review_status);
      const isApproved = isAcceptableFinalStatus(normalized);
      if (hasAmbiguity && !isApproved) {
        map.set(segment.id, "unresolved-ambiguity");
      } else if (hasAmbiguity && isApproved) {
        map.set(segment.id, "approved-ambiguity");
      } else if (normalized === "memory_match") {
        map.set(segment.id, "memory-match");
      } else if (isApproved) {
        map.set(segment.id, "approved");
      } else {
        map.set(segment.id, "pending");
      }
    }
    return map;
  }, [allSegments]);
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
  const reviewCounts = useMemo(
    () => deriveCanonicalReviewCounts(orderedBlocks, allSegments, reviewSummary),
    [orderedBlocks, allSegments, reviewSummary]
  );
  const selectedBlockPosition = selectedBlock ? (blockIndexById.get(selectedBlock.id) ?? -1) : -1;

  useEffect(() => {
    if (!filteredSegments.length) {
      setSelectedId(null);
      return;
    }
    if (reviewCompleteState && selectedId == null) {
      return;
    }
    if (!filteredSegments.some(({ segment }) => segment.id === selectedId)) {
      setSelectedId(filteredSegments[0].segment.id);
    }
  }, [filteredSegments, selectedId, reviewCompleteState]);

  useEffect(() => {
    if (!selectedSegment) return;
    setDraftTranslation((selectedSegment.final_translation || "").replace(/\0/g, ""));
    setSemanticChoice("current");
    const ambiguityDetails = getAmbiguityChoiceDetails(selectedSegment);
    const currentTranslationNormalized = normalizeChoiceText(ambiguityDetails.currentTranslation);
    const matchingIndices = ambiguityDetails.options
      .map((option, idx) => ({ idx, normalized: normalizeChoiceText(option.translation) }))
      .filter((entry) => entry.normalized.length > 0 && currentTranslationNormalized.includes(entry.normalized))
      .map((entry) => entry.idx);
    setAmbiguityChoiceIndex(matchingIndices.length === 1 ? matchingIndices[0] : null);
    setIsAmbiguityChoiceUserSelected(false);
    setPrevAmbiguityChoiceIndex(null);
    setIsEditing(false);
  }, [selectedSegment?.id]);

  useEffect(() => {
    if (!selectedId) return;
    segmentRefs.current[selectedId]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selectedId]);

  useEffect(() => {
    if (!orderedBlocks.length) return;
    if (selectedBlockPosition !== -1) return;
    const firstBlock = orderedBlocks.find((block) => !isBlockResolved(block)) ?? orderedBlocks[0];
    setSelectedId(firstBlock.segments[0]?.id ?? null);
    blockRefs.current[firstBlock.id]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [orderedBlocks, selectedBlockPosition]);

  function selectBlockById(blockId: number, preferredSegmentId?: number) {
    const block = orderedBlocks.find((candidate) => candidate.id === blockId);
    if (!block || !block.segments.length) return;
    const ambiguityChoiceSegment = block.segments.find(
      (segment) =>
        !isAcceptableFinalStatus(segment.review_status) &&
        (getAmbiguityChoiceDetails(segment).ambiguityChoiceFound || segment.ambiguity_detected)
    );
    const semanticChoiceSegment = block.segments.find((segment) => getSemanticChoiceDetails(segment).semanticMatchFound);
    const fallbackSegmentId = preferredSegmentId ?? ambiguityChoiceSegment?.id ?? semanticChoiceSegment?.id ?? block.segments[0].id;
    setSelectedId(fallbackSegmentId);
    setPrevAmbiguityChoiceIndex(null);
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

  function focusDocumentReviewStart() {
    setActiveFilter("all");
    const firstBlockId = getFirstBlockForDocumentReview();
    if (firstBlockId != null) {
      const firstBlock = orderedBlocks.find((block) => block.id === firstBlockId);
      setSelectedId(firstBlock?.segments[0]?.id ?? null);
      blockRefs.current[firstBlockId]?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  async function loadReviewBlocks(targetPage: number) {
    const payload = await translationJobsApi.getReviewBlocks<ReviewBlocksPage>(jobId, targetPage, PAGE_SIZE);
    setBlocks(payload.blocks);
    setTotalPages(payload.total_pages);
    setTotalBlocks(payload.total_blocks);
  }

  async function loadJobMeta() {
    const payload = await translationJobsApi.getById<TranslationJob>(jobId);
    setJob(payload);
    return payload;
  }

  async function loadReviewSummary() {
    const payload = await translationJobsApi.getReviewSummary<ReviewSummary>(jobId);
    setReviewSummary(payload);
    return payload;
  }

  async function loadTranslationProgress() {
    const payload = await translationJobsApi.getProgress<TranslationProgress>(jobId);
    setTranslationProgress(payload);
    return payload;
  }

  async function loadExportHistory() {
    const payload = await translationJobsApi.getExports<ExportFile[]>(jobId);
    setExportHistory(payload);
    return payload;
  }

  useEffect(() => {
    // Reset all UI-decision state on job change so no state bleeds if the
    // component is ever reused across jobs without a full remount.
    setActiveFilter("all");
    setSelectedId(null);
    setDraftTranslation("");
    setSemanticChoice("current");
    setAmbiguityChoiceIndex(null);
    setPrevAmbiguityChoiceIndex(null);
    setIsAmbiguityChoiceUserSelected(false);
    setIsEditing(false);
    setShowExportModal(false);
    setShowPreviewModal(false);
    setExportResult(null);
    setMessage("");
    setError("");

    if (Number.isNaN(jobId)) {
      setError("Invalid job ID");
      setLoading(false);
      return;
    }

    prevPageRef.current = page;
    Promise.all([loadJobMeta(), loadReviewBlocks(page), loadReviewSummary(), loadTranslationProgress(), loadExportHistory()])
      .then(async ([loadedJob]) => {
        return documentsApi.getById<DocumentMeta>(loadedJob.document_id).catch(() => null);
      })
      .then(setDoc)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load review"))
      .finally(() => setLoading(false));
  }, [jobId]);

  // Reload blocks when the page changes (page-navigation, not job change).
  useEffect(() => {
    if (prevPageRef.current === page) return;
    prevPageRef.current = page;
    setSelectedId(null);
    void loadReviewBlocks(page);
  }, [page]);

  useEffect(() => {
    if (!job) return;
    if (!["translation_queued", "translating"].includes(job.status)) return;
    const timer = window.setInterval(() => {
      void loadJobMeta();
      void loadReviewBlocks(pageRef.current);
      void loadReviewSummary();
      void loadTranslationProgress();
      void loadExportHistory();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [job?.status]);

  async function persistResult(resultId: number, finalTranslation: string, reviewStatus: string) {
    await translationResultsApi.update<unknown>(resultId, finalTranslation, reviewStatus);
  }

  async function saveResult(resultId: number, finalTranslation: string, reviewStatus: string) {
    await persistResult(resultId, finalTranslation, reviewStatus);
    const [, summary] = await Promise.all([loadReviewBlocks(page), loadReviewSummary(), loadJobMeta(), loadTranslationProgress()]);
    return summary as ReviewSummary;
  }

  function focusReviewGuidance() {
    setIsEditing(false);
    setActiveFilter("all");
    setTimeout(() => {
      if (reviewGuidanceRef.current) {
        reviewGuidanceRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 0);
  }

  function transitionToReviewCompleteState(summary: ReviewSummary | null | undefined) {
    if (!summary?.review_complete) return false;
    focusReviewGuidance();
    setMessage("Review complete. Preview your document, then export when ready.");
    setError("");
    return true;
  }

  function renderInlineSegments(block: DocumentBlock, side: "source" | "target") {
    const handleClick = () => {
      const defaultSegmentId = block.segments[0]?.id;
      if (defaultSegmentId != null) {
        selectBlockById(block.id, defaultSegmentId);
      }
    };

    if (!block.segments.length) {
      const fallbackText = side === "source" ? (block.source_text_display || "") : (block.translated_text_display || "");
      return (
        <span onClick={handleClick} className="cursor-pointer whitespace-pre-wrap rounded-md transition-colors hover:bg-stone-100/60">
          {fallbackText}
        </span>
      );
    }

    return (
      <span onClick={handleClick} className="cursor-pointer rounded-md transition-colors hover:bg-stone-100/60">
        {block.segments.map((segment) => {
          const isResolvedAmbiguity = segment.ambiguity_detected && isAcceptableFinalStatus(segment.review_status);
          const isUnresolvedAmbiguity = segment.ambiguity_detected && !isAcceptableFinalStatus(segment.review_status);
          const shouldHighlight = isUnresolvedAmbiguity || isResolvedAmbiguity;
          const highlightClass = isUnresolvedAmbiguity
            ? "bg-amber-100 border-b-2 border-amber-400 rounded-sm px-0.5"
            : "bg-teal-100 border-b-2 border-teal-300 rounded-sm px-0.5";

          const text = side === "source" ? segment.source_text : (segment.final_translation || "");
          const ambiguityAnnotation = shouldHighlight
            ? segment.annotations.find((a) => a.annotation_type === "ambiguity")
            : undefined;

          if (!ambiguityAnnotation) {
            return <span key={segment.id}>{text}</span>;
          }

          const start = side === "source" ? ambiguityAnnotation.source_start : (ambiguityAnnotation.target_start ?? null);
          const end = side === "source" ? ambiguityAnnotation.source_end : (ambiguityAnnotation.target_end ?? null);
          const hasValidRange = start != null && end != null && end > start && start >= 0 && end <= text.length;

          if (hasValidRange) {
            return (
              <span key={segment.id}>
                {text.slice(0, start)}
                <span className={highlightClass}>{text.slice(start, end)}</span>
                {text.slice(end)}
              </span>
            );
          }

          // Fallback: search for the span text directly
          const spanText = (side === "source"
            ? ambiguityAnnotation.source_span_text
            : ambiguityAnnotation.target_span_text
          )?.trim() ?? "";
          const spanIdx = spanText ? text.indexOf(spanText) : -1;
          if (spanIdx !== -1) {
            return (
              <span key={segment.id}>
                {text.slice(0, spanIdx)}
                <span className={highlightClass}>{spanText}</span>
                {text.slice(spanIdx + spanText.length)}
              </span>
            );
          }

          return <span key={segment.id}>{text}</span>;
        })}
      </span>
    );
  }

  function renderNode(node: DocumentNode, side: "source" | "target") {
    if (node.type === "bullet_list") {
      return (
        <ul className="list-disc space-y-3 pl-6 marker:text-stone-400">
          {node.blocks.map((block) => {
            return (
              <li
                key={block.id}
                className="pl-1"
                ref={(el) => {
                  blockRefs.current[block.id] = el;
                }}
              >
                <p className="text-[15px] leading-7 whitespace-pre-wrap" style={{ color: "#1A110A" }}>
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
    if (block.block_type === "heading") {
      const H = getHeadingTag(block);
      return (
        <div
          ref={(el) => {
            blockRefs.current[block.id] = el;
          }}
          className="p-1"
        >
          <H className="text-xl font-semibold leading-8" style={{ color: "#1A110A" }}>{body}</H>
        </div>
      );
    }
    return (
      <div
        ref={(el) => {
          blockRefs.current[block.id] = el;
        }}
        className="p-1"
      >
        <p className="text-[15px] leading-7 whitespace-pre-wrap" style={{ color: "#1A110A" }}>{body}</p>
      </div>
    );
  }

  function getSelectedDecisionTranslation() {
    if (!selectedSegment) return "";
    const current = selectedSegment.final_translation || "";
    if (hasAmbiguityChoice && selectedAmbiguityTranslation.trim()) {
      const [translation] = applyAmbiguityChoiceToSegment(selectedSegment, selectedAmbiguityTranslation);
      return translation;
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
    setIsAmbiguityChoiceUserSelected(true);
    if (!selectedSegment) return;
    const option = ambiguityOptions[idx];
    if (!option) return;
    const [updatedTranslation, fallbackTriggered] = applyAmbiguityChoiceToSegment(selectedSegment, option.translation);
    if (fallbackTriggered) {
      setError("Could not apply this choice automatically — please edit the translation manually.");
      return;
    }
    setError("");
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
    const wasApproved = isAcceptableFinalStatus(selectedSegment.review_status);
    const nextBlockId = wasApproved ? null : getNextUnresolvedBlockIdFromCurrent();
    const finalTranslation = getSelectedDecisionTranslation();
    const reviewStatus = wasApproved ? "pending" : getSelectedDecisionStatus();
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      const summary = await saveResult(selectedSegment.id, finalTranslation, reviewStatus);
      setIsEditing(false);
      if (!wasApproved && transitionToReviewCompleteState(summary)) {
        return;
      }
      if (nextBlockId != null) {
        moveToBlockById(nextBlockId);
        setMessage("Saved and approved. Moved to next block.");
      } else {
        setMessage(wasApproved ? "Changes saved. Re-approve to confirm." : "Saved.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApproveCurrentBlock() {
    if (!selectedBlock || !selectedSegment) return;
    const nextBlockId = getNextUnresolvedBlockIdFromCurrent();
    const selectedDecisionTranslation = getSelectedDecisionTranslation();
    const selectedDecisionStatus = getSelectedDecisionStatus();

    // Pre-compute: next unresolved ambiguous segment in this block (not the current one)
    const nextUnresolvedAmbiguousInBlock = selectedBlock.segments.find(
      (seg) =>
        seg.id !== selectedSegment.id &&
        !isAcceptableFinalStatus(seg.review_status) &&
        seg.ambiguity_detected &&
        getAmbiguityChoiceDetails(seg).ambiguityChoiceFound
    ) ?? null;

    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      // Approve the selected segment + non-ambiguous unresolved segments only.
      // Never auto-approve other ambiguous segments — each one requires an explicit user decision.
      const toApprove = selectedBlock.segments.filter((segment) => {
        if (!isAcceptableFinalStatus(segment.review_status) && segment.final_translation.trim()) {
          if (segment.id === selectedSegment.id) return true;
          if (segment.ambiguity_detected && getAmbiguityChoiceDetails(segment).ambiguityChoiceFound) return false;
          return true;
        }
        return false;
      });
      for (const segment of toApprove) {
        if (segment.id === selectedSegment.id) {
          await persistResult(segment.id, selectedDecisionTranslation, selectedDecisionStatus);
        } else {
          await persistResult(segment.id, segment.final_translation, "approved");
        }
      }
      const [, summary] = await Promise.all([loadReviewBlocks(page), loadReviewSummary(), loadJobMeta(), loadTranslationProgress()]);
      if (transitionToReviewCompleteState(summary as ReviewSummary)) {
        return;
      }
      if (nextUnresolvedAmbiguousInBlock) {
        // Stay on the current block — navigate to the next ambiguous segment that needs a decision
        setSelectedId(nextUnresolvedAmbiguousInBlock.id);
        setMessage("Approved. Resolve the next ambiguous segment in this block.");
      } else {
        // All ambiguous segments in this block are resolved — advance to next unresolved block
        moveToBlockById(nextBlockId);
        setMessage(
          toApprove.length > 0
            ? `Block ${selectedBlock.block_index + 1} approved.`
            : "Block already reviewed. Moved to next block."
        );
      }
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

  function handlePageChange(newPage: number) {
    router.push(`/translation-jobs/${jobId}?page=${newPage}`);
  }

  function applyAmbiguityChoiceToSegment(segment: ReviewSegment, choiceTranslation: string): [string, boolean] {
    const selectedChoice = (choiceTranslation || "").trim();
    if (!selectedChoice) return [segment.final_translation || "", false];
    const currentText = segment.final_translation || "";
    if (!currentText.trim()) return [selectedChoice, false];
    const ambiguityAnnotation = segment.annotations.find((annotation) => annotation.annotation_type === "ambiguity");
    const hasTargetRange =
      ambiguityAnnotation?.target_start != null &&
      ambiguityAnnotation?.target_end != null &&
      ambiguityAnnotation.target_end > ambiguityAnnotation.target_start;
    if (hasTargetRange) {
      return [
        replaceByRange(
          currentText,
          ambiguityAnnotation.target_start as number,
          ambiguityAnnotation.target_end as number,
          selectedChoice
        ),
        false,
      ];
    }
    const rawAmbiguousTarget = (ambiguityAnnotation?.target_span_text || "").trim();
    const currentAmbiguousTarget = cleanChoiceTranslationText(ambiguityAnnotation?.target_span_text || "");
    if (rawAmbiguousTarget && currentText.includes(rawAmbiguousTarget)) {
      return [replaceFirstOccurrence(currentText, rawAmbiguousTarget, selectedChoice), false];
    }
    if (currentAmbiguousTarget && currentText.includes(currentAmbiguousTarget)) {
      return [replaceFirstOccurrence(currentText, currentAmbiguousTarget, selectedChoice), false];
    }
    // No reliable in-context span found: leave translation unchanged and signal failure.
    return [currentText, true];
  }

  function handleEditSelectedTranslation() {
    if (selectedSegment) {
      setDraftTranslation((selectedSegment.final_translation || "").replace(/\0/g, ""));
    }
    setIsEditing(true);
    setMessage("");
    setError("");
  }

  function handleToggleEdit() {
    if (!isEditing) {
      handleEditSelectedTranslation();
      return;
    }
    // Canceling: restore draft to original and exit edit mode
    setDraftTranslation(selectedSegment?.final_translation || "");
    setIsEditing(false);
    setMessage("");
  }

  async function handleRetryJob() {
    if (!job) return;
    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      const updated = await translationJobsApi.retry<TranslationJob>(job.id);
      setJob(updated);
      setMessage("Retry queued.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
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

  async function downloadAuthenticatedFile(downloadUrl: string, fallbackFilename: string) {
    const { useAuthStore } = await import("../../stores/authStore");
    const token = useAuthStore.getState().token;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(downloadUrl, { headers });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const filenameMatch = /filename[^;=\n]*=["']?([^"';\n]+)["']?/i.exec(disposition);
    const filename = filenameMatch?.[1]?.trim() || fallbackFilename;
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }

  function handleDownloadLatestExport() {
    if (!latestExport?.download_url) return;
    const url = `${API_URL}${latestExport.download_url}`;
    const filename = latestExport.filename ?? "export";
    void downloadAuthenticatedFile(url, filename).catch((err) =>
      setError(err instanceof Error ? err.message : "Download failed")
    );
  }

  function handlePrimaryGuidanceAction() {
    if (guidanceStatusLabel === "Exported") {
      handleOpenExportModal();
      return;
    }
    if (guidanceStatusLabel === "Review Complete") {
      void handleOpenPreviewDocument();
      return;
    }
    const recommendedBlockId = getRecommendedReviewBlockId();
    if (recommendedBlockId != null) {
      moveToBlockById(recommendedBlockId);
      return;
    }
    focusDocumentReviewStart();
  }

  async function handleOpenPreviewDocument() {
    if (!job) return;
    setShowPreviewModal(true);
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const preview = await translationJobsApi.getPreview<PreviewPayload>(job.id);
      setPreviewDocumentName(preview.document_name || doc?.filename || "");
      setPreviewContentDisplay(preview.content_display || "");
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Failed to load preview");
      setPreviewContentDisplay("");
    } finally {
      setPreviewLoading(false);
    }
  }

  function triggerExportDownload(payload: ExportResult) {
    if (!payload.download_url) return;
    const url = `${API_URL}${payload.download_url}`;
    const filename = payload.filename ?? "export";
    void downloadAuthenticatedFile(url, filename).catch((err) =>
      setError(err instanceof Error ? err.message : "Download failed")
    );
  }

  async function handleExportFinalDocument(selectedMode: ExportMode, selectedFormat: ExportFormat) {
    if (!job) return;
    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      const exportPayload = await translationJobsApi.export<ExportResult>(job.id, selectedFormat, selectedMode);
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
      await translationJobsApi.markReady<unknown>(job.id);
      const payload = await translationJobsApi.export<ExportResult>(job.id, selectedFormat, selectedMode);
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

  if (loading) return <div className="min-h-screen p-6" style={{ backgroundColor: "#F5F2EC" }}>Loading…</div>;
  if (error && !job) return <div className="min-h-screen p-6 text-red-600" style={{ backgroundColor: "#F5F2EC" }}>{error}</div>;
  if (!job) return <div className="min-h-screen p-6 text-red-600" style={{ backgroundColor: "#F5F2EC" }}>Job not found</div>;

  const glossaryMatches = selectedSegment?.glossary_matches?.matches ?? [];
  const reviewComplete = Boolean(reviewSummary?.review_complete);
  const workflowStatus = reviewSummary?.overall_status ?? job.status;
  const isReadOnly = workflowStatus === "exported";
  const selectedSegmentIsSafe = Boolean(selectedSegment && isSafeSegment(selectedSegment));
  const canEditSelectedSegment = !isReadOnly;
  const hasDraftChanges =
    (draftTranslation || "").trim() !== (selectedSegment?.final_translation || "").trim();
  const ambiguityChoiceDetails = getAmbiguityChoiceDetails(selectedSegment);
  const hasAmbiguityChoice = ambiguityChoiceDetails.ambiguityChoiceFound && !isAcceptableFinalStatus(selectedSegment?.review_status ?? "");
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
    ? []
    : selectedBlock.segments.filter(
        (segment) => !isAcceptableFinalStatus(segment.review_status) && getAmbiguityChoiceDetails(segment).ambiguityChoiceFound
      );
  const activeBlockAmbiguityIndex = blockAmbiguityIssues.findIndex((segment) => segment.id === selectedSegment?.id);
  const activeBlockAmbiguityPosition = activeBlockAmbiguityIndex === -1 ? 1 : activeBlockAmbiguityIndex + 1;
  const semanticChoiceDetails = getSemanticChoiceDetails(selectedSegment);
  const hasSemanticChoice = semanticChoiceDetails.semanticMatchFound;
  const semanticSuggestionText = semanticChoiceDetails.suggestedTranslation;
  const semanticSimilarityScore = semanticChoiceDetails.similarityScore;
  const isSafeDecisionOnlyMode = selectedSegmentIsSafe;
  const currentBlockResolved = Boolean(selectedBlock && isBlockResolved(selectedBlock));
  const resolvedAmbiguity = Boolean(selectedSegment?.ambiguity_detected && isAcceptableFinalStatus(selectedSegment?.review_status ?? ""));
  const isLastBlock = selectedBlockPosition !== -1 && selectedBlockPosition === orderedBlocks.length - 1;
  const primaryActionDisabled = actionLoading || (hasAmbiguityChoice && !selectedAmbiguityTranslation.trim()) || currentBlockResolved;
  const guidanceStatusLabel = workflowStatus === "exported" ? "Exported" : reviewComplete ? "Review Complete" : "In Review";
  const latestExport = exportHistory.find((entry) => entry.latest) ?? exportHistory[0] ?? null;
  const lastExportTimestamp = latestExport?.generated_at ?? exportResult?.generated_at ?? null;
  const lastExportMode = latestExport?.export_mode ?? exportResult?.export_mode ?? null;
  const lastExportFormat = latestExport?.export_format ?? exportResult?.export_format ?? "txt";
  const filterChips: { key: ReviewFilter; label: string; count: number }[] = [
    { key: "all", label: "All Blocks", count: reviewCounts.total_blocks },
    { key: "ambiguities", label: "Ambiguities", count: reviewCounts.ambiguity_count },
    { key: "glossary", label: "Glossary", count: reviewCounts.glossary_count },
    { key: "memory", label: "Memory", count: reviewCounts.memory_count },
  ];
  const selectedBlockExactMemory = selectedBlock?.segments.some((s) => s.exact_memory_used) ?? false;
  const selectedBlockSemanticMemory = !selectedBlockExactMemory && (selectedBlock?.segments.some((s) => s.semantic_memory_used) ?? false);
  const selectedBlockMemorySimilarity: number | null = (() => {
    if (!selectedBlockSemanticMemory || !selectedBlock) return null;
    let best: number | null = null;
    for (const s of selectedBlock.segments) {
      const score = s.semantic_memory_details?.similarity_score ?? null;
      if (score !== null && (best === null || score > best)) best = score;
    }
    return best;
  })();
  const selectedBlockMemorySourceText: string | null = selectedBlockSemanticMemory
    ? (selectedBlock?.segments.find(
        (s) => s.semantic_memory_used && s.semantic_memory_details?.source_text
      )?.semantic_memory_details?.source_text ?? null)
    : null;

  const firstUnresolvedAmbiguityBlockId = getFirstUnresolvedAmbiguityBlockId();
  const nextUnresolvedBlockId = getNextUnresolvedBlockId();
  const recommendedNextStep =
    guidanceStatusLabel === "Exported"
      ? "Download the latest exported file."
      : guidanceStatusLabel === "Review Complete"
        ? "Review complete. Preview your document, then export."
        : firstUnresolvedAmbiguityBlockId != null
          ? `Resolve ambiguity in Block ${((orderedBlocks.find((b) => b.id === firstUnresolvedAmbiguityBlockId)?.block_index ?? 0) + 1).toString()} next.`
          : nextUnresolvedBlockId != null
            ? `Continue with Block ${((orderedBlocks.find((b) => b.id === nextUnresolvedBlockId)?.block_index ?? 0) + 1).toString()}.`
            : "Review complete — ready to export.";
  const hasReviewProgress = reviewCounts.completed_blocks > 0;
  const primaryGuidanceLabel =
    guidanceStatusLabel === "Exported"
      ? "Export document"
      : guidanceStatusLabel === "Review Complete"
        ? "Preview Document"
        : hasReviewProgress
          ? "Continue reviewing"
          : "Start reviewing";
  const secondaryGuidanceLabel =
    guidanceStatusLabel === "Exported" ? "Preview document"
    : guidanceStatusLabel === "Review Complete" ? "Export document"
    : undefined;
  const isPrimaryGuidanceDisabled = false;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5F2EC" }}>
      <main className="mx-auto max-w-7xl px-6 py-12">
        <Link
          href={`/documents/${job.document_id}`}
          className="mb-6 inline-block text-sm text-stone-400 hover:text-stone-900"
        >
          ← Back to document
        </Link>

        <div className="mb-6">
          <h1
            className="text-2xl font-semibold"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1A110A" }}
          >
            Translation Review
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {doc?.filename ?? `#${job.document_id}`} • {getLanguageDisplayName(job.source_language)} →{" "}
            {getLanguageDisplayName(job.target_language)}
          </p>
          <p className="mt-2 text-sm text-stone-500">Follow the workflow below to review and export.</p>
          {job.error_message && <p className="mt-1 text-sm text-red-600">{job.error_message}</p>}
        </div>

        <ReviewGuidancePanel
          reviewGuidanceRef={reviewGuidanceRef}
          statusLabel={guidanceStatusLabel}
          completedBlocks={reviewCounts.completed_blocks}
          totalBlocks={reviewCounts.total_blocks}
          unresolvedBlocks={reviewCounts.remaining_blocks}
          unresolvedAmbiguities={reviewCounts.ambiguity_count}
          recommendedNextStep={recommendedNextStep}
          translationStyle={job.translation_style === "literal" ? "literal" : "natural"}
          primaryActionLabel={primaryGuidanceLabel}
          isPrimaryActionDisabled={isPrimaryGuidanceDisabled}
          actionLoading={actionLoading}
          onPrimaryAction={handlePrimaryGuidanceAction}
          secondaryActionLabel={secondaryGuidanceLabel}
          onSecondaryAction={guidanceStatusLabel === "Exported" ? handleOpenPreviewDocument : secondaryGuidanceLabel ? handleOpenExportModal : undefined}
          message={message || undefined}
          error={error || undefined}
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <DocumentDiffPane
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            filterChips={filterChips}
            displayedNodes={displayedNodes}
            displayedBlocksCount={visibleBlocks.length}
            totalBlocksCount={reviewCounts.total_blocks}
            selectedSegmentId={selectedSegment?.id ?? null}
            segmentColorStates={segmentColorStates}
            renderNode={(node, side) => renderNode(node as DocumentNode, side)}
            segmentRefs={segmentRefs}
            blockMemoryStates={blockMemoryStates}
          />

          <ReviewDetailsPane
            selectedSegment={selectedSegment}
            selectedBlock={selectedBlock}
            reviewComplete={reviewComplete}
            onFocusReviewGuidance={focusReviewGuidance}
            orderedBlocksLength={reviewCounts.total_blocks}
            completedBlocks={reviewCounts.completed_blocks}
            selectedBlockPosition={selectedBlockPosition}
            onPreviousBlock={handlePreviousBlock}
            onNextBlock={handleNextBlock}
            isLastBlock={isLastBlock}
            unresolvedBlocks={reviewCounts.remaining_blocks}
            selectedSegmentIsSafe={selectedSegmentIsSafe}
            isSafeDecisionOnlyMode={isSafeDecisionOnlyMode}
            cleanPanelText={cleanPanelText}
            hasAmbiguityChoice={hasAmbiguityChoice}
            ambiguityExplanation={ambiguityChoiceDetails.explanation}
            blockAmbiguityIssuesLength={blockAmbiguityIssues.length}
            activeBlockAmbiguityPosition={activeBlockAmbiguityPosition}
            ambiguityChoiceIndex={ambiguityChoiceIndex}
            isAmbiguityChoiceUserSelected={isAmbiguityChoiceUserSelected}
            ambiguityOptions={ambiguityOptions}
            currentSuggestionIndex={currentSuggestionIndex}
            onAmbiguityChoiceChange={handleAmbiguityChoiceChange}
            onClearAmbiguityChoice={() => {
              setPrevAmbiguityChoiceIndex(ambiguityChoiceIndex);
              setAmbiguityChoiceIndex(null);
              setIsAmbiguityChoiceUserSelected(false);
            }}
            previousAmbiguityChoiceIndex={prevAmbiguityChoiceIndex}
            isReadOnly={isReadOnly}
            isEditing={isEditing}
            canEditSelectedSegment={canEditSelectedSegment}
            draftTranslation={draftTranslation}
            onDraftTranslationChange={setDraftTranslation}
            glossaryMatches={glossaryMatches}
            hasSemanticChoice={hasSemanticChoice}
            semanticSimilarityScore={semanticSimilarityScore}
            semanticChoice={semanticChoice}
            onSemanticChoiceChange={handleSemanticChoiceChange}
            currentBlockResolved={currentBlockResolved}
            resolvedAmbiguity={resolvedAmbiguity}
            onGoToNextUnresolved={() => {
              const nextId = getNextUnresolvedBlockIdFromCurrent() ?? getNextUnresolvedBlockId();
              if (nextId != null) moveToBlockById(nextId);
            }}
            onApproveCurrentBlock={handleApproveCurrentBlock}
            primaryActionDisabled={primaryActionDisabled}
            onToggleEdit={handleToggleEdit}
            actionLoading={actionLoading}
            onSkipBlock={handleSkipBlock}
            hasDraftChanges={hasDraftChanges}
            onSaveSegmentEdit={handleSaveSegmentEdit}
            exactMemoryUsed={selectedBlockExactMemory}
            semanticMemoryUsed={selectedBlockSemanticMemory}
            memorySimilarityScore={selectedBlockMemorySimilarity}
            memorySourceText={selectedBlockMemorySourceText}
          />
        </div>
        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between border-t border-stone-200 pt-6">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Previous
            </button>
            <div className="text-center">
              <p className="text-sm text-stone-600">
                Page {page} of {totalPages}
              </p>
              <p className="text-xs text-stone-400">{totalBlocks} blocks total</p>
            </div>
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}

        {/* More blocks translating indicator — shown when on the last available page and job is still running */}
        {page >= totalPages && ["translation_queued", "translating"].includes(job.status) && (
          <p className="mt-4 text-center text-xs text-stone-500">
            More blocks translating… page count will update as they complete.
          </p>
        )}

        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/45 px-4">
            <div className="w-full max-w-lg border border-stone-200 bg-white p-6">
              <h3 className="text-lg font-semibold" style={{ color: "#1A110A" }}>Export settings</h3>
              <p className="mt-1 text-sm text-stone-600">
                Choose export options for this download.
              </p>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Export format</p>
                  <label className="mt-2 block border border-stone-200 bg-white px-3 py-3">
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
                        <p className="text-sm font-medium" style={{ color: "#1A110A" }}>DOCX</p>
                        <p className="mt-1 text-xs text-stone-600">Best for sharing editable documents.</p>
                      </div>
                    </div>
                  </label>
                  <label className="mt-2 block border border-stone-200 bg-white px-3 py-3">
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
                        <p className="text-sm font-medium" style={{ color: "#1A110A" }}>RTF</p>
                        <p className="mt-1 text-xs text-stone-600">Rich text output compatible with many editors.</p>
                      </div>
                    </div>
                  </label>
                  <label className="mt-2 block border border-stone-200 bg-white px-3 py-3">
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
                        <p className="text-sm font-medium" style={{ color: "#1A110A" }}>TXT</p>
                        <p className="mt-1 text-xs text-stone-600">Plain text export for simple delivery.</p>
                      </div>
                    </div>
                  </label>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Formatting</p>
                </div>
                <label className="block cursor-pointer border border-stone-200 bg-white px-3 py-3">
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
                      <p className="text-sm font-medium" style={{ color: "#1A110A" }}>Preserve original formatting</p>
                      <p className="mt-1 text-xs text-stone-600">
                        Preserve original formatting: keeps headings, spacing, and structure where possible.
                      </p>
                    </div>
                  </div>
                </label>
                <label className="block cursor-pointer border border-stone-200 bg-white px-3 py-3">
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
                      <p className="text-sm font-medium" style={{ color: "#1A110A" }}>Clean text only</p>
                      <p className="mt-1 text-xs text-stone-600">
                        Clean text only: removes formatting and exports plain reviewed text.
                      </p>
                    </div>
                  </div>
                </label>
                {lastExportTimestamp && (
                  <p className="border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
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
                  className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExportDocumentWorkflow}
                  disabled={actionLoading}
                  className="rounded-full px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: "#0D7B6E" }}
                >
                  Export document
                </button>
              </div>
            </div>
          </div>
        )}
        {showPreviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/45 px-4">
            <div className="w-full max-w-4xl border border-stone-200 bg-white">
              <div className="flex items-center justify-between gap-4 border-b border-stone-200 px-6 py-4">
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: "#1A110A" }}>Preview</h3>
                  <p className="mt-0.5 text-xs text-stone-500">{previewDocumentName || doc?.filename || "Document"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { void navigator.clipboard.writeText(previewContentDisplay); }}
                    disabled={previewLoading || Boolean(previewError) || !previewContentDisplay}
                    className="rounded-full border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40"
                  >
                    Copy to clipboard
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(false)}
                    className="rounded-full border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="max-h-[72vh] overflow-y-auto px-6 py-5">
                {previewLoading ? (
                  <p className="text-sm text-stone-600">Loading preview…</p>
                ) : previewError ? (
                  <p className="text-sm text-red-600">{previewError}</p>
                ) : (
                  <article className="whitespace-pre-wrap text-[15px] leading-7" style={{ color: "#1A110A" }}>{previewContentDisplay}</article>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function TranslationReviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-6" style={{ backgroundColor: "#F5F2EC" }}>Loading…</div>}>
      <TranslationReviewPageInner />
    </Suspense>
  );
}
