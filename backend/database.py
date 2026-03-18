import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://translation:translation@localhost:5432/translation"
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables. Run on startup."""
    import models  # noqa: F401 - registers models with Base
    Base.metadata.create_all(bind=engine)
    _migrate_schema()
    _normalize_status_values()


def _migrate_schema():
    """Apply small schema updates for existing local databases."""
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    if "approved_translations" in table_names:
        approved_columns = {column["name"] for column in inspector.get_columns("approved_translations")}
        if "source_embedding" not in approved_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE approved_translations ADD COLUMN source_embedding JSONB"))

    if "translation_results" in table_names:
        result_columns = {column["name"] for column in inspector.get_columns("translation_results")}
        with engine.begin() as conn:
            if "exact_memory_used" not in result_columns:
                conn.execute(
                    text(
                        "ALTER TABLE translation_results ADD COLUMN exact_memory_used BOOLEAN NOT NULL DEFAULT FALSE"
                    )
                )
            if "semantic_memory_used" not in result_columns:
                conn.execute(
                    text(
                        "ALTER TABLE translation_results ADD COLUMN semantic_memory_used BOOLEAN NOT NULL DEFAULT FALSE"
                    )
                )
            if "glossary_applied" not in result_columns:
                conn.execute(
                    text(
                        "ALTER TABLE translation_results ADD COLUMN glossary_applied BOOLEAN NOT NULL DEFAULT FALSE"
                    )
                )
            if "glossary_matches" not in result_columns:
                conn.execute(text("ALTER TABLE translation_results ADD COLUMN glossary_matches JSONB"))
            if "semantic_memory_details" not in result_columns:
                conn.execute(text("ALTER TABLE translation_results ADD COLUMN semantic_memory_details JSONB"))

    if "documents" in table_names:
        document_columns = {column["name"] for column in inspector.get_columns("documents")}
        with engine.begin() as conn:
            if "error_message" not in document_columns:
                conn.execute(text("ALTER TABLE documents ADD COLUMN error_message TEXT"))
            if "customer_id" not in document_columns:
                conn.execute(text("ALTER TABLE documents ADD COLUMN customer_id VARCHAR(100) NOT NULL DEFAULT 'default'"))

    if "translation_jobs" in table_names:
        job_columns = {column["name"] for column in inspector.get_columns("translation_jobs")}
        with engine.begin() as conn:
            if "error_message" not in job_columns:
                conn.execute(text("ALTER TABLE translation_jobs ADD COLUMN error_message TEXT"))
            if "last_saved_at" not in job_columns:
                conn.execute(text("ALTER TABLE translation_jobs ADD COLUMN last_saved_at TIMESTAMP"))
            if "progress_total_segments" not in job_columns:
                conn.execute(text("ALTER TABLE translation_jobs ADD COLUMN progress_total_segments INTEGER"))
            if "progress_completed_segments" not in job_columns:
                conn.execute(text("ALTER TABLE translation_jobs ADD COLUMN progress_completed_segments INTEGER"))
            if "progress_started_at" not in job_columns:
                conn.execute(text("ALTER TABLE translation_jobs ADD COLUMN progress_started_at TIMESTAMP"))
            if "customer_id" not in job_columns:
                conn.execute(
                    text("ALTER TABLE translation_jobs ADD COLUMN customer_id VARCHAR(100) NOT NULL DEFAULT 'default'")
                )
            if "translation_style" not in job_columns:
                conn.execute(
                    text("ALTER TABLE translation_jobs ADD COLUMN translation_style VARCHAR(20) NOT NULL DEFAULT 'natural'")
                )
            conn.execute(
                text(
                    "UPDATE translation_jobs SET translation_style = 'natural' "
                    "WHERE translation_style IS NULL OR TRIM(translation_style) = ''"
                )
            )

    if "approved_translations" in table_names:
        approved_columns = {column["name"] for column in inspector.get_columns("approved_translations")}
        with engine.begin() as conn:
            if "customer_id" not in approved_columns:
                conn.execute(
                    text("ALTER TABLE approved_translations ADD COLUMN customer_id VARCHAR(100) NOT NULL DEFAULT 'default'")
                )

    if "processing_stage_jobs" not in table_names:
        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                    CREATE TABLE processing_stage_jobs (
                        id SERIAL PRIMARY KEY,
                        document_id INTEGER NOT NULL REFERENCES documents(id),
                        translation_job_id INTEGER REFERENCES translation_jobs(id),
                        stage_name VARCHAR(50) NOT NULL,
                        status VARCHAR(50) NOT NULL DEFAULT 'queued',
                        attempt_count INTEGER NOT NULL DEFAULT 0,
                        max_attempts INTEGER NOT NULL DEFAULT 3,
                        error_message TEXT,
                        started_at TIMESTAMP,
                        finished_at TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
            )
            conn.execute(text("CREATE INDEX ix_processing_stage_jobs_id ON processing_stage_jobs (id)"))

    if "document_segments" in table_names:
        segment_columns = {column["name"] for column in inspector.get_columns("document_segments")}
        with engine.begin() as conn:
            if "block_id" not in segment_columns:
                conn.execute(text("ALTER TABLE document_segments ADD COLUMN block_id INTEGER"))

    if "segment_annotations" in table_names:
        annotation_columns = {column["name"] for column in inspector.get_columns("segment_annotations")}
        with engine.begin() as conn:
            if "translation_job_id" not in annotation_columns:
                conn.execute(text("ALTER TABLE segment_annotations ADD COLUMN translation_job_id INTEGER"))

    if "document_blocks" in table_names and "document_segments" in table_names:
        _backfill_document_blocks()


def _backfill_document_blocks():
    """Backfill one block per existing segment for older local databases."""
    from models import DocumentBlock, DocumentSegment, TranslationResult

    session = SessionLocal()
    try:
        segments = (
            session.query(DocumentSegment)
            .filter(DocumentSegment.block_id.is_(None))
            .order_by(DocumentSegment.document_id, DocumentSegment.segment_index)
            .all()
        )
        for segment in segments:
            block = DocumentBlock(
                document_id=segment.document_id,
                block_index=segment.segment_index,
                block_type=segment.segment_type or "paragraph",
                text_original=segment.source_text,
                text_translated=None,
                formatting_json=None,
            )
            session.add(block)
            session.flush()
            segment.block_id = block.id

            latest_result = (
                session.query(TranslationResult)
                .filter(TranslationResult.segment_id == segment.id)
                .order_by(TranslationResult.created_at.desc())
                .first()
            )
            if latest_result and latest_result.final_translation:
                block.text_translated = latest_result.final_translation

        if segments:
            session.commit()
    finally:
        session.close()


def _normalize_status_values():
    """Normalize legacy status values to the canonical model."""
    with engine.begin() as conn:
        # Canonical document parse/ingest statuses:
        # uploaded, parsing, parsed, parse_failed
        conn.execute(
            text(
                "UPDATE documents SET status = 'parse_failed' WHERE status = 'failed'"
            )
        )
        conn.execute(
            text(
                "UPDATE documents SET status = 'parsed' WHERE status = 'segmented'"
            )
        )

        # Canonical translation lifecycle statuses:
        # translation_queued, translating, in_review, draft_saved,
        # review_complete, ready_for_export, exported, failed
        conn.execute(
            text(
                "UPDATE translation_jobs SET status = 'translation_queued' WHERE status = 'queued'"
            )
        )
        conn.execute(
            text(
                "UPDATE translation_jobs SET status = 'in_review' WHERE status = 'translated'"
            )
        )
