"""Dashboard router — aggregated views for the authenticated user's org."""

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Document, Organisation, Project, TranslationJob
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
