"""Projects router — CRUD for project containers."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models import Document, Organisation, Project
from services.auth import get_current_active_user, get_current_org

router = APIRouter(prefix="/projects", tags=["projects"])


# ── Schemas ──────────────────────────────────────────────────────────────────


class ProjectCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    target_languages: list[str] = Field(default_factory=list)
    default_tone: str = "neutral"


class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    target_languages: Optional[list[str]] = None
    default_tone: Optional[str] = None


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
    target_languages: list[str]
    default_tone: str
    document_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None


class ProjectDetailResponse(ProjectResponse):
    documents: list[ProjectDocumentOut] = []


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
        target_languages=body.target_languages,
        default_tone=body.default_tone,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectResponse(
        id=project.id,
        org_id=project.org_id,
        name=project.name,
        target_languages=project.target_languages or [],
        default_tone=project.default_tone,
        document_count=0,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


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
        result.append(
            ProjectResponse(
                id=p.id,
                org_id=p.org_id,
                name=p.name,
                target_languages=p.target_languages or [],
                default_tone=p.default_tone,
                document_count=doc_count,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
        )
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
    return ProjectDetailResponse(
        id=project.id,
        org_id=project.org_id,
        name=project.name,
        target_languages=project.target_languages or [],
        default_tone=project.default_tone,
        document_count=len(docs),
        created_at=project.created_at,
        updated_at=project.updated_at,
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
    if body.target_languages is not None:
        project.target_languages = body.target_languages
    if body.default_tone is not None:
        project.default_tone = body.default_tone
    project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(project)
    doc_count = (
        db.query(Document)
        .filter(Document.project_id == project.id, Document.deleted_at.is_(None))
        .count()
    )
    return ProjectResponse(
        id=project.id,
        org_id=project.org_id,
        name=project.name,
        target_languages=project.target_languages or [],
        default_tone=project.default_tone,
        document_count=doc_count,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """Soft-delete a project."""
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
    project.deleted_at = datetime.utcnow()
    db.commit()
