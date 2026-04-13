import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import GlossaryTerm, Organisation, TranslationResult
from schemas import GlossaryImportResponse, GlossaryTermCreateRequest, GlossaryTermResponse, GlossaryTermUpdateRequest
from services.auth import get_current_active_user, get_current_org
from services.glossary import normalize_optional

router = APIRouter(
    prefix="/glossary-terms",
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
    """List glossary terms for the current user's organisation, including usage counts."""
    terms = (
        db.query(GlossaryTerm)
        .filter(GlossaryTerm.org_id == current_org.id)
        .order_by(GlossaryTerm.created_at.desc())
        .all()
    )
    # Count how many TranslationResult rows have glossary_applied=true per term.
    # glossary_matches JSONB stores applied terms; we count results that reference
    # each source_term in their glossary_matches field.
    # Count glossary usage: how many TranslationResult rows with glossary_applied=true
    # reference each term's source_term in the glossary_matches JSONB field.
    usage_counts: dict[int, int] = {}
    if terms:
        glossary_results = (
            db.query(TranslationResult.glossary_matches)
            .filter(TranslationResult.glossary_applied.is_(True))
            .all()
        )
        if glossary_results:
            # Build a lookup: count how many results mention each source_term
            for term in terms:
                st = term.source_term.lower()
                count = 0
                for (matches_json,) in glossary_results:
                    if matches_json and st in str(matches_json).lower():
                        count += 1
                if count > 0:
                    usage_counts[term.id] = count

    result = []
    for term in terms:
        resp = GlossaryTermResponse.model_validate(term)
        resp.usage_count = usage_counts.get(term.id, 0)
        result.append(resp)
    return result


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


_MAX_IMPORT_ROWS = 1000


@router.post("/import", response_model=GlossaryImportResponse)
async def import_glossary_terms(
    file: UploadFile,
    source_language: str = Form(...),
    target_language: str = Form(...),
    industry: Optional[str] = Form(None),
    domain: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """Bulk-import glossary terms from a CSV file.

    The CSV must have a header row with columns: source_term, target_term.
    Duplicate terms (same source_term + source_language + target_language + org)
    are skipped rather than overwritten. All new terms are committed in a single
    transaction — the import is all-or-nothing for the new rows.
    """
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv")

    raw = await file.read()
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError:
        content = raw.decode("latin-1")

    try:
        reader = csv.DictReader(io.StringIO(content))
        # Consume the iterator into a list so we can detect parse failures up-front
        # and enforce the row limit before touching the DB.
        rows = list(reader)
    except Exception:
        raise HTTPException(status_code=400, detail="CSV could not be parsed")

    if not {"source_term", "target_term"}.issubset(set(reader.fieldnames or [])):
        raise HTTPException(
            status_code=400,
            detail="CSV must have header columns: source_term, target_term",
        )

    if len(rows) > _MAX_IMPORT_ROWS:
        raise HTTPException(
            status_code=400,
            detail=f"CSV exceeds the maximum of {_MAX_IMPORT_ROWS} rows",
        )

    norm_source_lang = source_language.strip()
    norm_target_lang = target_language.strip()
    norm_industry = normalize_optional(industry)
    norm_domain = normalize_optional(domain)

    # Fetch existing (source_term, source_language, target_language) tuples for this org
    # in one query to avoid N+1 lookups inside the loop.
    existing_keys: set[tuple[str, str, str]] = {
        (t.source_term, t.source_language, t.target_language)
        for t in db.query(
            GlossaryTerm.source_term,
            GlossaryTerm.source_language,
            GlossaryTerm.target_language,
        )
        .filter(
            GlossaryTerm.org_id == current_org.id,
            GlossaryTerm.source_language == norm_source_lang,
            GlossaryTerm.target_language == norm_target_lang,
        )
        .all()
    }

    new_terms: list[GlossaryTerm] = []
    skipped = 0
    errors: list[str] = []

    for i, row in enumerate(rows, start=2):  # row 1 is the header
        source_term = (row.get("source_term") or "").strip()
        target_term = (row.get("target_term") or "").strip()

        if not source_term and not target_term:
            # Silently skip blank rows
            continue
        if not source_term:
            errors.append(f"row {i}: missing source_term")
            continue
        if not target_term:
            errors.append(f"row {i}: missing target_term")
            continue

        key = (source_term, norm_source_lang, norm_target_lang)
        if key in existing_keys:
            skipped += 1
            continue

        new_terms.append(
            GlossaryTerm(
                source_term=source_term,
                target_term=target_term,
                source_language=norm_source_lang,
                target_language=norm_target_lang,
                industry=norm_industry,
                domain=norm_domain,
                org_id=current_org.id,
            )
        )
        # Track in-memory to catch duplicates within the same upload
        existing_keys.add(key)

    if new_terms:
        db.add_all(new_terms)
        db.commit()

    return GlossaryImportResponse(
        imported=len(new_terms),
        skipped=skipped,
        errors=errors,
    )
