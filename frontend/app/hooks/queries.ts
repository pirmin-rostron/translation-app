"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  documentsApi,
  glossaryTermsApi,
  queryKeys,
  translationJobsApi,
  translationResultsApi,
  usageApi,
} from "../services/api";
import type {
  TranslationJobListItem,
  UsageResponse,
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
  document_name: string | null;
  project_id: number | null;
  project_name: string | null;
  source_language: string;
  target_language: string;
  progress: number;
  status: string;
  updated_at: string;
};

const SAMPLE_TRANSLATIONS: DashboardTranslation[] = [
  { id: 1, document_name: "HR_Policy_2024.docx",      project_id: 1, project_name: "Legal Docs", source_language: "EN", target_language: "DE", progress: 78, status: "In Review",   updated_at: "2026-03-25T10:00:00Z" },
  { id: 2, document_name: "Compliance_Manual_v3.pdf",  project_id: 1, project_name: "Legal Docs", source_language: "EN", target_language: "FR", progress: 45, status: "In Progress", updated_at: "2026-03-24T14:30:00Z" },
  { id: 3, document_name: "Product_Spec_Sheet.docx",   project_id: null, project_name: null,      source_language: "EN", target_language: "TH", progress: 12, status: "Pending",     updated_at: "2026-03-23T09:15:00Z" },
  { id: 4, document_name: "NDA_Agreement_2024.pdf",    project_id: null, project_name: null,      source_language: "EN", target_language: "JA", progress: 91, status: "In Review",   updated_at: "2026-03-22T16:45:00Z" },
];

function mapJobToTranslation(j: TranslationJobListItem): DashboardTranslation {
  const src = j.source_language?.substring(0, 2).toUpperCase() ?? "EN";
  const tgt = j.target_language?.substring(0, 2).toUpperCase() ?? "";
  let progress = 0;
  let status = "Pending";
  if (j.status === "completed" || j.status === "exported") {
    progress = 100;
    status = "Completed";
  } else if (j.status === "review" || j.status === "in_review") {
    progress = 78;
    status = "In Review";
  } else if (j.status === "processing") {
    progress = 45;
    status = "In Progress";
  }
  return {
    id: j.id,
    document_name: j.document_name,
    project_id: null,
    project_name: null,
    source_language: src,
    target_language: tgt,
    progress,
    status,
    updated_at: j.created_at,
  };
}

export function useDashboardTranslations() {
  return useQuery<DashboardTranslation[]>({
    queryKey: queryKeys.translationJobs.recent(),
    queryFn: async () => {
      const jobs = await translationJobsApi.listRecent(10);
      if (jobs.length === 0) return [];
      return jobs.map(mapJobToTranslation);
    },
    staleTime: 30_000,
    placeholderData: SAMPLE_TRANSLATIONS,
  });
}

export function useUsage() {
  return useQuery<UsageResponse>({
    queryKey: ["usage"],
    queryFn: () => usageApi.get(),
    staleTime: 30_000,
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
