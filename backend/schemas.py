from datetime import datetime
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
    industry: str | None
    domain: str | None
    status: str
    created_at: datetime

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
    created_at: datetime

    class Config:
        from_attributes = True


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
    industry: str | None
    domain: str | None
    status: str
    translation_provider: str | None
    translation_batch_size: int | None
    created_at: datetime

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


class GlossaryMatchResponse(BaseModel):
    source_term: str
    target_term: str


class GlossaryMatchesResponse(BaseModel):
    matches: list[GlossaryMatchResponse]


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
    text_original: str
    text_translated: str | None
    formatting_json: dict | None
    segments: list[ReviewSegmentResponse]
