from datetime import date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from database import get_db
from models import Document, GlossaryTerm, Organisation, OrgMembership, TranslationJob, TranslationResult, UsageEvent
from services.auth import get_current_org, require_org_role
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


# ── Admin costs endpoint ─────────────────────────────────────────────────────


class DailyCost(BaseModel):
    date: str
    cost_usd: float
    jobs: int


class LanguageCost(BaseModel):
    language: str
    cost_usd: float
    jobs: int


class AdminCostsResponse(BaseModel):
    total_cost_usd_this_month: float
    total_cost_usd_all_time: float
    avg_cost_per_job: float
    avg_cost_per_1000_words: float
    total_jobs_this_month: int
    total_words_this_month: int
    daily_costs: list[DailyCost]
    cost_by_language: list[LanguageCost]


@router.get("/admin/costs", response_model=AdminCostsResponse)
def admin_costs(
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
    _membership: OrgMembership = Depends(require_org_role(["owner", "admin"])),
):
    """Return API cost breakdown for the current org. Requires owner or admin role."""
    org_id = current_org.id

    # All jobs with cost data
    all_jobs = (
        db.query(TranslationJob)
        .filter(TranslationJob.org_id == org_id, TranslationJob.deleted_at.is_(None))
        .all()
    )

    total_cost_all_time = sum(j.estimated_api_cost_usd or 0 for j in all_jobs)
    jobs_with_cost = [j for j in all_jobs if j.estimated_api_cost_usd]
    avg_cost_per_job = total_cost_all_time / len(jobs_with_cost) if jobs_with_cost else 0

    # Words this month (from UsageEvent)
    month_start = date.today().replace(day=1)
    words_rows = (
        db.query(UsageEvent.meta)
        .filter(
            UsageEvent.event_type == WORDS_TRANSLATED,
            UsageEvent.org_id == org_id,
            UsageEvent.created_at >= datetime(month_start.year, month_start.month, month_start.day),
        )
        .all()
    )
    total_words_this_month = 0
    for (meta,) in words_rows:
        if isinstance(meta, dict):
            total_words_this_month += int(meta.get("word_count", 0) or 0)

    # All-time words for cost-per-1000-words
    all_words_rows = (
        db.query(UsageEvent.meta)
        .filter(UsageEvent.event_type == WORDS_TRANSLATED, UsageEvent.org_id == org_id)
        .all()
    )
    total_words_all = 0
    for (meta,) in all_words_rows:
        if isinstance(meta, dict):
            total_words_all += int(meta.get("word_count", 0) or 0)
    avg_cost_per_1000_words = (total_cost_all_time / total_words_all * 1000) if total_words_all > 0 else 0

    # This month's jobs and cost
    jobs_this_month = [j for j in all_jobs if j.created_at and j.created_at.date() >= month_start]
    total_cost_this_month = sum(j.estimated_api_cost_usd or 0 for j in jobs_this_month)
    total_jobs_this_month = len(jobs_this_month)

    # Daily costs (last 30 days)
    thirty_days_ago = date.today() - timedelta(days=30)
    daily_map: dict[str, DailyCost] = {}
    for j in all_jobs:
        if not j.created_at or j.created_at.date() < thirty_days_ago:
            continue
        day_str = j.created_at.date().isoformat()
        if day_str not in daily_map:
            daily_map[day_str] = DailyCost(date=day_str, cost_usd=0, jobs=0)
        daily_map[day_str].cost_usd += j.estimated_api_cost_usd or 0
        daily_map[day_str].jobs += 1
    daily_costs = sorted(daily_map.values(), key=lambda d: d.date)

    # Cost by language
    lang_map: dict[str, LanguageCost] = {}
    for j in all_jobs:
        lang = j.target_language
        if lang not in lang_map:
            lang_map[lang] = LanguageCost(language=lang, cost_usd=0, jobs=0)
        lang_map[lang].cost_usd += j.estimated_api_cost_usd or 0
        lang_map[lang].jobs += 1
    cost_by_language = sorted(lang_map.values(), key=lambda x: x.cost_usd, reverse=True)

    return AdminCostsResponse(
        total_cost_usd_this_month=round(total_cost_this_month, 4),
        total_cost_usd_all_time=round(total_cost_all_time, 4),
        avg_cost_per_job=round(avg_cost_per_job, 4),
        avg_cost_per_1000_words=round(avg_cost_per_1000_words, 4),
        total_jobs_this_month=total_jobs_this_month,
        total_words_this_month=total_words_this_month,
        daily_costs=daily_costs,
        cost_by_language=cost_by_language,
    )
