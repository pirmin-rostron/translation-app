"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  documentsApi,
  glossaryTermsApi,
  queryKeys,
  translationJobsApi,
  translationResultsApi,
  usageApi,
  tierApi,
  projectsApi,
  orgStatsApi,
  dashboardApi,
} from "../services/api";
import type {
  TranslationJobListItem,
  UsageResponse,
  TierResponse,
  ProjectResponse,
  OrgStatsResponse,
  UpcomingItem,
} from "../services/api";

// ---------------------------------------------------------------------------
// Shared response types
// ---------------------------------------------------------------------------

export type Document = {
  id: number;
  filename: string;
  file_type: string;
  source_language: string | null;
  target_language: string;
  industry: string | null;
  domain: string | null;
  status: string;
  error_message?: string | null;
  created_at: string;
};

export type TranslationJob = {
  id: number;
  document_id: number;
  status: string;
  translation_style: string | null;
  source_language: string | null;
  target_language: string;
  translation_provider: string | null;
  error_message?: string | null;
  progress_total_segments: number | null;
  progress_completed_segments: number;
  created_at: string;
  last_saved_at: string | null;
};

export type TranslationJobProgress = {
  job_id: number;
  stage_label: string;
  total_segments: number;
  completed_segments: number;
  percentage: number;
  eta_seconds: number | null;
  is_complete: boolean;
};

export type ReviewSegment = {
  id: number;
  segment_id: number;
  block_id: number | null;
  segment_index: number;
  segment_type: string;
  source_text: string;
  primary_translation: string | null;
  final_translation: string | null;
  confidence_score: number | null;
  review_status: string;
  exact_memory_used: boolean;
  semantic_memory_used: boolean;
  semantic_match_found: boolean;
  suggested_translation: string | null;
  similarity_score: number | null;
  current_translation: string | null;
  ambiguity_detected: boolean;
  ambiguity_choice_found: boolean;
  ambiguity_source_phrase: string | null;
  ambiguity_options: { meaning: string; translation: string }[];
  ambiguity_details: Record<string, unknown> | null;
  glossary_applied: boolean;
  glossary_matches: { matches: { source_term: string; target_term: string }[] } | null;
  annotations: unknown[];
};

export type ReviewBlock = {
  id: number;
  document_id: number;
  block_index: number;
  block_type: string;
  source_text_raw: string | null;
  source_text_display: string | null;
  translated_text_raw: string | null;
  translated_text_display: string | null;
  text_original: string | null;
  text_translated: string | null;
  formatting_json: Record<string, unknown> | null;
  source_edited: boolean;
  segments: ReviewSegment[];
};

export type ReviewSummary = {
  job_id: number;
  total_segments: number;
  approved_segments: number;
  edited_segments: number;
  unresolved_count: number;
  unresolved_segments: number;
  unresolved_ambiguities: number;
  ambiguity_count: number;
  unresolved_semantic_reviews: number;
  semantic_memory_review_count: number;
  safe_unresolved_segments: number;
  review_complete: boolean;
  can_mark_ready_for_export: boolean;
  overall_status: string;
  last_saved_at: string | null;
};

export type GlossaryTerm = {
  id: number;
  source_term: string;
  target_term: string;
  source_language: string;
  target_language: string;
  industry: string | null;
  domain: string | null;
  created_at: string;
};

export type TranslationResult = {
  id: number;
  job_id: number;
  segment_id: number;
  primary_translation: string | null;
  final_translation: string | null;
  confidence_score: number | null;
  review_status: string;
  exact_memory_used: boolean;
  semantic_memory_used: boolean;
  ambiguity_detected: boolean;
  ambiguity_details: Record<string, unknown> | null;
  glossary_applied: boolean;
  created_at: string;
};

export type ExportResponse = {
  job_id: number;
  status: string;
  export_format: string;
  export_mode: string;
  filename: string;
  download_url: string;
  generated_at: string;
  version: number;
};

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useDocuments() {
  return useQuery({
    queryKey: queryKeys.documents.all(),
    queryFn: () => documentsApi.list<Document[]>(),
    staleTime: 30_000,
  });
}

export function useDocument(id: number | undefined) {
  return useQuery({
    queryKey: queryKeys.documents.detail(id ?? 0),
    queryFn: () => documentsApi.getById<Document>(id!),
    enabled: id != null,
    staleTime: 10_000,
  });
}

export function useDocumentTranslationJobs(documentId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.translationJobs.byDocument(documentId ?? 0),
    queryFn: () => documentsApi.getTranslationJobs<TranslationJob[]>(documentId!),
    enabled: documentId != null,
    staleTime: 10_000,
  });
}

export function useTranslationJob(id: number | undefined) {
  return useQuery({
    queryKey: queryKeys.translationJobs.detail(id ?? 0),
    queryFn: () => translationJobsApi.getById<TranslationJob>(id!),
    enabled: id != null,
    staleTime: 10_000,
  });
}

export function useTranslationJobProgress(
  id: number | undefined,
  options?: { refetchInterval?: number | false }
) {
  return useQuery({
    queryKey: queryKeys.translationJobs.progress(id ?? 0),
    queryFn: () => translationJobsApi.getProgress<TranslationJobProgress>(id!),
    enabled: id != null,
    staleTime: 2_000,
    ...options,
  });
}

export function useReviewBlocks(jobId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.translationJobs.reviewBlocks(jobId ?? 0),
    queryFn: () => translationJobsApi.getReviewBlocks<ReviewBlock[]>(jobId!),
    enabled: jobId != null,
    staleTime: 30_000,
  });
}

export function useReviewSummary(jobId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.translationJobs.reviewSummary(jobId ?? 0),
    queryFn: () => translationJobsApi.getReviewSummary<ReviewSummary>(jobId!),
    enabled: jobId != null,
    staleTime: 10_000,
  });
}

// --- Dashboard ---

export type DashboardTranslation = {
  id: number;
  document_id: number;
  document_name: string | null;
  project_id: number | null;
  project_name: string | null;
  source_language: string;
  target_language: string;
  status: string;
  raw_status: string;
  created_at: string;
  due_date: string | null;
  quality_score: number | null;
};

const PROCESSING_STATUSES = new Set([
  "queued",
  "parsing",
  "translating",
  "translation_queued",
]);

function mapJobStatusLabel(status: string): string {
  if (PROCESSING_STATUSES.has(status)) return "Translating…";
  if (status === "in_review" || status === "review") return "In Review";
  if (status === "completed" || status === "exported") return "Completed";
  if (status === "ready_for_export") return "Ready for Export";
  if (status === "translation_failed") return "Failed";
  return "Pending";
}

const LANG_CODE_MAP: Record<string, string> = {
  english: "EN", german: "DE", french: "FR", dutch: "NL", spanish: "ES",
  japanese: "JA", korean: "KO", thai: "TH", chinese: "ZH", italian: "IT",
  portuguese: "PT", arabic: "AR", en: "EN", de: "DE", fr: "FR", nl: "NL",
  es: "ES", ja: "JA", ko: "KO", th: "TH", zh: "ZH", it: "IT", pt: "PT", ar: "AR",
};

function toLangCode(lang: string | null | undefined): string {
  if (!lang) return "??";
  const code = LANG_CODE_MAP[lang.toLowerCase()];
  if (code) return code;
  return lang.length <= 3 ? lang.toUpperCase() : lang.substring(0, 2).toUpperCase();
}

function mapJobToTranslation(j: TranslationJobListItem): DashboardTranslation {
  const src = toLangCode(j.source_language);
  const tgt = toLangCode(j.target_language);
  return {
    id: j.id,
    document_id: j.document_id,
    document_name: j.document_name,
    project_id: j.project_id ?? null,
    project_name: j.project_name ?? null,
    source_language: src,
    target_language: tgt,
    status: mapJobStatusLabel(j.status),
    raw_status: j.status,
    created_at: j.created_at,
    due_date: j.due_date ?? null,
    quality_score: j.quality_score ?? null,
  };
}

export function useDashboardTranslations(hasProcessingJobs = false) {
  return useQuery<DashboardTranslation[]>({
    queryKey: queryKeys.translationJobs.recent(),
    queryFn: async () => {
      const jobs = await translationJobsApi.listRecent(10);
      if (jobs.length === 0) return [];
      return jobs.map(mapJobToTranslation);
    },
    staleTime: hasProcessingJobs ? 2_000 : 30_000,
    refetchInterval: hasProcessingJobs ? 3_000 : false,
  });
}

export function useUsage() {
  return useQuery<UsageResponse>({
    queryKey: ["usage"],
    queryFn: () => usageApi.get(),
    staleTime: 30_000,
  });
}

export function useTier() {
  return useQuery<TierResponse>({
    queryKey: ["tier"],
    queryFn: () => tierApi.get(),
    staleTime: 60_000,
  });
}

export function useProjects() {
  return useQuery<ProjectResponse[]>({
    queryKey: ["projects"],
    queryFn: () => projectsApi.list(),
    staleTime: 30_000,
  });
}

export function useOrgStats() {
  return useQuery<OrgStatsResponse>({
    queryKey: ["org-stats"],
    queryFn: () => orgStatsApi.get(),
    staleTime: 60_000,
  });
}

export function useUpcomingDeadlines() {
  return useQuery<UpcomingItem[]>({
    queryKey: ["dashboard", "upcoming"],
    queryFn: () => dashboardApi.upcoming(),
    staleTime: 60_000,
  });
}

export function useGlossaryTerms() {
  return useQuery({
    queryKey: queryKeys.glossaryTerms.all(),
    queryFn: () => glossaryTermsApi.list<GlossaryTerm[]>(),
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useUpdateTranslationResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      resultId,
      finalTranslation,
      reviewStatus,
    }: {
      resultId: number;
      jobId: number;
      finalTranslation: string;
      reviewStatus: string;
    }) => translationResultsApi.update<TranslationResult>(resultId, finalTranslation, reviewStatus),
    onSuccess: (_, { jobId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.translationJobs.reviewBlocks(jobId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.translationJobs.reviewSummary(jobId) });
    },
  });
}

export function useApproveSegments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId }: { jobId: number }) =>
      translationJobsApi.approveSafeSegments<ReviewSummary>(jobId),
    onSuccess: (_, { jobId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.translationJobs.reviewBlocks(jobId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.translationJobs.reviewSummary(jobId) });
    },
  });
}

export function useMarkReadyForExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId }: { jobId: number }) =>
      translationJobsApi.markReady<ReviewSummary>(jobId),
    onSuccess: (_, { jobId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.translationJobs.detail(jobId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.translationJobs.reviewSummary(jobId) });
    },
  });
}

export function useSaveDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId }: { jobId: number }) =>
      translationJobsApi.saveDraft<ReviewSummary>(jobId),
    onSuccess: (_, { jobId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.translationJobs.detail(jobId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.translationJobs.reviewSummary(jobId) });
    },
  });
}

export function useExportJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      jobId,
      fileType,
      formattingMode,
    }: {
      jobId: number;
      fileType: string;
      formattingMode: string;
    }) => translationJobsApi.export<ExportResponse>(jobId, fileType, formattingMode),
    onSuccess: (_, { jobId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.translationJobs.detail(jobId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.translationJobs.exports(jobId) });
    },
  });
}
