"""Tier configuration and enforcement — defines feature limits per subscription tier."""

from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from models import Organisation

TIER_LIMITS: dict[str, dict] = {
    "free": {
        "max_jobs": 3,
        "max_languages": 1,
        "can_manual_review": False,
        "can_create_projects": False,
        "can_reference_docs": False,
        "max_projects": 0,
        "max_team_members": 1,
    },
    "pro": {
        "max_jobs": 20,
        "max_languages": 5,
        "can_manual_review": True,
        "can_create_projects": True,
        "can_reference_docs": False,
        "max_projects": 3,
        "max_team_members": 1,
    },
    "business": {
        "max_jobs": None,  # unlimited
        "max_languages": None,
        "can_manual_review": True,
        "can_create_projects": True,
        "can_reference_docs": True,
        "max_projects": None,
        "max_team_members": 10,
    },
    "agency": {
        "max_jobs": None,
        "max_languages": None,
        "can_manual_review": True,
        "can_create_projects": True,
        "can_reference_docs": True,
        "max_projects": None,
        "max_team_members": None,
    },
}


def get_tier_limits(tier: str) -> dict:
    """Return the limits dict for a tier. Defaults to free if tier is unknown."""
    return TIER_LIMITS.get(tier, TIER_LIMITS["free"])


def check_job_limit(org: Organisation) -> bool:
    """Return True if the org can create another translation job this month."""
    limits = get_tier_limits(org.tier)
    max_jobs: Optional[int] = limits["max_jobs"]
    if max_jobs is None:
        return True
    return org.jobs_this_month < max_jobs


def reset_job_count_if_new_period(org: Organisation, db: Session) -> None:
    """Reset jobs_this_month if the billing period has rolled over (30-day cycle)."""
    today = date.today()
    if org.billing_period_start is None:
        org.billing_period_start = today
        org.jobs_this_month = 0
        db.flush()
        return
    days_elapsed = (today - org.billing_period_start).days
    if days_elapsed >= 30:
        org.billing_period_start = today
        org.jobs_this_month = 0
        db.flush()


def increment_job_count(org: Organisation, db: Session) -> None:
    """Increment the monthly job counter for the org."""
    reset_job_count_if_new_period(org, db)
    org.jobs_this_month = (org.jobs_this_month or 0) + 1
    db.flush()
