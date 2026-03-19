export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(payload.detail ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// --- React Query key factories ---

export const documentKeys = {
  all: () => ["documents"] as const,
  detail: (id: number) => ["documents", id] as const,
  blocks: (id: number) => ["documents", id, "blocks"] as const,
  segments: (id: number) => ["documents", id, "segments"] as const,
  translationJobs: (id: number) => ["documents", id, "translation-jobs"] as const,
  stages: (id: number) => ["documents", id, "stages"] as const,
  progress: (id: number) => ["documents", id, "progress"] as const,
} as const;

export const translationJobKeys = {
  detail: (jobId: number) => ["translation-jobs", jobId] as const,
  reviewBlocks: (jobId: number) => ["translation-jobs", jobId, "review-blocks"] as const,
  reviewSummary: (jobId: number) => ["translation-jobs", jobId, "review-summary"] as const,
  progress: (jobId: number) => ["translation-jobs", jobId, "progress"] as const,
  exports: (jobId: number) => ["translation-jobs", jobId, "exports"] as const,
  preview: (jobId: number) => ["translation-jobs", jobId, "preview"] as const,
} as const;

export const glossaryKeys = {
  all: () => ["glossary-terms"] as const,
} as const;

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
