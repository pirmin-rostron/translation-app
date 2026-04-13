from datetime import date, datetime
from pydantic import BaseModel, Field


class DocumentCreate(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    file_type: str = Field(..., min_length=1, max_length=20)
    source_language: str | None = Field(None, max_length=50)
    target_language: str = Field(..., min_length=1, max_length=50)
    industry: str | None = Field(None, max_length=100)
    domain: str | None = Field(None, max_length=100)
    status: str = Field(default="uploaded", min_length=1, max_length=50)


class DocumentSourceLanguageUpdate(BaseModel):
    source_language: str


class DocumentResponse(BaseModel):
    id: int
    filename: str  # original filename for display
    file_type: str
    source_language: str | None
    target_language: str
    customer_id: str
    industry: str | None
    domain: str | None
    content_hash: str | None = None
    status: str
    error_message: str | None
    created_at: datetime
    deleted_at: datetime | None = None

    class Config:
        from_attributes = True


class SegmentResponse(BaseModel):
    id: int
    document_id: int
    block_id: int | None
    segment_index: int
    segment_type: str
    source_text: str
    context_before: str | None
    context_after: str | None
    heading_path: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentBlockResponse(BaseModel):
    id: int
    document_id: int
    block_index: int
    block_type: str
    text_original: str
    text_translated: str | None
    formatting_json: dict | None
    source_edited: bool = False
    original_source_text: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class SourceEditRequest(BaseModel):
    source_text: str = Field(..., min_length=1)


class SourceEditResponse(BaseModel):
    block: DocumentBlockResponse
    source_edit_word_delta: int
    total_source_words: int
    threshold_warning: bool = False
    threshold_exceeded: bool = False


class TranslationJobCreateRequest(BaseModel):
    translation_style: str = Field(default="natural", min_length=1, max_length=20)


class SegmentAnnotationResponse(BaseModel):
    id: int
    segment_id: int
    annotation_type: str
    source_span_text: str
    source_start: int
    source_end: int
    target_span_text: str | None
    target_start: int | None
    target_end: int | None
    metadata_json: dict | None
    created_at: datetime

    class Config:
        from_attributes = True


class TranslationJobResponse(BaseModel):
    id: int
    document_id: int
    source_language: str
    target_language: str
    customer_id: str
    industry: str | None
    domain: str | None
    translation_style: str
    status: str
    error_message: str | None
    last_saved_at: datetime | None
    progress_total_segments: int | None
    progress_completed_segments: int | None
    progress_started_at: datetime | None
    translation_provider: str | None
    translation_batch_size: int | None
    created_at: datetime
    due_date: date | None = None
    deleted_at: datetime | None = None
    document_name: str | None = None
    project_id: int | None = None
    project_name: str | None = None

    class Config:
        from_attributes = True


class AmbiguityAlternative(BaseModel):
    translation: str
    meaning: str


class AmbiguityDetails(BaseModel):
    source_span: str
    explanation: str
    alternatives: list[AmbiguityAlternative]


class TranslationResultUpdateRequest(BaseModel):
    final_translation: str = Field(..., min_length=1)
    review_status: str = Field(..., min_length=1, max_length=50)


class GlossaryTermCreateRequest(BaseModel):
    source_term: str = Field(..., min_length=1, max_length=255)
    target_term: str = Field(..., min_length=1, max_length=255)
    source_language: str = Field(..., min_length=1, max_length=50)
    target_language: str = Field(..., min_length=1, max_length=50)
    industry: str | None = Field(None, max_length=100)
    domain: str | None = Field(None, max_length=100)


class GlossaryTermUpdateRequest(BaseModel):
    source_term: str | None = Field(None, min_length=1, max_length=255)
    target_term: str | None = Field(None, min_length=1, max_length=255)
    source_language: str | None = Field(None, min_length=1, max_length=50)
    target_language: str | None = Field(None, min_length=1, max_length=50)
    industry: str | None = Field(None, max_length=100)
    domain: str | None = Field(None, max_length=100)


class GlossaryTermResponse(BaseModel):
    id: int
    source_term: str
    target_term: str
    source_language: str
    target_language: str
    industry: str | None
    domain: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class GlossaryImportResponse(BaseModel):
    imported: int
    skipped: int
    errors: list[str]


class GlossaryMatchResponse(BaseModel):
    source_term: str
    target_term: str


class GlossaryMatchesResponse(BaseModel):
    matches: list[GlossaryMatchResponse]


class AmbiguityChoiceOptionResponse(BaseModel):
    meaning: str
    translation: str


class TranslationResultResponse(BaseModel):
    id: int
    job_id: int
    segment_id: int
    primary_translation: str
    final_translation: str
    confidence_score: float | None
    review_status: str
    exact_memory_used: bool = False
    semantic_memory_used: bool = False
    semantic_memory_details: dict | None = None
    semantic_match_found: bool = False
    suggested_translation: str | None = None
    similarity_score: float | None = None
    current_translation: str
    ambiguity_choice_found: bool = False
    ambiguity_source_phrase: str | None = None
    ambiguity_options: list[AmbiguityChoiceOptionResponse] = []
    ambiguity_detected: bool
    ambiguity_details: dict | None
    glossary_applied: bool = False
    glossary_matches: GlossaryMatchesResponse | None = None
    created_at: datetime
    segment: SegmentResponse | None = None

    class Config:
        from_attributes = True


class ReviewSegmentResponse(BaseModel):
    id: int
    segment_id: int
    block_id: int | None
    segment_index: int
    segment_type: str
    source_text: str
    primary_translation: str
    final_translation: str
    confidence_score: float | None
    review_status: str
    exact_memory_used: bool = False
    semantic_memory_used: bool = False
    semantic_memory_details: dict | None = None
    semantic_match_found: bool = False
    suggested_translation: str | None = None
    similarity_score: float | None = None
    current_translation: str
    ambiguity_choice_found: bool = False
    ambiguity_source_phrase: str | None = None
    ambiguity_options: list[AmbiguityChoiceOptionResponse] = []
    ambiguity_detected: bool
    ambiguity_details: dict | None
    glossary_applied: bool = False
    glossary_matches: GlossaryMatchesResponse | None = None
    annotations: list[SegmentAnnotationResponse]


class ReviewBlockResponse(BaseModel):
    id: int
    document_id: int
    block_index: int
    block_type: str
    source_text_raw: str
    source_text_display: str
    translated_text_raw: str | None
    translated_text_display: str | None
    text_original: str
    text_translated: str | None
    formatting_json: dict | None
    source_edited: bool = False
    segments: list[ReviewSegmentResponse]


class ProcessingStageJobResponse(BaseModel):
    id: int
    document_id: int
    translation_job_id: int | None
    stage_name: str
    status: str
    attempt_count: int
    max_attempts: int
    error_message: str | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewBlocksPageResponse(BaseModel):
    blocks: list[ReviewBlockResponse]
    page: int
    page_size: int
    total_blocks: int
    total_pages: int
    job_status: str


class ReviewSummaryResponse(BaseModel):
    job_id: int
    total_segments: int
    approved_segments: int
    edited_segments: int
    safe_unresolved_segments: int
    review_complete: bool
    unresolved_count: int
    unresolved_ambiguities: int
    unresolved_semantic_reviews: int
    unresolved_segments: int
    ambiguity_count: int
    semantic_memory_review_count: int
    overall_status: str
    last_saved_at: datetime | None
    can_mark_ready_for_export: bool


class ExportResponse(BaseModel):
    job_id: int
    status: str
    export_format: str
    export_mode: str
    filename: str
    download_url: str
    generated_at: datetime
    version: int


class PreviewResponse(BaseModel):
    job_id: int
    document_name: str
    content_raw: str
    content_display: str


class ExportFileResponse(BaseModel):
    filename: str
    download_url: str
    generated_at: datetime
    version: int
    export_format: str | None = None
    export_mode: str | None = None
    latest: bool = False


class DocumentProgressResponse(BaseModel):
    document_id: int
    stage_label: str
    percentage: float
    eta_seconds: int | None
    is_complete: bool
    is_active: bool


class TranslationProgressResponse(BaseModel):
    job_id: int
    stage_label: str
    total_segments: int
    completed_segments: int
    percentage: float
    eta_seconds: int | None
    is_complete: bool
    blocks_completed: int = 0
    blocks_total: int = 0
