"""Job event recording helper — structured audit trail for translation jobs."""

from typing import Optional

from sqlalchemy.orm import Session

from models import JobEvent


def record_job_event(
    db: Session,
    job_id: int,
    event_type: str,
    message: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> None:
    """Write a timestamped event to the job event log."""
    event = JobEvent(
        job_id=job_id,
        event_type=event_type,
        message=message,
        metadata_json=metadata,
    )
    db.add(event)
    db.flush()
