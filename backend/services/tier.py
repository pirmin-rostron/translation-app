"""Tier configuration and enforcement — defines feature limits per subscription tier."""

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
