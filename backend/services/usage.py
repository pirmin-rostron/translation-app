"""Usage event tracking — append-only, never raises."""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from models import UsageEvent

logger = logging.getLogger(__name__)

# Event type constants
USER_REGISTERED = "user_registered"
USER_LOGIN = "user_login"
USER_LOGIN_FAILED = "user_login_failed"
DOCUMENT_INGESTED = "document_ingested"
JOB_CREATED = "job_created"
WORDS_TRANSLATED = "words_translated"
JOB_EXPORTED = "job_exported"
TRANSLATION_EDITED = "translation_edited"
AMBIGUITY_RESOLVED = "ambiguity_resolved"
USER_DELETED = "user_deleted"


def record_event(
    db: Session,
    event_type: str,
    *,
    user_id: int | None = None,
    job_id: int | None = None,
    document_id: int | None = None,
    org_id: int | None = None,
    meta: dict[str, Any] | None = None,
) -> None:
    """Record a usage event. Never raises — errors are logged and swallowed."""
    try:
        event = UsageEvent(
            event_type=event_type,
            user_id=user_id,
            job_id=job_id,
            document_id=document_id,
            org_id=org_id,
            meta=meta,
        )
        db.add(event)
        db.commit()
    except Exception:
        logger.exception("Failed to record usage event: %s", event_type)
        try:
            db.rollback()
        except Exception:
            pass
