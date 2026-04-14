import { trackEvent } from "../utils/analytics";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

function getAuthHeaders(): Record<string, string> {
  try {
    // Avoid a circular import: import lazily at call time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAuthStore } = require("../stores/authStore") as typeof import("../stores/authStore");
    const token = useAuthStore.getState().token;
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {
    // Store not available (e.g. SSR context without hydration) — skip header.
  }
  return {};
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const authHeaders = getAuthHeaders();
  const mergedHeaders: Record<string, string> = {
    ...authHeaders,
    ...(init?.headers as Record<string, string> | undefined),
  };
  const res = await fetch(url, { ...init, headers: mergedHeaders });

  if (res.status === 401 && typeof window !== "undefined") {
    trackEvent("api.error_401", { path: url });
    const authPaths = ["/login", "/register", "/"];
    if (!authPaths.some((p) => window.location.pathname.startsWith(p))) {
      // Debounce: wait 100ms then check if token is still present before clearing.
      // This prevents a single transient 401 (race condition on page refresh,
      // backend restart, or network hiccup) from wiping a valid session.
      setTimeout(() => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { useAuthStore } = require("../stores/authStore") as typeof import("../stores/authStore");
          const tokenStillPresent = useAuthStore.getState().token;
          if (!tokenStillPresent) return; // Already cleared by another handler
          useAuthStore.getState().clearAuth();
        } catch {
          document.cookie = "auth_token=; path=/; max-age=0";
        }
        window.location.href = "/login?reason=session_expired";
      }, 100);
      throw new Error("Session expired");
    }
  }

  if (!res.ok) {
    if (res.status >= 500) {
      trackEvent("api.error_500", { path: url, status: res.status });
    }
    const payload = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(payload.detail ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// --- React Query key factories ---

// Unified key factory — use this everywhere (hooks, invalidateQueries, etc.)
export const queryKeys = {
  documents: {
    all: () => ["documents"] as const,
    detail: (id: number) => ["documents", id] as const,
    progress: (id: number) => ["documents", id, "progress"] as const,
    stages: (id: number) => ["documents", id, "stages"] as const,
    blocks: (id: number) => ["documents", id, "blocks"] as const,
    segments: (id: number) => ["documents", id, "segments"] as const,
  },
  translationJobs: {
    all: () => ["translation-jobs"] as const,
    recent: () => ["translation-jobs", "recent"] as const,
    byDocument: (documentId: number) => ["documents", documentId, "translation-jobs"] as const,
    detail: (id: number) => ["translation-jobs", id] as const,
    progress: (id: number) => ["translation-jobs", id, "progress"] as const,
    reviewBlocks: (id: number) => ["translation-jobs", id, "review-blocks"] as const,
    reviewSummary: (id: number) => ["translation-jobs", id, "review-summary"] as const,
    exports: (id: number) => ["translation-jobs", id, "exports"] as const,
  },
  glossaryTerms: {
    all: () => ["glossary-terms"] as const,
  },
} as const;

// Legacy per-domain exports kept for backward compatibility
export const documentKeys = queryKeys.documents;
export const translationJobKeys = {
  ...queryKeys.translationJobs,
  preview: (jobId: number) => ["translation-jobs", jobId, "preview"] as const,
};
export const glossaryKeys = queryKeys.glossaryTerms;

// --- Shared input types ---

export type GlossaryTermCreate = {
  source_term: string;
  target_term: string;
  source_language: string;
  target_language: string;
  industry: string | null;
  domain: string | null;
};

// --- documents router ---

export const documentsApi = {
  list: <T>() =>
    apiFetch<T>(`${API_URL}/documents`),

  getById: <T>(id: number) =>
    apiFetch<T>(`${API_URL}/documents/${id}`),

  getBlocks: <T>(id: number) =>
    apiFetch<T>(`${API_URL}/documents/${id}/blocks`),

  getSegments: <T>(id: number) =>
    apiFetch<T>(`${API_URL}/documents/${id}/segments`),

  getTranslationJobs: <T>(id: number) =>
    apiFetch<T>(`${API_URL}/translation-jobs/documents/${id}/translation-jobs`),

  getStages: <T>(id: number) =>
    apiFetch<T>(`${API_URL}/documents/${id}/stages`),

  getProgress: <T>(id: number) =>
    apiFetch<T>(`${API_URL}/documents/${id}/progress`),

  parse: <T>(id: number) =>
    apiFetch<T>(`${API_URL}/documents/${id}/parse`, { method: "POST" }),

  retry: <T>(id: number) =>
    apiFetch<T>(`${API_URL}/documents/${id}/retry`, { method: "POST" }),

  createTranslationJob: <T>(id: number, translationStyle: "natural" | "literal") =>
    apiFetch<T>(`${API_URL}/documents/${id}/translation-jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ translation_style: translationStyle }),
    }),

  updateSourceLanguage: <T>(id: number, sourceLanguage: string) =>
    apiFetch<T>(`${API_URL}/documents/${id}/source-language`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_language: sourceLanguage }),
    }),

  uploadAndTranslate: <T>(formData: FormData) =>
    apiFetch<T>(`${API_URL}/documents/upload-and-translate`, {
      method: "POST",
      body: formData,
    }),

  delete: (documentId: number) =>
    apiFetch<void>(`${API_URL}/documents/${documentId}`, { method: "DELETE" }),

  listGrouped: (page = 1, pageSize = 10) =>
    apiFetch<GroupedDocumentsResponse>(`${API_URL}/documents/grouped?page=${page}&page_size=${pageSize}`),
};

// --- dashboard types ---

export type TranslationJobListItem = {
  id: number;
  document_id: number;
  status: string;
  source_language: string | null;
  target_language: string;
  translation_style: string | null;
  translation_provider: string | null;
  error_message: string | null;
  progress_total_segments: number | null;
  progress_completed_segments: number;
  created_at: string;
  last_saved_at: string | null;
  due_date: string | null;
  document_name: string | null;
  project_id: number | null;
  project_name: string | null;
  quality_score: number | null;
};

export type GroupedDocJob = {
  id: number;
  target_language: string;
  source_language: string;
  status: string;
  quality_score: number | null;
  due_date: string | null;
  project_id: number | null;
  project_name: string | null;
  created_at: string | null;
};

export type GroupedDocument = {
  id: number;
  filename: string;
  uploaded_at: string | null;
  word_count: number;
  jobs: GroupedDocJob[];
};

export type GroupedDocumentsResponse = {
  documents: GroupedDocument[];
  total_documents: number;
  total_jobs: number;
  page: number;
  page_size: number;
};

export type PaginatedJobsResponse = {
  jobs: TranslationJobListItem[];
  total: number;
  page: number;
  page_size: number;
};

export type UpcomingItem = {
  type: "job" | "project";
  id: number;
  name: string;
  due_date: string;
  status: string;
};

export type DashboardStats = {
  activeProjects: number;
  wordsTranslated: number;
  pendingReview: number;
};

export type ProjectListItem = {
  id: number;
  name: string;
  description: string | null;
  glossary_id: number | null;
  translation_count: number;
};

// --- translation_jobs router ---

export const translationJobsApi = {
  listRecent: (limit = 10) =>
    apiFetch<PaginatedJobsResponse>(`${API_URL}/translation-jobs?limit=${limit}&order=desc`),

  listPaginated: (page = 1, pageSize = 10) =>
    apiFetch<PaginatedJobsResponse>(`${API_URL}/translation-jobs?page=${page}&page_size=${pageSize}&order=desc`),

  listByProject: async (projectId: number, limit = 50): Promise<TranslationJobListItem[]> => {
    const resp = await apiFetch<PaginatedJobsResponse>(`${API_URL}/translation-jobs?project_id=${projectId}&limit=${limit}&order=desc`);
    return resp.jobs;
  },

  getById: <T>(jobId: number) =>
    apiFetch<T>(`${API_URL}/translation-jobs/${jobId}`),

  getReviewBlocks: <T>(jobId: number, page: number = 1, pageSize: number = 10) =>
    apiFetch<T>(`${API_URL}/translation-jobs/${jobId}/review-blocks?page=${page}&page_size=${pageSize}`),

  getReviewSummary: <T>(jobId: number) =>
    apiFetch<T>(`${API_URL}/translation-jobs/${jobId}/review-summary`),

  getProgress: <T>(jobId: number) =>
    apiFetch<T>(`${API_URL}/translation-jobs/${jobId}/progress`),

  getExports: <T>(jobId: number) =>
    apiFetch<T>(`${API_URL}/translation-jobs/${jobId}/exports`),

  getPreview: <T>(jobId: number) =>
    apiFetch<T>(`${API_URL}/translation-jobs/${jobId}/preview`),

  retry: <T>(jobId: number) =>
    apiFetch<T>(`${API_URL}/translation-jobs/${jobId}/retry`, { method: "POST" }),

  delete: (jobId: number) =>
    apiFetch<void>(`${API_URL}/translation-jobs/${jobId}`, { method: "DELETE" }),

  retranslate: <T>(jobId: number) =>
    apiFetch<T>(`${API_URL}/translation-jobs/${jobId}/retranslate`, { method: "POST" }),

  export: <T>(jobId: number, fileType: string, formattingMode: string) =>
    apiFetch<T>(
      `${API_URL}/translation-jobs/${jobId}/export?file_type=${fileType}&formatting_mode=${formattingMode}`,
      { method: "POST" }
    ),

  markReady: <T>(jobId: number) =>
    apiFetch<T>(`${API_URL}/translation-jobs/${jobId}/mark-ready`, { method: "POST" }),

  approveAllSegments: <T>(jobId: number) =>
    apiFetch<T>(`${API_URL}/translation-jobs/${jobId}/approve-all-segments`, { method: "POST" }),

  approveSafeSegments: <T>(jobId: number) =>
    apiFetch<T>(`${API_URL}/translation-jobs/${jobId}/approve-safe-segments`, { method: "POST" }),

  saveDraft: <T>(jobId: number) =>
    apiFetch<T>(`${API_URL}/translation-jobs/${jobId}/save-draft`, { method: "POST" }),

  editBlockSource: (jobId: number, blockId: number, sourceText: string) =>
    apiFetch<SourceEditResponse>(`${API_URL}/translation-jobs/${jobId}/blocks/${blockId}/source`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_text: sourceText }),
    }),

  updateDueDate: (jobId: number, dueDate: string | null) =>
    apiFetch<{ id: number; due_date: string | null }>(`${API_URL}/translation-jobs/${jobId}/due-date`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ due_date: dueDate }),
    }),

  updateProject: (jobId: number, projectId: number | null) =>
    apiFetch<{ id: number; project_id: number | null; project_name: string | null }>(`${API_URL}/translation-jobs/${jobId}/project`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    }),
};

export type SourceEditResponse = {
  block: {
    id: number;
    document_id: number;
    block_index: number;
    block_type: string;
    text_original: string;
    text_translated: string | null;
    formatting_json: Record<string, unknown> | null;
    source_edited: boolean;
    original_source_text: string | null;
    created_at: string;
  };
  source_edit_word_delta: number;
  total_source_words: number;
  threshold_warning: boolean;
  threshold_exceeded: boolean;
};

// --- translation_results (part of translation_jobs router boundary) ---

export const translationResultsApi = {
  update: <T>(resultId: number, finalTranslation: string, reviewStatus: string) =>
    apiFetch<T>(`${API_URL}/translation-jobs/translation-results/${resultId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ final_translation: finalTranslation, review_status: reviewStatus }),
    }),
};

// --- auth router ---

export type UsageEvent = {
  id: number;
  event_type: string;
  user_id: number | null;
  job_id: number | null;
  document_id: number | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export type UsageResponse = {
  totals: {
    users_registered: number;
    logins: number;
    documents_ingested: number;
    jobs_created: number;
    words_translated: number;
    jobs_exported: number;
  };
  recent: UsageEvent[];
};

export const usageApi = {
  get: () => apiFetch<UsageResponse>(`${API_URL}/auth/usage`),
};

export type TierResponse = {
  tier: string;
  jobs_this_month: number;
  limits: {
    max_jobs: number | null;
    max_languages: number | null;
    can_manual_review: boolean;
    can_create_projects: boolean;
    can_reference_docs: boolean;
    max_projects: number | null;
    max_team_members: number | null;
  };
};

export const tierApi = {
  get: () => apiFetch<TierResponse>(`${API_URL}/auth/tier`),
};

export type ProjectResponse = {
  id: number;
  org_id: number;
  name: string;
  description: string | null;
  target_languages: string[];
  default_tone: string;
  due_date: string | null;
  document_count: number;
  created_at: string;
  updated_at: string | null;
};

export type ProjectDetailResponse = ProjectResponse & {
  documents: {
    id: number;
    filename: string;
    status: string;
    target_language: string;
    created_at: string;
  }[];
};

export type CreateProjectRequest = {
  name: string;
  description?: string;
  target_languages?: string[];
  default_tone?: string;
  due_date?: string;
};

export type ProjectStatsResponse = {
  total_jobs: number;
  completed_count: number;
  in_review_count: number;
  total_words: number;
};

export type OrgStatsResponse = {
  total_words_translated: number;
  time_saved_hours: number;
  distinct_languages: number;
  total_documents: number;
  total_completed: number;
};

export const orgStatsApi = {
  get: () => apiFetch<OrgStatsResponse>(`${API_URL}/stats`),
};

export const dashboardApi = {
  upcoming: () => apiFetch<UpcomingItem[]>(`${API_URL}/dashboard/upcoming`),
};

export type OverviewResponse = {
  job_id: number;
  document_id: number;
  status: string;
  source_language: string;
  target_language: string;
  document_name: string;
  review_mode: string;
  tone: string | null;
  tone_applied: string;
  summary: {
    total_blocks: number;
    issue_count: number;
    glossary_match_count: number;
    ambiguity_count: number;
    quality_score: number;
    memory_reuse_count: number;
    word_count: number;
  };
  blocks_preview: {
    source_text: string;
    translated_text: string;
    has_issue: boolean;
  }[];
  created_at: string | null;
};

export const overviewApi = {
  get: (jobId: number) =>
    apiFetch<OverviewResponse>(`${API_URL}/translation-jobs/${jobId}/overview`),
  setReviewMode: (jobId: number, reviewMode: string) =>
    apiFetch<{ id: number; review_mode: string }>(`${API_URL}/translation-jobs/${jobId}/review-mode`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ review_mode: reviewMode }),
    }),
};

export type JobEvent = {
  id: number;
  job_id: number;
  event_type: string;
  message: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
};

export const eventsApi = {
  list: (jobId: number) =>
    apiFetch<JobEvent[]>(`${API_URL}/translation-jobs/${jobId}/events`),
};

export const projectsApi = {
  create: (body: CreateProjectRequest) =>
    apiFetch<ProjectResponse>(`${API_URL}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  list: () => apiFetch<ProjectResponse[]>(`${API_URL}/projects`),
  get: (id: number) => apiFetch<ProjectDetailResponse>(`${API_URL}/projects/${id}`),
  update: (id: number, body: Partial<CreateProjectRequest>) =>
    apiFetch<ProjectResponse>(`${API_URL}/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  delete: (id: number) =>
    apiFetch<void>(`${API_URL}/projects/${id}`, { method: "DELETE" }),
  stats: (id: number) =>
    apiFetch<ProjectStatsResponse>(`${API_URL}/projects/${id}/stats`),
};

// --- admin types and api ---

export type WaitlistEntry = {
  name: string;
  email: string;
  created_at: string | null;
};

export type OrgInfo = {
  org: { id: number; name: string; created_at: string | null };
  role: string;
};

export type OrgMember = {
  user_id: number;
  email: string;
  full_name: string | null;
  role: string;
  joined_at: string | null;
};

export type AuditEvent = {
  id: number;
  event_type: string;
  created_at: string | null;
  meta: Record<string, unknown> | null;
};

export type AuditLogResponse = {
  total: number;
  offset: number;
  limit: number;
  events: AuditEvent[];
};

export type AdminUsageResponse = {
  totals: {
    users_registered: number;
    logins: number;
    documents_ingested: number;
    jobs_created: number;
    words_translated: number;
    jobs_exported: number;
  };
  recent: Array<{
    id: number;
    event_type: string;
    created_at: string | null;
    meta: Record<string, unknown> | null;
  }>;
};

export type InviteRequest = {
  email: string;
  full_name: string;
  role: string;
};

export type InviteResult = {
  user: { id: number; email: string; full_name: string | null };
  role: string;
  is_new_user: boolean;
  temporary_password?: string;
};

export type AdminCostsResponse = {
  total_cost_usd_this_month: number;
  total_cost_usd_all_time: number;
  avg_cost_per_job: number;
  avg_cost_per_1000_words: number;
  total_jobs_this_month: number;
  total_words_this_month: number;
  daily_costs: { date: string; cost_usd: number; jobs: number }[];
  cost_by_language: { language: string; cost_usd: number; jobs: number }[];
};

export const adminApi = {
  getWaitlist: () =>
    apiFetch<WaitlistEntry[]>(`${API_URL}/waitlist`),
  getOrg: () =>
    apiFetch<OrgInfo>(`${API_URL}/auth/org`),
  getOrgMembers: () =>
    apiFetch<OrgMember[]>(`${API_URL}/auth/org/members`),
  getUsage: () =>
    apiFetch<AdminUsageResponse>(`${API_URL}/auth/usage`),
  getAuditLog: (limit = 50, offset = 0) =>
    apiFetch<AuditLogResponse>(`${API_URL}/auth/org/audit?limit=${limit}&offset=${offset}`),
  inviteUser: (body: InviteRequest) =>
    apiFetch<InviteResult>(`${API_URL}/auth/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  getCosts: () =>
    apiFetch<AdminCostsResponse>(`${API_URL}/stats/admin/costs`),
};

// --- glossary_terms router ---

export type GlossaryTerm = {
  id: number;
  source_term: string;
  target_term: string;
  source_language: string;
  target_language: string;
  industry: string | null;
  domain: string | null;
  created_at: string;
  usage_count: number;
};

export const glossaryTermsApi = {
  list: <T>() =>
    apiFetch<T>(`${API_URL}/glossary-terms`),

  create: <T>(data: GlossaryTermCreate) =>
    apiFetch<T>(`${API_URL}/glossary-terms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Partial<GlossaryTermCreate>) =>
    apiFetch<GlossaryTerm>(`${API_URL}/glossary-terms/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  importCsv: (file: File, sourceLang: string, targetLang: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("source_language", sourceLang);
    fd.append("target_language", targetLang);
    return apiFetch<{ imported: number; skipped: number; errors: string[] }>(
      `${API_URL}/glossary-terms/import`,
      { method: "POST", body: fd }
    );
  },

  delete: <T>(id: number) =>
    apiFetch<T>(`${API_URL}/glossary-terms/${id}`, { method: "DELETE" }),
};

// --- Glossary suggestions ---

export type GlossarySuggestion = {
  id: number;
  job_id: number;
  source_term: string;
  target_term: string;
  source_language: string;
  target_language: string;
  frequency: number;
  status: string;
};

export const glossarySuggestionsApi = {
  getForJob: (jobId: number) =>
    apiFetch<GlossarySuggestion[]>(`${API_URL}/translation-jobs/${jobId}/suggestions`),

  getPending: () =>
    apiFetch<GlossarySuggestion[]>(`${API_URL}/glossary-suggestions/pending`),

  accept: (id: number) =>
    apiFetch<GlossarySuggestion>(`${API_URL}/glossary-suggestions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "accepted" }),
    }),

  reject: (id: number) =>
    apiFetch<GlossarySuggestion>(`${API_URL}/glossary-suggestions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    }),

  bulkAccept: (ids: number[]) =>
    apiFetch<GlossarySuggestion[]>(`${API_URL}/glossary-suggestions/bulk-accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suggestion_ids: ids }),
    }),
};
