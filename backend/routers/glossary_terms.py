from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import GlossaryTerm, Organisation
from schemas import GlossaryTermCreateRequest, GlossaryTermResponse, GlossaryTermUpdateRequest
from services.auth import get_current_active_user, get_current_org
from services.glossary import normalize_optional

router = APIRouter(
    prefix="/api/glossary-terms",
    tags=["glossary-terms"],
    dependencies=[Depends(get_current_active_user)],
)


@router.post("", response_model=GlossaryTermResponse)
def create_glossary_term(
    body: GlossaryTermCreateRequest,
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """Create a glossary term scoped to the current user's organisation."""
    term = GlossaryTerm(
        source_term=body.source_term.strip(),
        target_term=body.target_term.strip(),
        source_language=body.source_language.strip(),
        target_language=body.target_language.strip(),
        industry=normalize_optional(body.industry),
        domain=normalize_optional(body.domain),
        org_id=current_org.id,
    )
    db.add(term)
    db.commit()
    db.refresh(term)
    return term


@router.get("", response_model=list[GlossaryTermResponse])
def list_glossary_terms(
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """List glossary terms for the current user's organisation."""
    return (
        db.query(GlossaryTerm)
        .filter(GlossaryTerm.org_id == current_org.id)
        .order_by(GlossaryTerm.created_at.desc())
        .all()
    )


@router.patch("/{term_id}", response_model=GlossaryTermResponse)
def update_glossary_term(
    term_id: int,
    body: GlossaryTermUpdateRequest,
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """Update an existing glossary term. Only fields present in the request body are changed.
    The term must belong to the current user's organisation."""
    term = (
        db.query(GlossaryTerm)
        .filter(GlossaryTerm.id == term_id, GlossaryTerm.org_id == current_org.id)
        .first()
    )
    if not term:
        raise HTTPException(status_code=404, detail="Glossary term not found")

    if body.source_term is not None:
        term.source_term = body.source_term.strip()
    if body.target_term is not None:
        term.target_term = body.target_term.strip()
    if body.source_language is not None:
        term.source_language = body.source_language.strip()
    if body.target_language is not None:
        term.target_language = body.target_language.strip()
    if body.industry is not None:
        term.industry = normalize_optional(body.industry)
    if body.domain is not None:
        term.domain = normalize_optional(body.domain)

    db.commit()
    db.refresh(term)
    return term


@router.delete("/{term_id}")
def delete_glossary_term(
    term_id: int,
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """Delete a glossary term. Only terms belonging to the current org may be deleted."""
    term = (
        db.query(GlossaryTerm)
        .filter(GlossaryTerm.id == term_id, GlossaryTerm.org_id == current_org.id)
        .first()
    )
    if not term:
        raise HTTPException(status_code=404, detail="Glossary term not found")
    db.delete(term)
    db.commit()
    return {"status": "deleted"}
