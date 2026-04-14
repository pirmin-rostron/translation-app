"""Projects router — CRUD for project containers."""

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models import Document, DocumentBlock, Organisation, Project, TranslationJob
from services.auth import get_current_active_user, get_current_org

router = APIRouter(prefix="/projects", tags=["projects"])


# ── Schemas ──────────────────────────────────────────────────────────────────


class ProjectCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    target_languages: list[str] = Field(default_factory=list)
    default_tone: str = "neutral"
    due_date: Optional[date] = None


class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    target_languages: Optional[list[str]] = None
    default_tone: Optional[str] = None
    due_date: Optional[date] = None


class ProjectDocumentOut(BaseModel):
    id: int
    filename: str
    status: str
    target_language: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectResponse(BaseModel):
    id: int
    org_id: int
    name: str
    description: Optional[str] = None
    target_languages: list[str]
    default_tone: str
    due_date: Optional[date] = None
    document_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None


class ProjectDetailResponse(ProjectResponse):
    documents: list[ProjectDocumentOut] = []


# ── Helpers ──────────────────────────────────────────────────────────────────


def _to_response(project: Project, doc_count: int) -> ProjectResponse:
    return ProjectResponse(
        id=project.id,
        org_id=project.org_id,
        name=project.name,
        description=project.description,
        target_languages=project.target_languages or [],
        default_tone=project.default_tone,
        due_date=project.due_date,
        document_count=doc_count,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.post("", response_model=ProjectResponse)
def create_project(
    body: ProjectCreateRequest,
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """Create a new project in the current organisation."""
    project = Project(
        org_id=current_org.id,
        name=body.name,
        description=body.description,
        target_languages=body.target_languages,
        default_tone=body.default_tone,
        due_date=body.due_date,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _to_response(project, 0)


@router.get("", response_model=list[ProjectResponse])
def list_projects(
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """List all active projects in the current organisation."""
    projects = (
        db.query(Project)
        .filter(Project.org_id == current_org.id, Project.deleted_at.is_(None))
        .order_by(Project.created_at.desc())
        .all()
    )
    result = []
    for p in projects:
        doc_count = (
            db.query(Document)
            .filter(Document.project_id == p.id, Document.deleted_at.is_(None))
            .count()
        )
        result.append(_to_response(p, doc_count))
    return result


@router.get("/{project_id}", response_model=ProjectDetailResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """Get project details with documents."""
    project = (
        db.query(Project)
        .filter(
            Project.id == project_id,
            Project.org_id == current_org.id,
            Project.deleted_at.is_(None),
        )
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    docs = (
        db.query(Document)
        .filter(Document.project_id == project.id, Document.deleted_at.is_(None))
        .order_by(Document.created_at.desc())
        .all()
    )
    base = _to_response(project, len(docs))
    return ProjectDetailResponse(
        **base.model_dump(),
        documents=[ProjectDocumentOut.model_validate(d) for d in docs],
    )


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    body: ProjectUpdateRequest,
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """Update project name, tone, or target languages."""
    project = (
        db.query(Project)
        .filter(
            Project.id == project_id,
            Project.org_id == current_org.id,
            Project.deleted_at.is_(None),
        )
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if body.name is not None:
        project.name = body.name
    if body.description is not None:
        project.description = body.description
    if body.target_languages is not None:
        project.target_languages = body.target_languages
    if body.default_tone is not None:
        project.default_tone = body.default_tone
    if body.due_date is not None:
        project.due_date = body.due_date
    project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(project)
    doc_count = (
        db.query(Document)
        .filter(Document.project_id == project.id, Document.deleted_at.is_(None))
        .count()
    )
    return _to_response(project, doc_count)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """Delete a project. Unlinks all documents (sets project_id=null) and deletes the record."""
    project = (
        db.query(Project)
        .filter(
            Project.id == project_id,
            Project.org_id == current_org.id,
            Project.deleted_at.is_(None),
        )
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    # Unlink all documents from this project — they become standalone
    db.query(Document).filter(Document.project_id == project_id).update(
        {"project_id": None}, synchronize_session=False,
    )
    db.delete(project)
    db.commit()


class ProjectStatsResponse(BaseModel):
    total_jobs: int
    completed_count: int
    in_review_count: int
    total_words: int


@router.get("/{project_id}/stats", response_model=ProjectStatsResponse)
def get_project_stats(
    project_id: int,
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """Return aggregate stats for all translation jobs in a project."""
    project = (
        db.query(Project)
        .filter(
            Project.id == project_id,
            Project.org_id == current_org.id,
            Project.deleted_at.is_(None),
        )
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Get all document IDs in this project
    doc_ids = [
        doc_id
        for (doc_id,) in db.query(Document.id)
        .filter(Document.project_id == project_id, Document.deleted_at.is_(None))
        .all()
    ]
    if not doc_ids:
        return ProjectStatsResponse(total_jobs=0, completed_count=0, in_review_count=0, total_words=0)

    jobs = (
        db.query(TranslationJob)
        .filter(
            TranslationJob.document_id.in_(doc_ids),
            TranslationJob.deleted_at.is_(None),
        )
        .all()
    )

    total_jobs = len(jobs)
    completed_count = sum(1 for j in jobs if j.status in ("exported", "completed", "ready_for_export", "review_complete"))
    in_review_count = sum(1 for j in jobs if j.status == "in_review")

    # Approximate word count from document blocks
    from sqlalchemy import func
    total_words_result = (
        db.query(func.sum(func.length(DocumentBlock.text_original) - func.length(func.replace(DocumentBlock.text_original, ' ', '')) + 1))
        .filter(DocumentBlock.document_id.in_(doc_ids))
        .scalar()
    )
    total_words = total_words_result or 0

    return ProjectStatsResponse(
        total_jobs=total_jobs,
        completed_count=completed_count,
        in_review_count=in_review_count,
        total_words=total_words,
    )
