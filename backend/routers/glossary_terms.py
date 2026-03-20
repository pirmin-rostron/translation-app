from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import GlossaryTerm
from schemas import GlossaryTermCreateRequest, GlossaryTermResponse
from services.auth import get_current_active_user
from services.glossary import normalize_optional

router = APIRouter(
    prefix="/api/glossary-terms",
    tags=["glossary-terms"],
    dependencies=[Depends(get_current_active_user)],
)


@router.post("", response_model=GlossaryTermResponse)
def create_glossary_term(body: GlossaryTermCreateRequest, db: Session = Depends(get_db)):
    term = GlossaryTerm(
        source_term=body.source_term.strip(),
        target_term=body.target_term.strip(),
        source_language=body.source_language.strip(),
        target_language=body.target_language.strip(),
        industry=normalize_optional(body.industry),
        domain=normalize_optional(body.domain),
    )
    db.add(term)
    db.commit()
    db.refresh(term)
    return term


@router.get("", response_model=list[GlossaryTermResponse])
def list_glossary_terms(db: Session = Depends(get_db)):
    return db.query(GlossaryTerm).order_by(GlossaryTerm.created_at.desc()).all()


@router.delete("/{term_id}")
def delete_glossary_term(term_id: int, db: Session = Depends(get_db)):
    term = db.query(GlossaryTerm).filter(GlossaryTerm.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="Glossary term not found")
    db.delete(term)
    db.commit()
    return {"status": "deleted"}
