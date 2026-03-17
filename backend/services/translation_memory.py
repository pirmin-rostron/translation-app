import logging
import math
import os
from dataclasses import dataclass

from openai import OpenAI
from sqlalchemy.orm import Session

from models import ApprovedTranslation

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
SEMANTIC_MEMORY_THRESHOLD = float(os.getenv("SEMANTIC_MEMORY_THRESHOLD", "0.97"))


@dataclass
class TranslationMemoryMatch:
    approved: ApprovedTranslation
    match_type: str
    similarity: float | None = None


def _normalized_optional(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _is_valid_api_key(key: str) -> bool:
    if not key or len(key) < 20:
        return False
    placeholders = ("sk-your-key", "sk-...", "your-api-key", "xxx")
    return key.lower() not in (p.lower() for p in placeholders)


def _get_embedding_client() -> OpenAI | None:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not _is_valid_api_key(api_key):
        return None
    return OpenAI(api_key=api_key)


def _embed_text(text: str) -> list[float] | None:
    client = _get_embedding_client()
    if client is None:
        logger.warning("Semantic memory embedding skipped: OPENAI_API_KEY missing or invalid")
        return None
    try:
        response = client.embeddings.create(model=EMBEDDING_MODEL, input=text)
        embedding = response.data[0].embedding
        return [float(value) for value in embedding]
    except Exception as exc:
        logger.warning("Semantic memory embedding failed: %s", exc)
        return None


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    if len(a) != len(b) or not a or not b:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def generate_source_embedding(source_text: str) -> list[float] | None:
    """Generate an embedding for approved translation source text."""
    return _embed_text(source_text)


def store_embedding_if_missing(db: Session, approved: ApprovedTranslation) -> list[float] | None:
    """Backfill missing embeddings lazily for older approved translations."""
    if isinstance(approved.source_embedding, list) and approved.source_embedding:
        return [float(value) for value in approved.source_embedding]

    embedding = generate_source_embedding(approved.source_text)
    if embedding is None:
        return None

    approved.source_embedding = embedding
    db.add(approved)
    db.flush()
    return embedding


def find_exact_memory_match(
    db: Session,
    source_text: str,
    source_language: str,
    target_language: str,
    industry: str | None,
    domain: str | None,
) -> ApprovedTranslation | None:
    """Return the latest exact-match approved translation, if any."""
    normalized_industry = _normalized_optional(industry)
    normalized_domain = _normalized_optional(domain)
    return (
        db.query(ApprovedTranslation)
        .filter(
            ApprovedTranslation.source_text == source_text,
            ApprovedTranslation.source_language == source_language,
            ApprovedTranslation.target_language == target_language,
            ApprovedTranslation.industry == normalized_industry,
            ApprovedTranslation.domain == normalized_domain,
        )
        .order_by(ApprovedTranslation.created_at.desc())
        .first()
    )


def find_semantic_memory_match(
    db: Session,
    source_text: str,
    source_language: str,
    target_language: str,
    industry: str | None,
    domain: str | None,
) -> TranslationMemoryMatch | None:
    """
    Return the best semantic translation-memory match when similarity is high enough.

    Exact-match lookup should be attempted before this function.
    """
    normalized_industry = _normalized_optional(industry)
    normalized_domain = _normalized_optional(domain)
    candidates = (
        db.query(ApprovedTranslation)
        .filter(
            ApprovedTranslation.source_language == source_language,
            ApprovedTranslation.target_language == target_language,
            ApprovedTranslation.industry == normalized_industry,
            ApprovedTranslation.domain == normalized_domain,
        )
        .order_by(ApprovedTranslation.created_at.desc())
        .all()
    )
    if not candidates:
        logger.info(
            "Semantic memory miss source_language=%s target_language=%s score=n/a reason=no_candidates",
            source_language,
            target_language,
        )
        return None

    query_embedding = generate_source_embedding(source_text)
    if query_embedding is None:
        logger.info(
            "Semantic memory miss source_language=%s target_language=%s score=n/a reason=no_query_embedding",
            source_language,
            target_language,
        )
        return None

    best_candidate: ApprovedTranslation | None = None
    best_score = -1.0
    for candidate in candidates:
        candidate_embedding = store_embedding_if_missing(db, candidate)
        if candidate_embedding is None:
            continue
        score = _cosine_similarity(query_embedding, candidate_embedding)
        if score > best_score:
            best_score = score
            best_candidate = candidate

    if best_candidate is None:
        logger.info(
            "Semantic memory miss source_language=%s target_language=%s score=n/a reason=no_candidate_embeddings",
            source_language,
            target_language,
        )
        return None

    if best_score >= SEMANTIC_MEMORY_THRESHOLD:
        logger.info(
            "Semantic memory hit source_language=%s target_language=%s score=%.4f threshold=%.4f",
            source_language,
            target_language,
            best_score,
            SEMANTIC_MEMORY_THRESHOLD,
        )
        return TranslationMemoryMatch(
            approved=best_candidate,
            match_type="semantic",
            similarity=best_score,
        )

    logger.info(
        "Semantic memory miss source_language=%s target_language=%s score=%.4f threshold=%.4f",
        source_language,
        target_language,
        best_score,
        SEMANTIC_MEMORY_THRESHOLD,
    )
    return None
