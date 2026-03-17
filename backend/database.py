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

    if "document_segments" in table_names:
        segment_columns = {column["name"] for column in inspector.get_columns("document_segments")}
        with engine.begin() as conn:
            if "block_id" not in segment_columns:
                conn.execute(text("ALTER TABLE document_segments ADD COLUMN block_id INTEGER"))

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
