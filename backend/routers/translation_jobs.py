import logging
import os
from pathlib import Path
from datetime import datetime
from collections import defaultdict

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import SessionLocal, get_db
from models import (
    ApprovedTranslation,
    Document,
    DocumentBlock,
    DocumentSegment,
    GlossaryTerm,
    ProcessingStageJob,
    SegmentAnnotation,
    TranslationJob,
    TranslationResult,
)
from schemas import (
    ExportResponse,
    ProcessingStageJobResponse,
    ReviewSummaryResponse,
    ReviewBlockResponse,
    ReviewSegmentResponse,
    SegmentAnnotationResponse,
    SegmentResponse,
    TranslationJobResponse,
    TranslationResultResponse,
    TranslationResultUpdateRequest,
)
from services.glossary import glossary_match_in_text, glossary_term_to_match, normalize_optional
from services.translation import SegmentContext, get_batch_size, get_translation_provider
from services.translation_memory import (
    TranslationMemoryMatch,
    find_exact_memory_match,
    find_semantic_memory_match,
    generate_source_embedding,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["translation-jobs"])

TRANSLATION_STAGE = "translation"
AMBIGUITY_STAGE = "ambiguity_detection"
RECONSTRUCTION_STAGE = "reconstruction"
EXPORT_DIR = Path(os.getenv("EXPORT_DIR", "exports"))


def _queue_stage_job(
    db: Session,
    document_id: int,
    translation_job_id: int,
    stage_name: str,
):
    stage_job = ProcessingStageJob(
        document_id=document_id,
        translation_job_id=translation_job_id,
        stage_name=stage_name,
        status="queued",
    )
    db.add(stage_job)
    return stage_job


def _run_translation_pipeline(translation_job_id: int):
    db = SessionLocal()
    try:
        job = db.query(TranslationJob).filter(TranslationJob.id == translation_job_id).first()
        if not job:
            return
        while True:
            stage_job = (
                db.query(ProcessingStageJob)
                .filter(
                    ProcessingStageJob.translation_job_id == translation_job_id,
                    ProcessingStageJob.status == "queued",
                )
                .order_by(ProcessingStageJob.id.asc())
                .first()
            )
            if not stage_job:
                return

            stage_job.status = "running"
            stage_job.attempt_count += 1
            stage_job.started_at = datetime.utcnow()
            stage_job.error_message = None
            db.commit()
            logger.info(
                "Stage start: stage=%s document_id=%d translation_job_id=%d attempt=%d",
                stage_job.stage_name,
                stage_job.document_id,
                translation_job_id,
                stage_job.attempt_count,
            )

            try:
                if stage_job.stage_name == TRANSLATION_STAGE:
                    _execute_translation_stage(db=db, translation_job_id=translation_job_id)
                elif stage_job.stage_name == AMBIGUITY_STAGE:
                    _execute_ambiguity_stage(db=db, translation_job_id=translation_job_id)
                elif stage_job.stage_name == RECONSTRUCTION_STAGE:
                    _execute_reconstruction_stage(db=db, translation_job_id=translation_job_id)
                else:
                    raise ValueError(f"Unknown stage: {stage_job.stage_name}")

                stage_job.status = "succeeded"
                stage_job.finished_at = datetime.utcnow()
                db.commit()
                logger.info(
                    "Stage success: stage=%s document_id=%d translation_job_id=%d",
                    stage_job.stage_name,
                    stage_job.document_id,
                    translation_job_id,
                )
            except Exception as exc:
                db.rollback()
                job = db.query(TranslationJob).filter(TranslationJob.id == translation_job_id).first()
                if job:
                    job.status = "failed"
                    job.error_message = str(exc)
                    document = db.query(Document).filter(Document.id == job.document_id).first()
                    if document:
                        document.status = "failed"
                        document.error_message = str(exc)
                failed_stage = db.query(ProcessingStageJob).filter(ProcessingStageJob.id == stage_job.id).first()
                if failed_stage:
                    failed_stage.status = "failed"
                    failed_stage.error_message = str(exc)
                    failed_stage.finished_at = datetime.utcnow()
                db.commit()
                logger.exception(
                    "Stage failure: stage=%s document_id=%d translation_job_id=%d",
                    stage_job.stage_name,
                    stage_job.document_id,
                    translation_job_id,
                )
                return
    finally:
        db.close()


def _get_glossary_candidates(
    db: Session,
    source_language: str,
    target_language: str,
    industry: str | None,
    domain: str | None,
) -> list[GlossaryTerm]:
    normalized_industry = normalize_optional(industry)
    normalized_domain = normalize_optional(domain)
    return (
        db.query(GlossaryTerm)
        .filter(
            GlossaryTerm.source_language == source_language,
            GlossaryTerm.target_language == target_language,
            GlossaryTerm.industry == normalized_industry,
            GlossaryTerm.domain == normalized_domain,
        )
        .order_by(GlossaryTerm.created_at.desc())
        .all()
    )


def _match_glossary_terms_for_segment(source_text: str, glossary_terms: list[GlossaryTerm]) -> list[dict]:
    matches = []
    for term in glossary_terms:
        if glossary_match_in_text(source_text, term.source_term):
            matches.append(glossary_term_to_match(term))
    return matches


def _build_glossary_matches_payload(glossary_matches: list[dict] | None) -> dict | None:
    if not glossary_matches:
        return None
    return {
        "matches": [
            {
                "source_term": str(match.get("source_term", "")).strip(),
                "target_term": str(match.get("target_term", "")).strip(),
            }
            for match in glossary_matches
            if str(match.get("source_term", "")).strip() and str(match.get("target_term", "")).strip()
        ]
    }


def _normalize_glossary_matches_payload(glossary_matches: object) -> dict | None:
    if glossary_matches is None:
        return None
    if isinstance(glossary_matches, dict):
        matches = glossary_matches.get("matches")
        if isinstance(matches, list):
            return _build_glossary_matches_payload(matches)
        return None
    if isinstance(glossary_matches, list):
        return _build_glossary_matches_payload(glossary_matches)
    return None


def _is_semantic_memory_result(result: TranslationResult) -> bool:
    return bool(getattr(result, "semantic_memory_used", False))


def _is_exact_memory_result(result: TranslationResult) -> bool:
    return bool(getattr(result, "exact_memory_used", False)) or getattr(result, "review_status", "") == "memory_match"


def _has_memory_signal(result: TranslationResult) -> bool:
    return _is_exact_memory_result(result) or _is_semantic_memory_result(result)


def _has_review_signal(result: TranslationResult) -> bool:
    return bool(getattr(result, "ambiguity_detected", False)) or bool(
        getattr(result, "glossary_applied", False)
    ) or _has_memory_signal(result)


def _is_flagged_result(result: TranslationResult) -> bool:
    if _is_acceptable_final_status(getattr(result, "review_status", "")):
        return False
    return _has_review_signal(result)


def _serialize_translation_result(result: TranslationResult, segment: DocumentSegment | None) -> TranslationResultResponse:
    seg_resp = SegmentResponse.model_validate(segment) if segment else None
    return TranslationResultResponse(
        id=result.id,
        job_id=result.job_id,
        segment_id=result.segment_id,
        primary_translation=result.primary_translation,
        final_translation=result.final_translation,
        confidence_score=result.confidence_score,
        review_status=result.review_status,
        exact_memory_used=_is_exact_memory_result(result),
        semantic_memory_used=_is_semantic_memory_result(result),
        ambiguity_detected=getattr(result, "ambiguity_detected", False) or False,
        ambiguity_details=getattr(result, "ambiguity_details", None),
        glossary_applied=getattr(result, "glossary_applied", False) or False,
        glossary_matches=_normalize_glossary_matches_payload(getattr(result, "glossary_matches", None)),
        created_at=result.created_at,
        segment=seg_resp,
    )


def _find_span(text: str, needle: str) -> tuple[int, int] | None:
    text_value = (text or "").strip()
    needle_value = (needle or "").strip()
    if not text_value or not needle_value:
        return None
    start = text_value.lower().find(needle_value.lower())
    if start == -1:
        return None
    return start, start + len(needle_value)


def _add_annotation(
    annotations: list[SegmentAnnotation],
    segment_id: int,
    annotation_type: str,
    source_text: str,
    source_span_text: str,
    target_text: str,
    target_span_text: str | None,
    metadata_json: dict | None = None,
):
    source_span = _find_span(source_text, source_span_text)
    if not source_span:
        return

    target_span = _find_span(target_text, target_span_text) if target_span_text else None
    annotations.append(
        SegmentAnnotation(
            segment_id=segment_id,
            annotation_type=annotation_type,
            source_span_text=source_span_text,
            source_start=source_span[0],
            source_end=source_span[1],
            target_span_text=target_span_text,
            target_start=target_span[0] if target_span else None,
            target_end=target_span[1] if target_span else None,
            metadata_json=metadata_json,
        )
    )


def _build_segment_annotations(
    segment: DocumentSegment,
    result: TranslationResult,
) -> list[SegmentAnnotation]:
    annotations: list[SegmentAnnotation] = []
    source_text = segment.source_text
    target_text = result.final_translation
    glossary_matches = _normalize_glossary_matches_payload(getattr(result, "glossary_matches", None))

    if glossary_matches:
        for match in glossary_matches.get("matches", []):
            source_term = str(match.get("source_term", "")).strip()
            target_term = str(match.get("target_term", "")).strip()
            if not source_term:
                continue
            _add_annotation(
                annotations=annotations,
                segment_id=segment.id,
                annotation_type="glossary",
                source_text=source_text,
                source_span_text=source_term,
                target_text=target_text,
                target_span_text=target_term or None,
                metadata_json={
                    "source_term": source_term,
                    "target_term": target_term or None,
                },
            )

    if getattr(result, "ambiguity_detected", False) and getattr(result, "ambiguity_details", None):
        ambiguity_details = result.ambiguity_details or {}
        source_span_text = str(ambiguity_details.get("source_span", "")).strip()
        target_span_text = None
        for alternative in ambiguity_details.get("alternatives", []):
            candidate = str(alternative.get("translation", "")).strip()
            if candidate and _find_span(target_text, candidate):
                target_span_text = candidate
                break
        if source_span_text:
            _add_annotation(
                annotations=annotations,
                segment_id=segment.id,
                annotation_type="ambiguity",
                source_text=source_text,
                source_span_text=source_span_text,
                target_text=target_text,
                target_span_text=target_span_text,
                metadata_json=ambiguity_details,
            )

    if _is_exact_memory_result(result):
        _add_annotation(
            annotations=annotations,
            segment_id=segment.id,
            annotation_type="exact_memory",
            source_text=source_text,
            source_span_text=source_text,
            target_text=target_text,
            target_span_text=target_text,
            metadata_json={"label": "Previously approved translation reused"},
        )

    if _is_semantic_memory_result(result):
        _add_annotation(
            annotations=annotations,
            segment_id=segment.id,
            annotation_type="semantic_memory",
            source_text=source_text,
            source_span_text=source_text,
            target_text=target_text,
            target_span_text=target_text,
            metadata_json={
                "label": "Similar approved translation reused",
                "confidence_score": result.confidence_score,
            },
        )

    return annotations


def _replace_segment_annotations(db: Session, segment: DocumentSegment, result: TranslationResult):
    db.query(SegmentAnnotation).filter(SegmentAnnotation.segment_id == segment.id).delete()
    annotations = _build_segment_annotations(segment, result)
    if annotations:
        db.add_all(annotations)


def _compose_block_translation(block_type: str, parts: list[str]) -> str | None:
    cleaned = [part.strip() for part in parts if part and part.strip()]
    if not cleaned:
        return None
    separator = "\n" if block_type == "bullet_item" else " "
    return separator.join(cleaned)


def _refresh_document_block_translation(db: Session, block_id: int, job_id: int):
    block = db.query(DocumentBlock).filter(DocumentBlock.id == block_id).first()
    if not block:
        return

    segments = (
        db.query(DocumentSegment)
        .filter(DocumentSegment.block_id == block_id)
        .order_by(DocumentSegment.segment_index)
        .all()
    )
    translated_parts = []
    for segment in segments:
        result = (
            db.query(TranslationResult)
            .filter(TranslationResult.job_id == job_id, TranslationResult.segment_id == segment.id)
            .first()
        )
        if result and result.final_translation.strip():
            translated_parts.append(result.final_translation)
    block.text_translated = _compose_block_translation(block.block_type, translated_parts)


def _serialize_review_segment(
    segment: DocumentSegment,
    result: TranslationResult,
    annotations: list[SegmentAnnotation],
) -> ReviewSegmentResponse:
    return ReviewSegmentResponse(
        id=result.id,
        segment_id=segment.id,
        block_id=segment.block_id,
        segment_index=segment.segment_index,
        segment_type=segment.segment_type,
        source_text=segment.source_text,
        primary_translation=result.primary_translation,
        final_translation=result.final_translation,
        confidence_score=result.confidence_score,
        review_status=result.review_status,
        exact_memory_used=_is_exact_memory_result(result),
        semantic_memory_used=_is_semantic_memory_result(result),
        ambiguity_detected=getattr(result, "ambiguity_detected", False) or False,
        ambiguity_details=getattr(result, "ambiguity_details", None),
        glossary_applied=getattr(result, "glossary_applied", False) or False,
        glossary_matches=_normalize_glossary_matches_payload(getattr(result, "glossary_matches", None)),
        annotations=[SegmentAnnotationResponse.model_validate(annotation) for annotation in annotations],
    )


def _is_acceptable_final_status(review_status: str) -> bool:
    # "reviewed" is kept as a backward-compatible alias for older saved data.
    return review_status in {"approved", "edited", "memory_match", "reviewed"}


def _calculate_review_summary(db: Session, job: TranslationJob) -> ReviewSummaryResponse:
    results = db.query(TranslationResult).filter(TranslationResult.job_id == job.id).all()
    total_segments = len(results)
    approved_segments = sum(1 for result in results if result.review_status == "approved")
    edited_segments = sum(1 for result in results if result.review_status == "edited")
    unresolved_count = sum(1 for result in results if not _is_acceptable_final_status(result.review_status))
    unresolved_ambiguities = sum(
        1
        for result in results
        if bool(result.ambiguity_detected) and not _is_acceptable_final_status(result.review_status)
    )
    unresolved_semantic_reviews = sum(
        1
        for result in results
        if bool(result.semantic_memory_used) and not _is_acceptable_final_status(result.review_status)
    )
    safe_unresolved_segments = sum(
        1
        for result in results
        if not _is_acceptable_final_status(result.review_status)
        and not bool(result.ambiguity_detected)
        and not bool(result.semantic_memory_used)
        and bool((result.final_translation or "").strip())
    )
    review_complete = (
        total_segments > 0
        and unresolved_count == 0
        and unresolved_ambiguities == 0
        and unresolved_semantic_reviews == 0
    )
    can_mark_ready_for_export = review_complete
    overall_status = (
        job.status if job.status in {"in_review", "draft_saved", "ready_for_export", "exported"} else "in_review"
    )
    return ReviewSummaryResponse(
        job_id=job.id,
        total_segments=total_segments,
        approved_segments=approved_segments,
        edited_segments=edited_segments,
        safe_unresolved_segments=safe_unresolved_segments,
        review_complete=review_complete,
        unresolved_count=unresolved_count,
        unresolved_ambiguities=unresolved_ambiguities,
        unresolved_semantic_reviews=unresolved_semantic_reviews,
        unresolved_segments=unresolved_count,
        ambiguity_count=unresolved_ambiguities,
        semantic_memory_review_count=unresolved_semantic_reviews,
        overall_status=overall_status,
        last_saved_at=job.last_saved_at,
        can_mark_ready_for_export=can_mark_ready_for_export,
    )


def _build_export_text(db: Session, job: TranslationJob) -> str:
    blocks = (
        db.query(DocumentBlock)
        .filter(DocumentBlock.document_id == job.document_id)
        .order_by(DocumentBlock.block_index)
        .all()
    )
    segments = (
        db.query(DocumentSegment)
        .filter(DocumentSegment.document_id == job.document_id)
        .order_by(DocumentSegment.segment_index)
        .all()
    )
    results = db.query(TranslationResult).filter(TranslationResult.job_id == job.id).all()
    result_by_segment_id = {result.segment_id: result for result in results}
    segments_by_block_id: dict[int | None, list[DocumentSegment]] = defaultdict(list)
    for segment in segments:
        segments_by_block_id[segment.block_id].append(segment)

    output_lines: list[str] = []
    for block in blocks:
        block_segments = segments_by_block_id.get(block.id, [])
        translated_parts: list[str] = []
        for segment in block_segments:
            result = result_by_segment_id.get(segment.id)
            if not result:
                continue
            translated_parts.append((result.final_translation or "").strip())
        translated_text = _compose_block_translation(block.block_type, translated_parts) or ""
        translated_text = translated_text.strip()
        if not translated_text:
            continue
        if block.block_type == "bullet_item":
            output_lines.append(f"- {translated_text}")
        else:
            output_lines.append(translated_text)
        output_lines.append("")
    return "\n".join(output_lines).strip() + "\n"


def _execute_translation_stage(db: Session, translation_job_id: int):
    job = db.query(TranslationJob).filter(TranslationJob.id == translation_job_id).first()
    if not job:
        raise ValueError("Translation job not found")
    doc = db.query(Document).filter(Document.id == job.document_id).first()
    if not doc:
        raise ValueError("Document not found")

    doc.status = "translating"
    doc.error_message = None
    job.status = "translating"
    job.error_message = None
    db.commit()

    segments = (
        db.query(DocumentSegment)
        .filter(DocumentSegment.document_id == doc.id)
        .order_by(DocumentSegment.segment_index)
        .all()
    )
    if not segments:
        raise ValueError("Document has no segmented content to translate")

    provider, provider_name = get_translation_provider()
    batch_size = get_batch_size()
    source_lang = doc.source_language or "unknown"
    glossary_candidates = _get_glossary_candidates(
        db=db,
        source_language=source_lang,
        target_language=doc.target_language,
        industry=doc.industry,
        domain=doc.domain,
    )
    logger.info(
        "Translation stage start: provider=%s batch_size=%d segments=%d document_id=%d job_id=%d",
        provider_name,
        batch_size,
        len(segments),
        doc.id,
        translation_job_id,
    )

    db.query(TranslationResult).filter(TranslationResult.job_id == translation_job_id).delete(
        synchronize_session=False
    )
    db.commit()

    translated_results: list[tuple[DocumentSegment, object, str | None, float | None, list[dict]]] = []
    for i in range(0, len(segments), batch_size):
        batch = segments[i : i + batch_size]
        memory_matches: dict[int, TranslationMemoryMatch] = {}
        missing_segments: list[DocumentSegment] = []
        glossary_matches_by_segment: dict[int, list[dict]] = {}

        for s in batch:
            glossary_matches_by_segment[s.id] = _match_glossary_terms_for_segment(
                source_text=s.source_text,
                glossary_terms=glossary_candidates,
            )
            exact_match = find_exact_memory_match(
                db=db,
                source_text=s.source_text,
                source_language=source_lang,
                target_language=doc.target_language,
                industry=doc.industry,
                domain=doc.domain,
            )
            if exact_match:
                memory_matches[s.id] = TranslationMemoryMatch(
                    approved=exact_match,
                    match_type="exact",
                    similarity=1.0,
                )
                continue

            semantic_match = find_semantic_memory_match(
                db=db,
                source_text=s.source_text,
                source_language=source_lang,
                target_language=doc.target_language,
                industry=doc.industry,
                domain=doc.domain,
            )
            if semantic_match:
                memory_matches[s.id] = semantic_match
                continue
            missing_segments.append(s)

        provider_results_by_segment_id: dict[int, object] = {}
        if missing_segments:
            batch_ctx = [
                SegmentContext(
                    segment_id=s.id,
                    source_text=s.source_text,
                    context_before=s.context_before,
                    context_after=s.context_after,
                    glossary_terms=glossary_matches_by_segment.get(s.id, []),
                )
                for s in missing_segments
            ]
            try:
                results = provider.translate_batch(
                    segments=batch_ctx,
                    source_language=source_lang,
                    target_language=doc.target_language,
                    industry=doc.industry,
                    domain=doc.domain,
                )
            except Exception as batch_err:
                logger.warning(
                    "Stage fallback: batch translation failed for job=%d, falling back to single segments: %s",
                    translation_job_id,
                    batch_err,
                )
                results = [
                    provider.translate(
                        source_text=s.source_text,
                        source_language=source_lang,
                        target_language=doc.target_language,
                        industry=doc.industry,
                        domain=doc.domain,
                        context_before=s.context_before,
                        context_after=s.context_after,
                        glossary_terms=glossary_matches_by_segment.get(s.id, []),
                    )
                    for s in missing_segments
                ]
            for seg, res in zip(missing_segments, results, strict=True):
                provider_results_by_segment_id[seg.id] = res

        for seg in batch:
            if seg.id in memory_matches:
                match = memory_matches[seg.id]
                translated_results.append(
                    (seg, match.approved, match.match_type, match.similarity, glossary_matches_by_segment.get(seg.id, []))
                )
            else:
                translated_results.append(
                    (seg, provider_results_by_segment_id[seg.id], None, None, glossary_matches_by_segment.get(seg.id, []))
                )

    for seg, res, memory_type, similarity, glossary_matches in translated_results:
        if memory_type:
            approved = res
            result = TranslationResult(
                job_id=translation_job_id,
                segment_id=seg.id,
                primary_translation=approved.approved_translation,
                final_translation=approved.approved_translation,
                confidence_score=similarity,
                review_status="memory_match" if memory_type == "exact" else "semantic_memory_match",
                exact_memory_used=memory_type == "exact",
                semantic_memory_used=memory_type == "semantic",
                ambiguity_detected=False,
                ambiguity_details=None,
                glossary_applied=False,
                glossary_matches=None,
            )
        else:
            result = TranslationResult(
                job_id=translation_job_id,
                segment_id=seg.id,
                primary_translation=res.primary_translation,
                final_translation=res.primary_translation,
                confidence_score=None,
                review_status="unreviewed",
                exact_memory_used=False,
                semantic_memory_used=False,
                ambiguity_detected=res.ambiguity_detected,
                ambiguity_details=res.ambiguity_details,
                glossary_applied=bool(glossary_matches),
                glossary_matches=_build_glossary_matches_payload(glossary_matches),
            )
        db.add(result)

    job = db.query(TranslationJob).filter(TranslationJob.id == translation_job_id).first()
    doc = db.query(Document).filter(Document.id == job.document_id).first()
    job.translation_provider = provider_name
    job.translation_batch_size = batch_size
    job.status = "translated"
    job.error_message = None
    doc.status = "translated"
    doc.error_message = None
    db.commit()


def _execute_ambiguity_stage(db: Session, translation_job_id: int):
    job = db.query(TranslationJob).filter(TranslationJob.id == translation_job_id).first()
    if not job:
        raise ValueError("Translation job not found")

    results = db.query(TranslationResult).filter(TranslationResult.job_id == translation_job_id).all()
    segments_by_id = {
        segment.id: segment
        for segment in db.query(DocumentSegment).filter(DocumentSegment.document_id == job.document_id).all()
    }
    for result in results:
        segment = segments_by_id.get(result.segment_id)
        if not segment:
            continue
        _replace_segment_annotations(db, segment, result)
    db.commit()


def _execute_reconstruction_stage(db: Session, translation_job_id: int):
    job = db.query(TranslationJob).filter(TranslationJob.id == translation_job_id).first()
    if not job:
        raise ValueError("Translation job not found")
    doc = db.query(Document).filter(Document.id == job.document_id).first()
    if not doc:
        raise ValueError("Document not found")

    touched_block_ids: set[int] = set()
    segments = db.query(DocumentSegment).filter(DocumentSegment.document_id == doc.id).all()
    for segment in segments:
        if segment.block_id is not None:
            touched_block_ids.add(segment.block_id)
    for block_id in touched_block_ids:
        _refresh_document_block_translation(db, block_id, translation_job_id)

    job.status = "in_review"
    job.error_message = None
    doc.status = "in_review"
    doc.error_message = None
    db.commit()


@router.post("/documents/{document_id}/translation-jobs", response_model=TranslationJobResponse)
def create_translation_job(
    document_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Create a translation job and queue staged background processing."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.status not in {"segmented", "in_review", "draft_saved", "ready_for_export", "failed"}:
        raise HTTPException(
            status_code=400,
            detail="Document must be segmented before creating a translation job",
        )

    segments = (
        db.query(DocumentSegment)
        .filter(DocumentSegment.document_id == document_id)
        .order_by(DocumentSegment.segment_index)
        .all()
    )
    if not segments:
        raise HTTPException(
            status_code=400,
            detail="Document has no parsed segments",
        )

    source_lang = doc.source_language or "unknown"
    job = TranslationJob(
        document_id=document_id,
        source_language=source_lang,
        target_language=doc.target_language,
        industry=doc.industry,
        domain=doc.domain,
        status="translation_queued",
        translation_provider=None,
        translation_batch_size=None,
        error_message=None,
        last_saved_at=None,
    )
    db.add(job)
    db.flush()
    _queue_stage_job(db, document_id=document_id, translation_job_id=job.id, stage_name=TRANSLATION_STAGE)
    _queue_stage_job(db, document_id=document_id, translation_job_id=job.id, stage_name=AMBIGUITY_STAGE)
    _queue_stage_job(db, document_id=document_id, translation_job_id=job.id, stage_name=RECONSTRUCTION_STAGE)
    doc.status = "translation_queued"
    doc.error_message = None
    db.commit()
    db.refresh(job)
    background_tasks.add_task(_run_translation_pipeline, job.id)
    return job


@router.get("/translation-jobs/{job_id}", response_model=TranslationJobResponse)
def get_translation_job(job_id: int, db: Session = Depends(get_db)):
    """Get a translation job by id."""
    job = db.query(TranslationJob).filter(TranslationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Translation job not found")
    return job


@router.get("/translation-jobs/{job_id}/results", response_model=list[TranslationResultResponse])
def list_translation_results(
    job_id: int,
    filter: str = Query(default="all"),
    db: Session = Depends(get_db),
):
    """List translation results for a job."""
    job = db.query(TranslationJob).filter(TranslationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Translation job not found")
    if filter not in {"all", "ambiguities", "semantic-memory", "glossary", "memory", "flagged"}:
        raise HTTPException(status_code=400, detail="Invalid filter value")
    results = (
        db.query(TranslationResult)
        .join(DocumentSegment, TranslationResult.segment_id == DocumentSegment.id)
        .filter(TranslationResult.job_id == job_id)
        .order_by(DocumentSegment.segment_index)
        .all()
    )
    # Load segment for each result to include source text
    out = []
    for r in results:
        if filter == "ambiguities" and not getattr(r, "ambiguity_detected", False):
            continue
        if filter == "ambiguities" and _is_acceptable_final_status(getattr(r, "review_status", "")):
            continue
        if filter == "semantic-memory" and not _is_semantic_memory_result(r):
            continue
        if filter == "semantic-memory" and _is_acceptable_final_status(getattr(r, "review_status", "")):
            continue
        if filter == "glossary" and not getattr(r, "glossary_applied", False):
            continue
        if filter == "glossary" and _is_acceptable_final_status(getattr(r, "review_status", "")):
            continue
        if filter == "memory" and not _has_memory_signal(r):
            continue
        if filter == "memory" and _is_acceptable_final_status(getattr(r, "review_status", "")):
            continue
        if filter == "flagged" and not _is_flagged_result(r):
            continue
        seg = db.query(DocumentSegment).filter(DocumentSegment.id == r.segment_id).first()
        out.append(_serialize_translation_result(r, seg))
    return out


@router.get("/translation-jobs/{job_id}/review-blocks", response_model=list[ReviewBlockResponse])
def list_review_blocks(job_id: int, db: Session = Depends(get_db)):
    """Return translated document blocks with nested segment results and annotations."""
    job = db.query(TranslationJob).filter(TranslationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Translation job not found")

    blocks = (
        db.query(DocumentBlock)
        .filter(DocumentBlock.document_id == job.document_id)
        .order_by(DocumentBlock.block_index)
        .all()
    )
    segments = (
        db.query(DocumentSegment)
        .filter(DocumentSegment.document_id == job.document_id)
        .order_by(DocumentSegment.segment_index)
        .all()
    )
    results = (
        db.query(TranslationResult)
        .filter(TranslationResult.job_id == job_id)
        .all()
    )

    results_by_segment_id = {result.segment_id: result for result in results}
    annotations = (
        db.query(SegmentAnnotation)
        .join(DocumentSegment, SegmentAnnotation.segment_id == DocumentSegment.id)
        .filter(DocumentSegment.document_id == job.document_id)
        .order_by(SegmentAnnotation.id)
        .all()
    )
    annotations_by_segment_id: dict[int, list[SegmentAnnotation]] = defaultdict(list)
    for annotation in annotations:
        annotations_by_segment_id[annotation.segment_id].append(annotation)

    segments_by_block_id: dict[int | None, list[DocumentSegment]] = defaultdict(list)
    for segment in segments:
        segments_by_block_id[segment.block_id].append(segment)

    review_blocks: list[ReviewBlockResponse] = []
    for block in blocks:
        block_segments = []
        translated_parts: list[str] = []
        for segment in segments_by_block_id.get(block.id, []):
            result = results_by_segment_id.get(segment.id)
            if not result:
                continue
            block_segments.append(
                _serialize_review_segment(
                    segment=segment,
                    result=result,
                    annotations=annotations_by_segment_id.get(segment.id, []),
                )
            )
            translated_parts.append(result.final_translation)

        review_blocks.append(
            ReviewBlockResponse(
                id=block.id,
                document_id=block.document_id,
                block_index=block.block_index,
                block_type=block.block_type,
                text_original=block.text_original,
                text_translated=_compose_block_translation(block.block_type, translated_parts) or block.text_translated,
                formatting_json=block.formatting_json,
                segments=block_segments,
            )
        )

    return review_blocks


@router.get("/translation-jobs/{job_id}/review-summary", response_model=ReviewSummaryResponse)
def get_review_summary(job_id: int, db: Session = Depends(get_db)):
    job = db.query(TranslationJob).filter(TranslationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Translation job not found")
    return _calculate_review_summary(db, job)


@router.post("/translation-jobs/{job_id}/save-draft", response_model=ReviewSummaryResponse)
def save_review_draft(job_id: int, db: Session = Depends(get_db)):
    job = db.query(TranslationJob).filter(TranslationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Translation job not found")
    if job.status == "exported":
        raise HTTPException(status_code=400, detail="Cannot save draft after export")

    doc = db.query(Document).filter(Document.id == job.document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    job.status = "draft_saved"
    job.last_saved_at = datetime.utcnow()
    doc.status = "draft_saved"
    db.commit()
    db.refresh(job)
    return _calculate_review_summary(db, job)


@router.post("/translation-jobs/{job_id}/approve-safe-segments", response_model=ReviewSummaryResponse)
def approve_safe_segments(job_id: int, db: Session = Depends(get_db)):
    job = db.query(TranslationJob).filter(TranslationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Translation job not found")
    if job.status == "exported":
        raise HTTPException(status_code=400, detail="Cannot approve segments after export")

    doc = db.query(Document).filter(Document.id == job.document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    results = db.query(TranslationResult).filter(TranslationResult.job_id == job.id).all()
    changed = 0
    for result in results:
        if _is_acceptable_final_status(result.review_status):
            continue
        if bool(result.ambiguity_detected):
            continue
        if bool(result.semantic_memory_used):
            continue
        if not (result.final_translation or "").strip():
            continue
        result.review_status = "approved"
        changed += 1

    if changed > 0 and job.status not in {"ready_for_export", "exported"}:
        job.status = "in_review"
        doc.status = "in_review"

    db.commit()
    logger.info("Bulk approved safe segments for translation_job_id=%d count=%d", job.id, changed)
    return _calculate_review_summary(db, job)


@router.post("/translation-jobs/{job_id}/ready-for-export", response_model=ReviewSummaryResponse)
def mark_ready_for_export(job_id: int, db: Session = Depends(get_db)):
    job = db.query(TranslationJob).filter(TranslationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Translation job not found")
    if job.status == "exported":
        raise HTTPException(status_code=400, detail="Job is already exported")

    summary = _calculate_review_summary(db, job)
    if not summary.review_complete:
        raise HTTPException(
            status_code=400,
            detail="All required review items must be resolved before marking ready for export",
        )

    doc = db.query(Document).filter(Document.id == job.document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    job.status = "ready_for_export"
    doc.status = "ready_for_export"
    db.commit()
    db.refresh(job)
    return _calculate_review_summary(db, job)


@router.post("/translation-jobs/{job_id}/mark-ready", response_model=ReviewSummaryResponse)
def mark_ready_for_export_alias(job_id: int, db: Session = Depends(get_db)):
    return mark_ready_for_export(job_id=job_id, db=db)


@router.post("/translation-jobs/{job_id}/export", response_model=ExportResponse)
def export_translation_job(
    job_id: int,
    export_format: str = Query(default="txt"),
    db: Session = Depends(get_db),
):
    job = db.query(TranslationJob).filter(TranslationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Translation job not found")
    if export_format.lower() != "txt":
        raise HTTPException(status_code=400, detail="Only txt export is supported currently")
    if job.status != "ready_for_export":
        raise HTTPException(status_code=400, detail="Job must be ready_for_export before export")

    doc = db.query(Document).filter(Document.id == job.document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    safe_stem = Path(doc.filename).stem or f"document-{doc.id}"
    filename = f"{safe_stem}-job-{job.id}.txt"
    filepath = EXPORT_DIR / filename
    filepath.write_text(_build_export_text(db, job), encoding="utf-8")

    job.status = "exported"
    doc.status = "exported"
    db.commit()
    return ExportResponse(
        job_id=job.id,
        status=job.status,
        export_format="txt",
        filename=filename,
        download_url=f"/api/translation-jobs/{job.id}/exports/{filename}",
    )


@router.get("/translation-jobs/{job_id}/exports/{filename}")
def download_export(job_id: int, filename: str, db: Session = Depends(get_db)):
    job = db.query(TranslationJob).filter(TranslationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Translation job not found")

    filepath = (EXPORT_DIR / filename).resolve()
    export_root = EXPORT_DIR.resolve()
    if not str(filepath).startswith(str(export_root)):
        raise HTTPException(status_code=400, detail="Invalid export filename")
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(status_code=404, detail="Export file not found")

    return FileResponse(path=str(filepath), filename=filename, media_type="text/plain")


@router.patch("/translation-results/{result_id}", response_model=TranslationResultResponse)
def update_translation_result(
    result_id: int,
    body: TranslationResultUpdateRequest,
    db: Session = Depends(get_db),
):
    """Save a reviewed translation result and record approved choices only."""
    result = db.query(TranslationResult).filter(TranslationResult.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Translation result not found")

    job = db.query(TranslationJob).filter(TranslationJob.id == result.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Translation job not found")

    segment = db.query(DocumentSegment).filter(DocumentSegment.id == result.segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Document segment not found")

    final_translation = body.final_translation.strip()
    review_status = body.review_status.strip()
    if not final_translation:
        raise HTTPException(status_code=400, detail="final_translation is required")
    if not review_status:
        raise HTTPException(status_code=400, detail="review_status is required")

    result.final_translation = final_translation
    result.review_status = review_status

    if review_status == "approved":
        embedding = generate_source_embedding(segment.source_text)
        approved = ApprovedTranslation(
            source_text=segment.source_text,
            approved_translation=final_translation,
            source_language=job.source_language,
            target_language=job.target_language,
            industry=job.industry,
            domain=job.domain,
            source_embedding=embedding,
        )
        db.add(approved)

    _replace_segment_annotations(db, segment, result)
    if segment.block_id is not None:
        _refresh_document_block_translation(db, segment.block_id, result.job_id)
    if job.status not in {"ready_for_export", "exported"}:
        job.status = "in_review"
        document = db.query(Document).filter(Document.id == job.document_id).first()
        if document:
            document.status = "in_review"
    db.commit()
    db.refresh(result)

    if review_status == "approved":
        logger.info(
            "Saved reviewed translation result_id=%d review_status=%s and stored approved translation",
            result.id,
            result.review_status,
        )
    else:
        logger.info(
            "Saved reviewed translation result_id=%d review_status=%s without storing translation memory",
            result.id,
            result.review_status,
        )

    return TranslationResultResponse(
        id=result.id,
        job_id=result.job_id,
        segment_id=result.segment_id,
        primary_translation=result.primary_translation,
        final_translation=result.final_translation,
        confidence_score=result.confidence_score,
        review_status=result.review_status,
        exact_memory_used=_is_exact_memory_result(result),
        semantic_memory_used=_is_semantic_memory_result(result),
        ambiguity_detected=getattr(result, "ambiguity_detected", False) or False,
        ambiguity_details=getattr(result, "ambiguity_details", None),
        glossary_applied=getattr(result, "glossary_applied", False) or False,
        glossary_matches=_normalize_glossary_matches_payload(getattr(result, "glossary_matches", None)),
        created_at=result.created_at,
        segment=SegmentResponse.model_validate(segment),
    )


@router.get("/translation-jobs/{job_id}/stages", response_model=list[ProcessingStageJobResponse])
def list_translation_stage_jobs(job_id: int, db: Session = Depends(get_db)):
    job = db.query(TranslationJob).filter(TranslationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Translation job not found")
    return (
        db.query(ProcessingStageJob)
        .filter(ProcessingStageJob.translation_job_id == job_id)
        .order_by(ProcessingStageJob.id.asc())
        .all()
    )


@router.post("/translation-jobs/{job_id}/retry", response_model=TranslationJobResponse)
def retry_translation_job(job_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    job = db.query(TranslationJob).filter(TranslationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Translation job not found")

    failed_jobs = (
        db.query(ProcessingStageJob)
        .filter(
            ProcessingStageJob.translation_job_id == job_id,
            ProcessingStageJob.status == "failed",
        )
        .all()
    )
    if not failed_jobs:
        raise HTTPException(status_code=400, detail="No failed stage to retry")

    for stage_job in failed_jobs:
        if stage_job.attempt_count >= stage_job.max_attempts:
            raise HTTPException(status_code=400, detail="One or more stages exceeded retry limit")
        stage_job.status = "queued"
        stage_job.error_message = None
        stage_job.started_at = None
        stage_job.finished_at = None

    job.status = "translation_queued"
    job.error_message = None
    document = db.query(Document).filter(Document.id == job.document_id).first()
    if document:
        document.status = "translation_queued"
        document.error_message = None
    db.commit()
    db.refresh(job)
    logger.info("Retry queued for translation_job_id=%d with %d failed stages", job_id, len(failed_jobs))
    background_tasks.add_task(_run_translation_pipeline, job.id)
    return job


@router.get("/documents/{document_id}/translation-jobs", response_model=list[TranslationJobResponse])
def list_document_translation_jobs(document_id: int, db: Session = Depends(get_db)):
    """List translation jobs for a document."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    jobs = (
        db.query(TranslationJob)
        .filter(TranslationJob.document_id == document_id)
        .order_by(TranslationJob.created_at.desc())
        .all()
    )
    return jobs
