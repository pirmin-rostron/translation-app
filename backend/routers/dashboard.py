"""Dashboard router — aggregated views for the authenticated user's org."""

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import Document, Organisation, Project, TranslationJob, TranslationResult
from services.auth import get_current_org

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class UpcomingItem(BaseModel):
    type: str  # "job" | "project"
    id: int
    name: str
    due_date: str
    status: str


@router.get("/upcoming", response_model=list[UpcomingItem])
def upcoming_deadlines(
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """Return jobs and projects due within the next 7 days for the current org.

    Sorted by due_date ascending, max 10 results.
    """
    today = date.today()
    horizon = today + timedelta(days=7)
    items: list[UpcomingItem] = []

    # Jobs due within 7 days
    jobs = (
        db.query(TranslationJob)
        .filter(
            TranslationJob.org_id == current_org.id,
            TranslationJob.deleted_at.is_(None),
            TranslationJob.due_date.isnot(None),
            TranslationJob.due_date <= horizon,
        )
        .all()
    )
    for job in jobs:
        doc = db.query(Document).filter(Document.id == job.document_id).first()
        items.append(UpcomingItem(
            type="job",
            id=job.id,
            name=doc.filename if doc else f"Job #{job.id}",
            due_date=str(job.due_date),
            status=job.status,
        ))

    # Projects due within 7 days
    projects = (
        db.query(Project)
        .filter(
            Project.org_id == current_org.id,
            Project.deleted_at.is_(None),
            Project.due_date.isnot(None),
            Project.due_date <= horizon,
        )
        .all()
    )
    for proj in projects:
        items.append(UpcomingItem(
            type="project",
            id=proj.id,
            name=proj.name,
            due_date=str(proj.due_date),
            status="active",
        ))

    # Sort by due_date ascending, cap at 10
    items.sort(key=lambda x: x.due_date)
    return items[:10]


# ── Autopilot agent stats ────────────────────────────────────────────────────


class AgentStatsResponse(BaseModel):
    blocks_translated: int
    decisions_auto: int
    decisions_asking: int
    saved_minutes: int
    insights_raised: int


@router.get("/agent-stats", response_model=AgentStatsResponse)
def agent_stats(
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """Return aggregate autopilot stats for the current org.

    Counts completed segments as blocks translated, in-review jobs as
    decisions_asking, and estimates time saved at 2 min per block.
    """
    # TODO: implement real logic — currently derives from job/result counts
    processing_statuses = {"queued", "parsing", "translating", "translation_queued"}
    review_statuses = {"in_review", "review"}

    jobs = (
        db.query(TranslationJob)
        .filter(
            TranslationJob.org_id == current_org.id,
            TranslationJob.deleted_at.is_(None),
        )
        .all()
    )

    blocks_translated = sum(j.progress_completed_segments or 0 for j in jobs)
    in_review = sum(1 for j in jobs if j.status in review_statuses)

    # Count results with ambiguity that are unresolved
    unresolved = (
        db.query(func.count(TranslationResult.id))
        .join(TranslationJob, TranslationJob.id == TranslationResult.job_id)
        .filter(
            TranslationJob.org_id == current_org.id,
            TranslationJob.deleted_at.is_(None),
            TranslationResult.ambiguity_detected.is_(True),
            TranslationResult.review_status.notin_(["approved", "edited"]),
        )
        .scalar()
    ) or 0

    decisions_auto = max(0, blocks_translated - unresolved - in_review)
    saved_minutes = blocks_translated * 2  # estimate: 2 min per block

    return AgentStatsResponse(
        blocks_translated=blocks_translated,
        decisions_auto=decisions_auto,
        decisions_asking=in_review,
        saved_minutes=saved_minutes,
        insights_raised=unresolved,
    )


# ── Autopilot feed (agent messages) ──────────────────────────────────────────


class AgentMessageAction(BaseModel):
    label: str
    primary: bool
    job_id: Optional[int] = None


class AgentMessageResponse(BaseModel):
    id: str
    when: str
    kind: str  # "question" | "decision" | "completed"
    project: str
    document: str
    pair: str
    job_id: Optional[int] = None
    title: str
    body: str
    meta: Optional[str] = None
    actions: Optional[list[AgentMessageAction]] = None


@router.get("/agent-feed", response_model=list[AgentMessageResponse])
def agent_feed(
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """Return agent feed messages derived from recent job activity.

    Generates question messages for in_review jobs with ambiguities,
    completion messages for recently completed jobs, and decision messages
    for glossary applications.
    """
    # TODO: implement real event-sourced feed — currently derives from job state
    messages: list[AgentMessageResponse] = []

    jobs = (
        db.query(TranslationJob)
        .filter(
            TranslationJob.org_id == current_org.id,
            TranslationJob.deleted_at.is_(None),
        )
        .order_by(TranslationJob.updated_at.desc().nullslast())
        .limit(20)
        .all()
    )

    review_statuses = {"in_review", "review"}
    completed_statuses = {"completed", "exported", "ready_for_export", "review_complete"}

    for j in jobs:
        doc = db.query(Document).filter(Document.id == j.document_id).first()
        doc_name = doc.filename if doc else f"Document #{j.document_id}"
        proj = db.query(Project).filter(Project.id == doc.project_id).first() if doc and doc.project_id else None
        proj_name = proj.name if proj else "No project"
        pair = f"{(j.source_language or 'EN').upper()} → {(j.target_language or '??').upper()}"

        if j.status in review_statuses:
            # Count unresolved ambiguities for this job
            amb_count = (
                db.query(func.count(TranslationResult.id))
                .filter(
                    TranslationResult.job_id == j.id,
                    TranslationResult.ambiguity_detected.is_(True),
                    TranslationResult.review_status.notin_(["approved", "edited"]),
                )
                .scalar()
            ) or 0

            if amb_count > 0:
                messages.append(AgentMessageResponse(
                    id=f"q-{j.id}",
                    when=_relative_time(j.updated_at),
                    kind="question",
                    project=proj_name,
                    document=doc_name,
                    pair=pair,
                    job_id=j.id,
                    title=f"{amb_count} ambiguit{'y' if amb_count == 1 else 'ies'} in {doc_name} — your call?",
                    body="I finished the translation but stopped short where the register could go different ways. I've picked a leading option but want your eyes.",
                    actions=[
                        AgentMessageAction(label="Open review", primary=True, job_id=j.id),
                        AgentMessageAction(label="Trust my picks", primary=False),
                    ],
                ))
            else:
                messages.append(AgentMessageResponse(
                    id=f"r-{j.id}",
                    when=_relative_time(j.updated_at),
                    kind="question",
                    project=proj_name,
                    document=doc_name,
                    pair=pair,
                    job_id=j.id,
                    title=f"{doc_name} is ready for review",
                    body="Translation complete, no ambiguities flagged. Ready for your approval.",
                    actions=[
                        AgentMessageAction(label="Open review", primary=True, job_id=j.id),
                    ],
                ))
        elif j.status in completed_statuses:
            total = j.progress_total_segments or 0
            messages.append(AgentMessageResponse(
                id=f"c-{j.id}",
                when=_relative_time(j.updated_at),
                kind="completed",
                project=proj_name,
                document=doc_name,
                pair=pair,
                job_id=j.id,
                title=f"Shipped {doc_name} — {pair}",
                body=f"Clean run. {total} blocks translated. Ready to export.",
                meta=f"{total} blocks",
            ))

    return messages[:15]


# ── Decisions log ────────────────────────────────────────────────────────────


class DecisionLogEntry(BaseModel):
    id: str
    when: str
    type: str  # "question" | "glossary" | "memory" | "edit" | "completed"
    text: str


@router.get("/decisions-log", response_model=list[DecisionLogEntry])
def decisions_log(
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """Return recent autopilot decision log entries.

    Derives from recent job events and translation result changes.
    """
    # TODO: implement real event-sourced log — currently derives from job state
    entries: list[DecisionLogEntry] = []

    jobs = (
        db.query(TranslationJob)
        .filter(
            TranslationJob.org_id == current_org.id,
            TranslationJob.deleted_at.is_(None),
        )
        .order_by(TranslationJob.updated_at.desc().nullslast())
        .limit(10)
        .all()
    )

    for j in jobs:
        doc = db.query(Document).filter(Document.id == j.document_id).first()
        doc_name = doc.filename if doc else f"Doc #{j.document_id}"
        lang = (j.target_language or "??").upper()

        if j.status in {"completed", "exported", "ready_for_export"}:
            entries.append(DecisionLogEntry(
                id=f"dl-c-{j.id}",
                when=_relative_time(j.updated_at),
                type="completed",
                text=f"{doc_name} · {lang} — shipped",
            ))
        elif j.status in {"in_review", "review"}:
            entries.append(DecisionLogEntry(
                id=f"dl-q-{j.id}",
                when=_relative_time(j.updated_at),
                type="question",
                text=f"Flagged for review: {doc_name} · {lang}",
            ))

    return entries[:10]


def _relative_time(dt) -> str:
    """Format a datetime as a human-readable relative time string."""
    if dt is None:
        return "recently"
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        from datetime import timezone as tz
        dt = dt.replace(tzinfo=tz.utc)
    diff = now - dt
    minutes = int(diff.total_seconds() / 60)
    if minutes < 1:
        return "just now"
    if minutes < 60:
        return f"{minutes}m ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}h ago"
    days = hours // 24
    return f"{days}d ago"
