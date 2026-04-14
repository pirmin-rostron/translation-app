"""Glossary term suggestion endpoints — extract, review, and accept/reject suggestions."""

import json
import logging
import os
from datetime import datetime

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import (
    Document,
    DocumentBlock,
    GlossaryTerm,
    GlossaryTermSuggestion,
    Organisation,
    TranslationJob,
)
from services.auth import get_current_org

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/glossary-suggestions", tags=["glossary-suggestions"])

HAIKU_MODEL = "claude-haiku-4-5-20251001"


# ── Schemas ──────────────────────────────────────────────────────────────────

class SuggestionOut(BaseModel):
    id: int
    job_id: int
    source_term: str
    target_term: str
    source_language: str
    target_language: str
    frequency: int
    status: str

    class Config:
        from_attributes = True


class StatusUpdate(BaseModel):
    status: str  # "accepted" | "rejected"


class BulkAcceptRequest(BaseModel):
    suggestion_ids: list[int]


# ── Helpers ──────────────────────────────────────────────────────────────────

def _extract_suggestions_for_job(db: Session, job: TranslationJob, org_id: int) -> list[GlossaryTermSuggestion]:
    """Call Claude Haiku to extract domain-specific term pairs from a translated job."""
    doc = db.query(Document).filter(Document.id == job.document_id).first()
    if not doc:
        return []

    blocks = (
        db.query(DocumentBlock)
        .filter(DocumentBlock.document_id == doc.id)
        .order_by(DocumentBlock.block_index)
        .all()
    )
    # Filter to blocks with both source and translated text
    pairs = []
    for b in blocks:
        src = (b.text_original or "").strip()
        tgt = (b.text_translated or "").strip()
        if src and tgt:
            pairs.append({"source": src, "target": tgt})
    if not pairs:
        return []

    # Limit to 20 blocks for prompt size
    pairs = pairs[:20]

    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key or api_key.startswith("sk-placeholder"):
        logger.warning("Glossary extraction skipped: no valid ANTHROPIC_API_KEY")
        return []

    blocks_text = "\n".join(
        f"Source: {p['source']}\nTranslation: {p['target']}\n"
        for p in pairs
    )

    try:
        client = anthropic.Anthropic(api_key=api_key)
        resp = client.messages.create(
            model=HAIKU_MODEL,
            max_tokens=1000,
            system="You are a terminology extraction assistant. Extract domain-specific term pairs from translated document blocks.",
            messages=[{
                "role": "user",
                "content": (
                    "Extract up to 10 important domain-specific term pairs from these translation pairs. "
                    "Focus on: specialised nouns, legal/technical terms, proper nouns, and industry vocabulary. "
                    "Ignore common words. Return JSON only:\n"
                    '[{"source": "term", "target": "translation", "frequency": N}]\n\n'
                    f"Source language: {job.source_language}\n"
                    f"Target language: {job.target_language}\n\n"
                    f"Blocks:\n{blocks_text}"
                ),
            }],
        )
        raw = resp.content[0].text.strip()
    except Exception:
        logger.exception("Glossary extraction API call failed for job_id=%d", job.id)
        return []

    # Parse JSON from response (handle markdown code blocks)
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    try:
        items = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Glossary extraction JSON parse failed for job_id=%d: %r", job.id, raw[:200])
        return []

    if not isinstance(items, list):
        return []

    # Filter out terms already in the org's glossary
    existing = set()
    for gt in db.query(GlossaryTerm).filter(GlossaryTerm.org_id == org_id).all():
        existing.add((gt.source_term.lower(), gt.target_term.lower()))

    # Also filter out terms already suggested for this job
    already_suggested = set()
    for s in db.query(GlossaryTermSuggestion).filter(
        GlossaryTermSuggestion.job_id == job.id,
    ).all():
        already_suggested.add((s.source_term.lower(), s.target_term.lower()))

    suggestions = []
    for item in items:
        if not isinstance(item, dict):
            continue
        src = str(item.get("source", "")).strip()
        tgt = str(item.get("target", "")).strip()
        freq = int(item.get("frequency", 1)) if isinstance(item.get("frequency"), (int, float)) else 1
        if not src or not tgt:
            continue
        if (src.lower(), tgt.lower()) in existing:
            continue
        if (src.lower(), tgt.lower()) in already_suggested:
            continue
        suggestion = GlossaryTermSuggestion(
            org_id=org_id,
            job_id=job.id,
            source_term=src,
            target_term=tgt,
            source_language=job.source_language,
            target_language=job.target_language,
            frequency=freq,
            status="pending",
        )
        suggestions.append(suggestion)
        already_suggested.add((src.lower(), tgt.lower()))

    if suggestions:
        db.add_all(suggestions)
        db.commit()
        for s in suggestions:
            db.refresh(s)
    logger.info("Glossary extraction: job_id=%d extracted=%d", job.id, len(suggestions))
    return suggestions


def _accept_suggestion(db: Session, suggestion: GlossaryTermSuggestion) -> None:
    """Accept a suggestion — create a GlossaryTerm and mark it accepted."""
    term = GlossaryTerm(
        source_term=suggestion.source_term,
        target_term=suggestion.target_term,
        source_language=suggestion.source_language,
        target_language=suggestion.target_language,
        org_id=suggestion.org_id,
    )
    db.add(term)
    suggestion.status = "accepted"
    db.commit()


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/pending", response_model=list[SuggestionOut])
def list_pending_suggestions(
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """Return all pending suggestions for the current org across all jobs."""
    return (
        db.query(GlossaryTermSuggestion)
        .filter(
            GlossaryTermSuggestion.org_id == current_org.id,
            GlossaryTermSuggestion.status == "pending",
        )
        .order_by(GlossaryTermSuggestion.created_at.desc())
        .all()
    )


@router.patch("/{suggestion_id}", response_model=SuggestionOut)
def update_suggestion_status(
    suggestion_id: int,
    body: StatusUpdate,
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """Accept or reject a single glossary suggestion."""
    suggestion = db.query(GlossaryTermSuggestion).filter(
        GlossaryTermSuggestion.id == suggestion_id,
        GlossaryTermSuggestion.org_id == current_org.id,
    ).first()
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    if body.status not in ("accepted", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be 'accepted' or 'rejected'")
    if body.status == "accepted":
        _accept_suggestion(db, suggestion)
    else:
        suggestion.status = "rejected"
        db.commit()
    db.refresh(suggestion)
    return suggestion


@router.post("/bulk-accept", response_model=list[SuggestionOut])
def bulk_accept_suggestions(
    body: BulkAcceptRequest,
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """Accept multiple suggestions at once, creating GlossaryTerms for each."""
    suggestions = (
        db.query(GlossaryTermSuggestion)
        .filter(
            GlossaryTermSuggestion.id.in_(body.suggestion_ids),
            GlossaryTermSuggestion.org_id == current_org.id,
            GlossaryTermSuggestion.status == "pending",
        )
        .all()
    )
    for s in suggestions:
        _accept_suggestion(db, s)
    for s in suggestions:
        db.refresh(s)
    return suggestions
