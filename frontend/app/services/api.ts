export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const authHeaders = getAuthHeaders();
  const mergedHeaders: Record<string, string> = {
    ...authHeaders,
    ...(init?.headers as Record<string, string> | undefined),
  };
  const res = await fetch(url, { ...init, headers: mergedHeaders });
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
    apiFetch<T>(`${API_URL}/api/documents`),

  getById: <T>(id: number) =>
    apiFetch<T>(`${API_URL}/api/documents/${id}`),

  getBlocks: <T>(id: number) =>
    apiFetch<T>(`${API_URL}/api/documents/${id}/blocks`),

  getSegments: <T>(id: number) =>
    apiFetch<T>(`${API_URL}/api/documents/${id}/segments`),

  getTranslationJobs: <T>(id: number) =>
    apiFetch<T>(`${API_URL}/api/documents/${id}/translation-jobs`),

  getStages: <T>(id: number) =>
    apiFetch<T>(`${API_URL}/api/documents/${id}/stages`),

  getProgress: <T>(id: number) =>
    apiFetch<T>(`${API_URL}/api/documents/${id}/progress`),

  parse: <T>(id: number) =>
    apiFetch<T>(`${API_URL}/api/documents/${id}/parse`, { method: "POST" }),

  retry: <T>(id: number) =>
    apiFetch<T>(`${API_URL}/api/documents/${id}/retry`, { method: "POST" }),

  createTranslationJob: <T>(id: number, translationStyle: "natural" | "literal") =>
    apiFetch<T>(`${API_URL}/api/documents/${id}/translation-jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ translation_style: translationStyle }),
    }),

  updateSourceLanguage: <T>(id: number, sourceLanguage: string) =>
    apiFetch<T>(`${API_URL}/api/documents/${id}/source-language`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_language: sourceLanguage }),
    }),

  uploadAndTranslate: <T>(formData: FormData) =>
    apiFetch<T>(`${API_URL}/api/documents/upload-and-translate`, {
      method: "POST",
      body: formData,
    }),
};

// --- translation_jobs router ---

export const translationJobsApi = {
  getById: <T>(jobId: number) =>
    apiFetch<T>(`${API_URL}/api/translation-jobs/${jobId}`),

  getReviewBlocks: <T>(jobId: number) =>
    apiFetch<T>(`${API_URL}/api/translation-jobs/${jobId}/review-blocks`),

  getReviewSummary: <T>(jobId: number) =>
    apiFetch<T>(`${API_URL}/api/translation-jobs/${jobId}/review-summary`),

  getProgress: <T>(jobId: number) =>
    apiFetch<T>(`${API_URL}/api/translation-jobs/${jobId}/progress`),

  getExports: <T>(jobId: number) =>
    apiFetch<T>(`${API_URL}/api/translation-jobs/${jobId}/exports`),

  getPreview: <T>(jobId: number) =>
    apiFetch<T>(`${API_URL}/api/translation-jobs/${jobId}/preview`),

  retry: <T>(jobId: number) =>
    apiFetch<T>(`${API_URL}/api/translation-jobs/${jobId}/retry`, { method: "POST" }),

  export: <T>(jobId: number, fileType: string, formattingMode: string) =>
    apiFetch<T>(
      `${API_URL}/api/translation-jobs/${jobId}/export?file_type=${fileType}&formatting_mode=${formattingMode}`,
      { method: "POST" }
    ),

  markReady: <T>(jobId: number) =>
    apiFetch<T>(`${API_URL}/api/translation-jobs/${jobId}/mark-ready`, { method: "POST" }),

  approveSafeSegments: <T>(jobId: number) =>
    apiFetch<T>(`${API_URL}/api/translation-jobs/${jobId}/approve-safe-segments`, { method: "POST" }),

  saveDraft: <T>(jobId: number) =>
    apiFetch<T>(`${API_URL}/api/translation-jobs/${jobId}/save-draft`, { method: "POST" }),
};

// --- translation_results (part of translation_jobs router boundary) ---

export const translationResultsApi = {
  update: <T>(resultId: number, finalTranslation: string, reviewStatus: string) =>
    apiFetch<T>(`${API_URL}/api/translation-results/${resultId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ final_translation: finalTranslation, review_status: reviewStatus }),
    }),
};

// --- glossary_terms router ---

export const glossaryTermsApi = {
  list: <T>() =>
    apiFetch<T>(`${API_URL}/api/glossary-terms`),

  create: <T>(data: GlossaryTermCreate) =>
    apiFetch<T>(`${API_URL}/api/glossary-terms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  delete: <T>(id: number) =>
    apiFetch<T>(`${API_URL}/api/glossary-terms/${id}`, { method: "DELETE" }),
};
