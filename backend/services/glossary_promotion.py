"""Auto-promote approved translations to glossary term suggestions.

When a segment is approved, checks if the source text is a short noun phrase
(1-3 words) that would be a good glossary candidate. If so, creates a
GlossaryTermSuggestion with suggestion_source="auto_promotion" so it routes
through the existing approve/dismiss flow on the glossary page.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime

from sqlalchemy.orm import Session

from models import GlossaryTerm, GlossaryTermSuggestion

logger = logging.getLogger(__name__)

# Words too common to be useful glossary terms
_STOP_WORDS: set[str] = {
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "has", "have", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "this", "that", "these", "those",
    "it", "its", "not", "no", "all", "each", "every", "any", "some",
}

_WORD_RE = re.compile(r"\b\w+\b")


def _is_glossary_candidate(source_text: str) -> bool:
    """Check if source text is a short noun phrase suitable as a glossary term.

    Criteria:
    - 1-3 words (short phrases only)
    - Not all stop words
    - At least one word with 3+ characters
    - No sentence punctuation (not a full sentence)
    """
    text = source_text.strip()
    if not text:
        return False

    # Reject if it looks like a sentence (has ending punctuation)
    if text[-1] in ".!?;":
        return False

    words = _WORD_RE.findall(text)
    if not words or len(words) > 3:
        return False

    # At least one meaningful word (not all stop words)
    meaningful = [w for w in words if w.lower() not in _STOP_WORDS and len(w) >= 3]
    if not meaningful:
        return False

    return True


def maybe_promote_to_suggestion(
    db: Session,
    source_text: str,
    target_text: str,
    source_language: str,
    target_language: str,
    org_id: int,
    job_id: int,
) -> GlossaryTermSuggestion | None:
    """If the source/target pair is a glossary candidate, create a suggestion.

    Returns the created suggestion or None if not a candidate or already exists.
    """
    if not _is_glossary_candidate(source_text):
        return None

    src_lower = source_text.strip().lower()
    tgt_lower = target_text.strip().lower()

    # Skip if already in the org's glossary
    existing_term = (
        db.query(GlossaryTerm)
        .filter(
            GlossaryTerm.org_id == org_id,
            GlossaryTerm.source_term.ilike(src_lower),
            GlossaryTerm.target_term.ilike(tgt_lower),
        )
        .first()
    )
    if existing_term:
        return None

    # Skip if already suggested (any status) for this org
    existing_suggestion = (
        db.query(GlossaryTermSuggestion)
        .filter(
            GlossaryTermSuggestion.org_id == org_id,
            GlossaryTermSuggestion.source_term.ilike(src_lower),
            GlossaryTermSuggestion.target_term.ilike(tgt_lower),
        )
        .first()
    )
    if existing_suggestion:
        return None

    suggestion = GlossaryTermSuggestion(
        org_id=org_id,
        job_id=job_id,
        source_term=source_text.strip(),
        target_term=target_text.strip(),
        source_language=source_language,
        target_language=target_language,
        frequency=1,
        status="pending",
        suggestion_source="auto_promotion",
    )
    db.add(suggestion)
    db.commit()
    db.refresh(suggestion)
    logger.info(
        "Auto-promoted glossary suggestion: '%s' -> '%s' (job_id=%d)",
        source_text.strip(),
        target_text.strip(),
        job_id,
    )
    return suggestion
