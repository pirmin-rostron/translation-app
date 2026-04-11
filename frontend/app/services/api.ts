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
    const authPaths = ["/login", "/register", "/preview", "/"];
    if (!authPaths.some((p) => window.location.pathname.startsWith(p))) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { useAuthStore } = require("../stores/authStore") as typeof import("../stores/authStore");
        useAuthStore.getState().clearAuth();
      } catch {
        // Store unavailable — clear cookie directly as fallback.
        document.cookie = "auth_token=; path=/; max-age=0";
      }
      window.location.href = "/login?reason=session_expired";
      throw new Error("Session expired");
    }
  }

  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(payload.detail ?? `Request failed (${res.status})`);
  }
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
    apiFetch<T>(`${API_URL}/documents/${id}/translation-jobs`),

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
  document_name: string | null;
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
    apiFetch<TranslationJobListItem[]>(`${API_URL}/translation-jobs?limit=${limit}&order=desc`),

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

  export: <T>(jobId: number, fileType: string, formattingMode: string) =>
    apiFetch<T>(
      `${API_URL}/translation-jobs/${jobId}/export?file_type=${fileType}&formatting_mode=${formattingMode}`,
      { method: "POST" }
    ),

  markReady: <T>(jobId: number) =>
    apiFetch<T>(`${API_URL}/translation-jobs/${jobId}/mark-ready`, { method: "POST" }),

  approveSafeSegments: <T>(jobId: number) =>
    apiFetch<T>(`${API_URL}/translation-jobs/${jobId}/approve-safe-segments`, { method: "POST" }),

  saveDraft: <T>(jobId: number) =>
    apiFetch<T>(`${API_URL}/translation-jobs/${jobId}/save-draft`, { method: "POST" }),
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
