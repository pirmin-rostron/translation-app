from datetime import datetime
from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, Text, Float, JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from database import Base


class UsageEvent(Base):
    __tablename__ = "usage_events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    job_id = Column(Integer, ForeignKey("translation_jobs.id"), nullable=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    meta = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class TranslationJob(Base):
    __tablename__ = "translation_jobs"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    source_language = Column(String(50), nullable=False)
    target_language = Column(String(50), nullable=False)
    customer_id = Column(String(100), nullable=False, default="default")
    industry = Column(String(100), nullable=True)
    domain = Column(String(100), nullable=True)
    translation_style = Column(String(20), nullable=False, default="natural")
    status = Column(String(50), nullable=False, default="queued")
    error_message = Column(Text, nullable=True)
    last_saved_at = Column(DateTime, nullable=True)
    progress_total_segments = Column(Integer, nullable=True)
    progress_completed_segments = Column(Integer, nullable=True)
    progress_started_at = Column(DateTime, nullable=True)
    translation_provider = Column(String(50), nullable=True)  # "mock" | "openai"
    translation_batch_size = Column(Integer, nullable=True)  # batch size used
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", backref="translation_jobs")
    results = relationship("TranslationResult", back_populates="job")
    stage_jobs = relationship("ProcessingStageJob", back_populates="translation_job")


class TranslationResult(Base):
    __tablename__ = "translation_results"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("translation_jobs.id"), nullable=False)
    segment_id = Column(Integer, ForeignKey("document_segments.id"), nullable=False)
    primary_translation = Column(Text, nullable=False)
    final_translation = Column(Text, nullable=False)
    confidence_score = Column(Float, nullable=True)
    review_status = Column(String(50), nullable=False, default="unreviewed")
    exact_memory_used = Column(Boolean, nullable=False, default=False)
    semantic_memory_used = Column(Boolean, nullable=False, default=False)
    semantic_memory_details = Column(JSONB, nullable=True)
    ambiguity_detected = Column(Boolean, nullable=False, default=False)
    ambiguity_details = Column(JSONB, nullable=True)
    glossary_applied = Column(Boolean, nullable=False, default=False)
    glossary_matches = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("TranslationJob", back_populates="results")
    segment = relationship("DocumentSegment", backref="translation_results")


class ApprovedTranslation(Base):
    __tablename__ = "approved_translations"

    id = Column(Integer, primary_key=True, index=True)
    source_text = Column(Text, nullable=False)
    approved_translation = Column(Text, nullable=False)
    source_language = Column(String(50), nullable=False)
    target_language = Column(String(50), nullable=False)
    customer_id = Column(String(100), nullable=False, default="default")
    industry = Column(String(100), nullable=True)
    domain = Column(String(100), nullable=True)
    source_embedding = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class GlossaryTerm(Base):
    __tablename__ = "glossary_terms"

    id = Column(Integer, primary_key=True, index=True)
    source_term = Column(String(255), nullable=False)
    target_term = Column(String(255), nullable=False)
    source_language = Column(String(50), nullable=False)
    target_language = Column(String(50), nullable=False)
    industry = Column(String(100), nullable=True)
    domain = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)  # original display name
    stored_filename = Column(String(320), nullable=False)  # unique name on disk
    file_type = Column(String(20), nullable=False)
    source_language = Column(String(50), nullable=True)  # auto-detected or "unknown"
    target_language = Column(String(50), nullable=False)
    customer_id = Column(String(100), nullable=False, default="default")
    industry = Column(String(100), nullable=True)
    domain = Column(String(100), nullable=True)
    status = Column(String(50), nullable=False, default="uploaded")
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    blocks = relationship("DocumentBlock", back_populates="document")
    segments = relationship("DocumentSegment", back_populates="document")
    stage_jobs = relationship("ProcessingStageJob", back_populates="document")


class ProcessingStageJob(Base):
    __tablename__ = "processing_stage_jobs"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    translation_job_id = Column(Integer, ForeignKey("translation_jobs.id"), nullable=True)
    stage_name = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False, default="queued")
    attempt_count = Column(Integer, nullable=False, default=0)
    max_attempts = Column(Integer, nullable=False, default=3)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="stage_jobs")
    translation_job = relationship("TranslationJob", back_populates="stage_jobs")


class DocumentBlock(Base):
    __tablename__ = "document_blocks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    block_index = Column(Integer, nullable=False)
    block_type = Column(String(50), nullable=False, default="paragraph")
    text_original = Column(Text, nullable=False)
    text_translated = Column(Text, nullable=True)
    formatting_json = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="blocks")
    segments = relationship("DocumentSegment", back_populates="block")


class DocumentSegment(Base):
    __tablename__ = "document_segments"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    block_id = Column(Integer, ForeignKey("document_blocks.id"), nullable=True)
    segment_index = Column(Integer, nullable=False)
    segment_type = Column(String(50), nullable=False, default="paragraph")
    source_text = Column(Text, nullable=False)
    context_before = Column(Text, nullable=True)
    context_after = Column(Text, nullable=True)
    heading_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="segments")
    block = relationship("DocumentBlock", back_populates="segments")
    annotations = relationship("SegmentAnnotation", back_populates="segment")


class SegmentAnnotation(Base):
    __tablename__ = "segment_annotations"

    id = Column(Integer, primary_key=True, index=True)
    segment_id = Column(Integer, ForeignKey("document_segments.id"), nullable=False)
    translation_job_id = Column(Integer, ForeignKey("translation_jobs.id"), nullable=True)
    annotation_type = Column(String(50), nullable=False)
    source_span_text = Column(Text, nullable=False)
    source_start = Column(Integer, nullable=False)
    source_end = Column(Integer, nullable=False)
    target_span_text = Column(Text, nullable=True)
    target_start = Column(Integer, nullable=True)
    target_end = Column(Integer, nullable=True)
    metadata_json = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    segment = relationship("DocumentSegment", back_populates="annotations")
