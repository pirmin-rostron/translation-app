from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import GlossaryTerm, Organisation
from schemas import GlossaryTermCreateRequest, GlossaryTermResponse
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
