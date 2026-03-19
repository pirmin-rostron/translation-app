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

type ReviewFilter = "all" | "issues" | "ambiguities" | "glossary" | "memory";

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
  const visibleBlocks = useMemo(
    () => filteredBlocks.filter((block) => hasMeaningfulCleanBlockContent(block)),
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
  const flagged = useMemo(() => allSegments.filter(({ segment }) => isFlagged(segment)), [allSegments]);
  const flaggedSegmentIds = useMemo(() => new Set(flagged.map(({ segment }) => segment.id)), [flagged]);
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
    if (!orderedBlocks.length) return;
    if (selectedBlockPosition !== -1) return;
    const firstBlock = orderedBlocks.find((block) => !isBlockResolved(block)) ?? orderedBlocks[0];
    setSelectedId(firstBlock.segments[0]?.id ?? null);
    blockRefs.current[firstBlock.id]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [orderedBlocks, selectedBlockPosition]);

  function selectBlockById(blockId: number, preferredSegmentId?: number) {
    const block = orderedBlocks.find((candidate) => candidate.id === blockId);
    if (!block || !block.segments.length) return;
    const ambiguityChoiceSegment = block.segments.find((segment) => getAmbiguityChoiceDetails(segment).ambiguityChoiceFound);
    const semanticChoiceSegment = block.segments.find((segment) => getSemanticChoiceDetails(segment).semanticMatchFound);
    const fallbackSegmentId = preferredSegmentId ?? ambiguityChoiceSegment?.id ?? semanticChoiceSegment?.id ?? block.segments[0].id;
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

  function focusDocumentReviewStart() {
    setActiveFilter("all");
    const firstBlockId = getFirstBlockForDocumentReview();
    if (firstBlockId != null) {
      const firstBlock = orderedBlocks.find((block) => block.id === firstBlockId);
      setSelectedId(firstBlock?.segments[0]?.id ?? null);
      blockRefs.current[firstBlockId]?.scrollIntoView({ block: "center", behavior: "smooth" });
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
    setSelectedId(null);
    setIsEditing(false);
    setActiveFilter("all");
    reviewGuidanceRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function transitionToReviewCompleteState(summary: ReviewSummary | null | undefined) {
    if (!summary?.review_complete) return false;
    focusReviewGuidance();
    setMessage("Review complete. Preview your document, then export when ready.");
    setError("");
    return true;
  }

  function renderInlineSegments(block: DocumentBlock, side: "source" | "target") {
    const sourceDisplay = block.source_text_display || "";
    const translatedDisplay = block.translated_text_display || "";
    const modeText = side === "source" ? sourceDisplay : translatedDisplay;
    return (
      <span
        onClick={() => {
          const defaultSegmentId = block.segments[0]?.id;
          if (defaultSegmentId != null) {
            selectBlockById(block.id, defaultSegmentId);
          }
        }}
        className="cursor-pointer rounded-md transition-colors hover:bg-slate-100/60"
      >
        {modeText}
      </span>
    );
  }

  function renderNode(node: DocumentNode, side: "source" | "target") {
    if (node.type === "bullet_list") {
      return (
        <ul className="list-disc space-y-3 pl-6 marker:text-slate-400">
          {node.blocks.map((block) => {
            return (
              <li
                key={block.id}
                className="pl-1"
                ref={(el) => {
                  blockRefs.current[block.id] = el;
                }}
              >
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
    if (block.block_type === "heading") {
      const H = getHeadingTag(block);
      return (
        <div
          ref={(el) => {
            blockRefs.current[block.id] = el;
          }}
          className="p-1"
        >
          <H className="text-xl font-semibold leading-8 text-slate-900">{body}</H>
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
    const nextBlockId = getNextUnresolvedBlockIdFromCurrent();
    const finalTranslation = getSelectedDecisionTranslation();
    const reviewStatus = getSelectedDecisionStatus();
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      const summary = await saveResult(selectedSegment.id, finalTranslation, reviewStatus);
      setIsEditing(false);
      if (transitionToReviewCompleteState(summary)) {
        return;
      }
      moveToBlockById(nextBlockId);
      setMessage("Saved and approved. Moved to next block.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
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
      const payload = await fetch(`${API_URL}/api/translation-jobs/${job.id}/preview`).then(async (res) => {
        if (!res.ok) throw new Error("Failed to load preview");
        return res.json();
      });
      const preview = payload as PreviewPayload;
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
  const reviewComplete = Boolean(reviewSummary?.review_complete);
  const workflowStatus = reviewSummary?.overall_status ?? job.status;
  const isReadOnly = workflowStatus === "exported";
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
  const isLastBlock = selectedBlockPosition !== -1 && selectedBlockPosition === orderedBlocks.length - 1;
  const primaryActionDisabled = actionLoading || (hasAmbiguityChoice && !selectedAmbiguityTranslation.trim()) || currentBlockResolved;
  const guidanceStatusLabel = workflowStatus === "exported" ? "Exported" : reviewComplete ? "Review Complete" : "In Review";
  const latestExport = exportHistory.find((entry) => entry.latest) ?? exportHistory[0] ?? null;
  const lastExportTimestamp = latestExport?.generated_at ?? exportResult?.generated_at ?? null;
  const lastExportMode = latestExport?.export_mode ?? exportResult?.export_mode ?? null;
  const lastExportFormat = latestExport?.export_format ?? exportResult?.export_format ?? "txt";
  const filterChips: { key: ReviewFilter; label: string; count: number }[] = [
    { key: "all", label: "All Blocks", count: reviewCounts.total_blocks },
    { key: "issues", label: "Issues", count: reviewCounts.issues_count },
    { key: "ambiguities", label: "Ambiguities", count: reviewCounts.ambiguity_count },
    { key: "glossary", label: "Glossary", count: reviewCounts.glossary_count },
    { key: "memory", label: "Memory", count: reviewCounts.memory_count },
  ];
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
      ? "Download Latest Export"
      : guidanceStatusLabel === "Review Complete"
        ? "Preview Document"
        : hasReviewProgress
          ? "Continue reviewing"
          : "Start reviewing";
  const secondaryGuidanceLabel = guidanceStatusLabel === "Review Complete" ? "Export document" : undefined;
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
          onSecondaryAction={secondaryGuidanceLabel ? handleOpenExportModal : undefined}
        />

        {message && <p className="mb-4 text-sm text-green-600">{message}</p>}
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <DocumentDiffPane
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            filterChips={filterChips}
            displayedNodes={displayedNodes}
            displayedBlocksCount={visibleBlocks.length}
            totalBlocksCount={reviewCounts.total_blocks}
            selectedSegmentId={selectedSegment?.id ?? null}
            flaggedSegmentIds={flaggedSegmentIds}
            renderNode={(node, side) => renderNode(node as DocumentNode, side)}
            segmentRefs={segmentRefs}
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
            ambiguityOptions={ambiguityOptions}
            currentSuggestionIndex={currentSuggestionIndex}
            onAmbiguityChoiceChange={handleAmbiguityChoiceChange}
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
            onApproveCurrentBlock={handleApproveCurrentBlock}
            primaryActionDisabled={primaryActionDisabled}
            onToggleEdit={handleToggleEdit}
            actionLoading={actionLoading}
            onSkipBlock={handleSkipBlock}
            hasDraftChanges={hasDraftChanges}
            onSaveSegmentEdit={handleSaveSegmentEdit}
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
        {showPreviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
            <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Preview</h3>
                  <p className="mt-0.5 text-xs text-slate-500">{previewDocumentName || doc?.filename || "Document"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(false)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="max-h-[72vh] overflow-y-auto px-6 py-5">
                {previewLoading ? (
                  <p className="text-sm text-slate-600">Loading preview…</p>
                ) : previewError ? (
                  <p className="text-sm text-red-600">{previewError}</p>
                ) : (
                  <article className="whitespace-pre-wrap text-[15px] leading-7 text-slate-900">{previewContentDisplay}</article>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
