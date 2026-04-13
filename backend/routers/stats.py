from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from database import get_db
from models import Document, GlossaryTerm, Organisation, TranslationJob, TranslationResult, UsageEvent
from services.auth import get_current_org
from services.usage import DOCUMENT_INGESTED, WORDS_TRANSLATED

router = APIRouter(prefix="/stats", tags=["stats"])


class PublicStats(BaseModel):
    words_translated: int
    documents_processed: int
    reviewer_approvals: int
    glossary_terms: int


@router.get("/public", response_model=PublicStats)
def public_stats(db: Session = Depends(get_db)):
    """Return aggregate platform statistics for public display on the landing page.

    No authentication required. All values are non-negative integers derived from
    read-only aggregates over existing tables:

    - words_translated: sum of meta.word_count across all words_translated events
    - documents_processed: count of document_ingested events
    - reviewer_approvals: count of TranslationResult rows in an accepted final state
    - glossary_terms: total rows in the glossary_terms table
    """
    # Words translated — sum meta['word_count'] from WORDS_TRANSLATED events
    words_rows = (
        db.query(UsageEvent.meta)
        .filter(UsageEvent.event_type == WORDS_TRANSLATED)
        .all()
    )
    words_translated = 0
    for (meta,) in words_rows:
        if isinstance(meta, dict):
            words_translated += int(meta.get("word_count", 0) or 0)

    # Documents processed — count DOCUMENT_INGESTED events
    documents_processed: int = (
        db.query(func.count(UsageEvent.id))
        .filter(UsageEvent.event_type == DOCUMENT_INGESTED)
        .scalar()
        or 0
    )

    # Reviewer approvals — TranslationResult rows in an accepted final state
    reviewer_approvals: int = (
        db.query(func.count(TranslationResult.id))
        .filter(
            TranslationResult.review_status.in_(
                ["approved", "reviewed", "memory_match", "semantic_memory_match"]
            )
        )
        .scalar()
        or 0
    )

    # Glossary terms — total rows
    glossary_terms: int = (
        db.query(func.count(GlossaryTerm.id)).scalar() or 0
    )

    return PublicStats(
        words_translated=words_translated,
        documents_processed=documents_processed,
        reviewer_approvals=reviewer_approvals,
        glossary_terms=glossary_terms,
    )


class OrgStats(BaseModel):
    total_words_translated: int
    time_saved_hours: float
    distinct_languages: int
    total_documents: int
    total_completed: int


@router.get("", response_model=OrgStats)
def org_stats(
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """Return aggregate usage stats for the current user's organisation."""
    org_id = current_org.id

    # Words translated — sum meta['word_count'] from org's WORDS_TRANSLATED events
    words_rows = (
        db.query(UsageEvent.meta)
        .filter(UsageEvent.event_type == WORDS_TRANSLATED, UsageEvent.org_id == org_id)
        .all()
    )
    total_words_translated = 0
    for (meta,) in words_rows:
        if isinstance(meta, dict):
            total_words_translated += int(meta.get("word_count", 0) or 0)

    time_saved_hours = round(total_words_translated / 250, 1)

    # Distinct target languages across all org's translation jobs
    distinct_languages: int = (
        db.query(func.count(func.distinct(TranslationJob.target_language)))
        .filter(TranslationJob.org_id == org_id, TranslationJob.deleted_at.is_(None))
        .scalar()
        or 0
    )

    # Total translation jobs
    total_documents: int = (
        db.query(func.count(TranslationJob.id))
        .filter(TranslationJob.org_id == org_id, TranslationJob.deleted_at.is_(None))
        .scalar()
        or 0
    )

    # Completed / exported jobs
    completed_statuses = {"exported", "completed", "ready_for_export", "review_complete"}
    total_completed: int = (
        db.query(func.count(TranslationJob.id))
        .filter(
            TranslationJob.org_id == org_id,
            TranslationJob.deleted_at.is_(None),
            TranslationJob.status.in_(completed_statuses),
        )
        .scalar()
        or 0
    )

    return OrgStats(
        total_words_translated=total_words_translated,
        time_saved_hours=time_saved_hours,
        distinct_languages=distinct_languages,
        total_documents=total_documents,
        total_completed=total_completed,
    )
