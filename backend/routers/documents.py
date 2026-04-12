import hashlib
import os
import tempfile
import types
import uuid
import logging
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from database import SessionLocal, get_db
from models import Document, DocumentBlock, DocumentSegment, Organisation, ProcessingStageJob, Project, SegmentAnnotation, TranslationJob
from schemas import (
    DocumentProgressResponse,
    DocumentBlockResponse,
    DocumentResponse,
    DocumentSourceLanguageUpdate,
    ProcessingStageJobResponse,
    SegmentResponse,
)
from fastapi.responses import JSONResponse
from services.auth import get_current_active_user, get_current_org
from services.language_detection import detect_language
from services.parser import parse_document, split_block_into_segments
from services.storage import get_storage
from services.usage import DOCUMENT_INGESTED, record_event
from services.zip_handler import unpack_zip
from tasks import run_document_pipeline
from limiter import limiter


router = APIRouter(
    prefix="/documents",
    tags=["documents"],
    dependencies=[Depends(get_current_active_user)],
)
logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".docx", ".txt", ".rtf"}
ALLOWED_EXTENSIONS_WITH_ZIP = ALLOWED_EXTENSIONS | {".zip"}
ALLOWED_SOURCE_LANGUAGES = {"en", "de", "fr", "es", "it", "nl", "pt", "zh", "ja", "ko", "ar"}
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
DEFAULT_CUSTOMER_ID = os.getenv("DEFAULT_CUSTOMER_ID", "default")
PARSING_STAGE = "parsing"
SEGMENT_STAGE = "segmenting"
PARSE_FAILED_STATUS = "parse_failed"
PARSED_STATUS = "parsed"
PARSING_STATUS = "parsing"
ACTIVE_TRANSLATION_JOB_STATUSES = {
    "translation_queued",
    "translating",
    "in_review",
    "draft_saved",
    "review_complete",
    "ready_for_export",
    "exported",
}


class _ImmediateBackgroundTasks:
    def add_task(self, func, *args, **kwargs):
        func(*args, **kwargs)


def _queue_stage_job(
    db: Session,
    document_id: int,
    stage_name: str,
    translation_job_id: int | None = None,
):
    stage_job = ProcessingStageJob(
        document_id=document_id,
        translation_job_id=translation_job_id,
        stage_name=stage_name,
        status="queued",
    )
    db.add(stage_job)
    return stage_job


def _run_document_pipeline(document_id: int, user_id: int | None = None):
    db = SessionLocal()
    try:
        while True:
            stage_job = (
                db.query(ProcessingStageJob)
                .filter(
                    ProcessingStageJob.document_id == document_id,
                    ProcessingStageJob.translation_job_id.is_(None),
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
            doc = db.query(Document).filter(Document.id == document_id).first()
            if doc and doc.status != PARSE_FAILED_STATUS:
                doc.status = PARSING_STATUS
            db.commit()
            logger.info(
                "Stage start: stage=%s document_id=%d attempt=%d",
                stage_job.stage_name,
                document_id,
                stage_job.attempt_count,
            )

            try:
                if stage_job.stage_name == PARSING_STAGE:
                    _execute_parsing_stage(db, document_id)
                elif stage_job.stage_name == SEGMENT_STAGE:
                    _execute_segment_stage(db, document_id)
                else:
                    raise ValueError(f"Unknown stage: {stage_job.stage_name}")

                stage_job.status = "succeeded"
                stage_job.finished_at = datetime.utcnow()
                db.commit()
                logger.info("Stage success: stage=%s document_id=%d", stage_job.stage_name, document_id)
                if stage_job.stage_name == SEGMENT_STAGE:
                    _doc = db.query(Document).filter(Document.id == document_id).first()
                    record_event(db, DOCUMENT_INGESTED, user_id=user_id, document_id=document_id, org_id=_doc.org_id if _doc else None)
            except Exception as exc:
                db.rollback()
                doc = db.query(Document).filter(Document.id == document_id).first()
                if doc:
                    doc.status = PARSE_FAILED_STATUS
                    doc.error_message = str(exc)
                failed_stage = db.query(ProcessingStageJob).filter(ProcessingStageJob.id == stage_job.id).first()
                if failed_stage:
                    failed_stage.status = "failed"
                    failed_stage.error_message = str(exc)
                    failed_stage.finished_at = datetime.utcnow()
                db.commit()
                logger.exception("Stage failure: stage=%s document_id=%d", stage_job.stage_name, document_id)
                return
    finally:
        db.close()


def _run_default_upload_to_review_pipeline(document_id: int, translation_style: str = "natural", user_id: int | None = None, org_id: int | None = None):
    """Happy-path orchestration: parse document, then create and execute translation job."""
    db = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            return

        immediate_tasks = _ImmediateBackgroundTasks()
        _mock_user = types.SimpleNamespace(id=user_id) if user_id is not None else None
        _mock_org = types.SimpleNamespace(id=org_id) if org_id is not None else None
        if doc.status in {"uploaded", PARSE_FAILED_STATUS}:
            parse_document_by_id(document_id=document_id, background_tasks=immediate_tasks, db=db, current_user=_mock_user, current_org=_mock_org)
            db.expire_all()
            doc = db.query(Document).filter(Document.id == document_id).first()
            if not doc:
                return

        if doc.status == PARSE_FAILED_STATUS:
            logger.warning("Auto pipeline stopped after parse failure for document_id=%d", document_id)
            return

        active_or_completed_job = (
            db.query(TranslationJob)
            .filter(TranslationJob.document_id == document_id)
            .filter(
                TranslationJob.status.in_(
                    [
                        "translation_queued",
                        "translating",
                        "in_review",
                        "draft_saved",
                        "review_complete",
                        "ready_for_export",
                        "exported",
                    ]
                )
            )
            .first()
        )
        if active_or_completed_job:
            return

        if doc.status == PARSED_STATUS:
            # Import lazily to avoid circular import at module load time.
            from routers.translation_jobs import create_translation_job
            from schemas import TranslationJobCreateRequest

            style_value = (translation_style or "natural").strip().lower()
            create_translation_job(
                document_id=document_id,
                payload=TranslationJobCreateRequest(translation_style=style_value),
                db=db,
                current_user=_mock_user,
                current_org=_mock_org,
            )
    except Exception:
        logger.exception("Default upload-to-review pipeline failed for document_id=%d", document_id)
    finally:
        db.close()


def _run_document_pipeline_from_task(document_id: int, user_id: int | None = None, org_id: int | None = None, translation_style: str = "natural") -> None:
    """Thin wrapper called by the Celery run_document_pipeline task."""
    _run_default_upload_to_review_pipeline(document_id=document_id, translation_style=translation_style, user_id=user_id, org_id=org_id)


def _execute_parsing_stage(db: Session, document_id: int):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise ValueError("Document not found")

    storage = get_storage()
    try:
        file_content = storage.load(doc.stored_filename)
    except FileNotFoundError:
        raise ValueError("File not found in storage")

    # parse_document reads from a file path; write to a tempfile to stay backend-agnostic.
    tmp = tempfile.NamedTemporaryFile(suffix=f".{doc.file_type}", delete=False)
    try:
        tmp.write(file_content)
        tmp.flush()
        parsed_blocks = parse_document(Path(tmp.name), doc.file_type)
    finally:
        tmp.close()
        Path(tmp.name).unlink(missing_ok=True)
    if not parsed_blocks:
        raise ValueError("Parsed document has no blocks")

    # Clear dependent rows first to satisfy FK document_segments.block_id -> document_blocks.id.
    # We delete by block IDs as well to handle stale rows that might reference these blocks.
    block_ids = [
        block_id
        for (block_id,) in db.query(DocumentBlock.id).filter(DocumentBlock.document_id == document_id).all()
    ]
    segments_to_delete_query = db.query(DocumentSegment.id).filter(
        (DocumentSegment.document_id == document_id)
        | (DocumentSegment.block_id.in_(block_ids) if block_ids else False)
    )
    existing_segment_ids = [segment_id for (segment_id,) in segments_to_delete_query.all()]
    if existing_segment_ids:
        db.query(SegmentAnnotation).filter(SegmentAnnotation.segment_id.in_(existing_segment_ids)).delete(
            synchronize_session=False
        )
        db.query(DocumentSegment).filter(DocumentSegment.id.in_(existing_segment_ids)).delete(
            synchronize_session=False
        )
    db.query(DocumentBlock).filter(DocumentBlock.document_id == document_id).delete(
        synchronize_session=False
    )

    for block_index, parsed_block in enumerate(parsed_blocks):
        block = DocumentBlock(
            document_id=document_id,
            block_index=block_index,
            block_type=parsed_block.block_type,
            text_original=parsed_block.text_original,
            text_translated=None,
            formatting_json=parsed_block.formatting_json,
        )
        db.add(block)

    doc.status = PARSED_STATUS
    doc.error_message = None
    db.commit()


def _execute_segment_stage(db: Session, document_id: int):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise ValueError("Document not found")

    existing_segments = (
        db.query(DocumentSegment.id).filter(DocumentSegment.document_id == document_id).all()
    )
    existing_segment_ids = [segment_id for (segment_id,) in existing_segments]
    if existing_segment_ids:
        db.query(SegmentAnnotation).filter(SegmentAnnotation.segment_id.in_(existing_segment_ids)).delete(
            synchronize_session=False
        )
    db.query(DocumentSegment).filter(DocumentSegment.document_id == document_id).delete()

    blocks = (
        db.query(DocumentBlock)
        .filter(DocumentBlock.document_id == document_id)
        .order_by(DocumentBlock.block_index)
        .all()
    )
    if not blocks:
        raise ValueError("No parsed blocks available for segmentation")

    segment_specs: list[tuple[DocumentBlock, str, str | None]] = []
    for block in blocks:
        segment_texts = split_block_into_segments(
            type(
                "ParsedBlockCompat",
                (),
                {
                    "block_type": block.block_type,
                    "text_original": block.text_original,
                },
            )()
        )
        for segment_text in segment_texts:
            heading_path = block.text_original if block.block_type == "heading" else None
            segment_specs.append((block, segment_text, heading_path))

    if not segment_specs:
        raise ValueError("No segments generated from parsed blocks")

    all_segment_texts = [segment_text for _, segment_text, _ in segment_specs]
    segments: list[DocumentSegment] = []
    for segment_index, (block, segment_text, heading_path) in enumerate(segment_specs):
        context_before = all_segment_texts[segment_index - 1] if segment_index > 0 else None
        context_after = all_segment_texts[segment_index + 1] if segment_index < len(all_segment_texts) - 1 else None
        segments.append(
            DocumentSegment(
                document_id=document_id,
                block_id=block.id,
                segment_index=segment_index,
                segment_type=block.block_type,
                source_text=segment_text,
                context_before=context_before,
                context_after=context_after,
                heading_path=heading_path,
            )
        )

    db.add_all(segments)
    doc.status = PARSED_STATUS
    doc.error_message = None
    db.commit()


def _seconds_between(started_at: datetime | None, finished_at: datetime | None = None) -> float:
    if not started_at:
        return 0.0
    end = finished_at or datetime.utcnow()
    return max((end - started_at).total_seconds(), 0.0)


def _calculate_document_progress(doc: Document, stage_jobs: list[ProcessingStageJob]) -> DocumentProgressResponse:
    status = doc.status
    parsing_job = next((job for job in stage_jobs if job.stage_name == PARSING_STAGE), None)
    segment_job = next((job for job in stage_jobs if job.stage_name == SEGMENT_STAGE), None)

    if status == PARSED_STATUS:
        return DocumentProgressResponse(
            document_id=doc.id,
            stage_label="Parsing complete",
            percentage=100.0,
            eta_seconds=0,
            is_complete=True,
            is_active=False,
        )
    if status == PARSE_FAILED_STATUS:
        return DocumentProgressResponse(
            document_id=doc.id,
            stage_label="Parsing failed",
            percentage=100.0,
            eta_seconds=None,
            is_complete=False,
            is_active=False,
        )

    if parsing_job and parsing_job.status == "running":
        elapsed = _seconds_between(parsing_job.started_at)
        if elapsed < 2:
            return DocumentProgressResponse(
                document_id=doc.id,
                stage_label="Parsing document",
                percentage=35.0,
                eta_seconds=max(int(12 - elapsed), 1),
                is_complete=False,
                is_active=True,
            )
        return DocumentProgressResponse(
            document_id=doc.id,
            stage_label="Extracting blocks",
            percentage=60.0,
            eta_seconds=max(int(8 - min(elapsed, 7)), 1),
            is_complete=False,
            is_active=True,
        )

    if segment_job and segment_job.status in {"queued", "running"}:
        elapsed = _seconds_between(segment_job.started_at)
        eta = max(int(6 - min(elapsed, 5)), 1) if segment_job.status == "running" else 6
        return DocumentProgressResponse(
            document_id=doc.id,
            stage_label="Creating segments",
            percentage=85.0 if segment_job.status == "running" else 75.0,
            eta_seconds=eta,
            is_complete=False,
            is_active=True,
        )

    if parsing_job and parsing_job.status == "queued" and status == PARSING_STATUS:
        return DocumentProgressResponse(
            document_id=doc.id,
            stage_label="Upload received",
            percentage=10.0,
            eta_seconds=18,
            is_complete=False,
            is_active=True,
        )

    return DocumentProgressResponse(
        document_id=doc.id,
        stage_label="Uploaded",
        percentage=0.0,
        eta_seconds=None,
        is_complete=False,
        is_active=False,
    )


def _compute_file_hash(file_bytes: bytes) -> str:
    """Return SHA-256 hex digest of file content."""
    return hashlib.sha256(file_bytes).hexdigest()


def validate_file(file: UploadFile) -> tuple[str, str]:
    """Validate file type and return (filename, file_type)."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )
    file_type = "docx" if ext == ".docx" else "rtf" if ext == ".rtf" else "txt"
    return file.filename, file_type


@router.post("/upload", response_model=DocumentResponse)
@limiter.limit("30/hour")
def upload_document(
    request: Request,
    file: UploadFile = File(...),
    target_language: str = Form(..., min_length=1, max_length=50),
    industry: str | None = Form(None, max_length=100),
    domain: str | None = Form(None, max_length=100),
    customer_id: str | None = Form(None, max_length=100),
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """Upload a DOCX, TXT, or RTF document. Source language is auto-detected."""
    filename, file_type = validate_file(file)

    industry_val = (industry.strip() or None) if industry else None
    domain_val = (domain.strip() or None) if domain else None
    customer_id_val = (customer_id.strip() or DEFAULT_CUSTOMER_ID) if customer_id else DEFAULT_CUSTOMER_ID

    contents = file.file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")

    content_hash = _compute_file_hash(contents)

    stored_filename = f"{uuid.uuid4().hex}_{filename}"
    storage = get_storage()
    storage.save(stored_filename, contents, file.content_type or "application/octet-stream")

    # detect_language reads from a file path; use a tempfile to stay backend-agnostic.
    tmp = tempfile.NamedTemporaryFile(suffix=Path(filename).suffix.lower(), delete=False)
    try:
        tmp.write(contents)
        tmp.flush()
        detected = detect_language(Path(tmp.name), file_type)
    finally:
        tmp.close()
        Path(tmp.name).unlink(missing_ok=True)
    source_language = detected if detected else "unknown"

    doc = Document(
        filename=filename,
        stored_filename=stored_filename,
        file_type=file_type,
        source_language=source_language,
        target_language=target_language.strip(),
        customer_id=customer_id_val,
        industry=industry_val,
        domain=domain_val,
        org_id=current_org.id,
        content_hash=content_hash,
        status="uploaded",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.post("/upload-and-translate", response_model=DocumentResponse)
@limiter.limit("20/hour")
def upload_and_translate_document(
    request: Request,
    file: UploadFile = File(...),
    target_language: str = Form(..., min_length=1, max_length=50),
    industry: str | None = Form(None, max_length=100),
    domain: str | None = Form(None, max_length=100),
    translation_style: str = Form("natural", min_length=1, max_length=20),
    customer_id: str | None = Form(None, max_length=100),
    project_id: int | None = Form(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
    current_org: Organisation = Depends(get_current_org),
):
    """Upload document and automatically run parse + translation for the default flow.

    Accepts DOCX, TXT, and RTF files (returns a single DocumentResponse) or a
    ZIP archive (returns ``{"documents": [...], "skipped_files": [...]}``).  The
    ZIP path creates one Document and one TranslationJob per valid inner file and
    returns a JSONResponse that bypasses the declared response_model.  Existing
    non-ZIP callers are unaffected — the response still contains an ``id`` field.
    """
    style_value = translation_style.strip().lower()
    if style_value not in {"natural", "formal", "literal"}:
        raise HTTPException(status_code=400, detail="translation_style must be one of: formal, literal, natural")

    # Validate project belongs to org
    validated_project_id: int | None = None
    if project_id is not None:
        proj = db.query(Project).filter(
            Project.id == project_id,
            Project.org_id == current_org.id,
            Project.deleted_at.is_(None),
        ).first()
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")
        validated_project_id = proj.id

    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    ext = Path(file.filename).suffix.lower()

    # ── ZIP upload path ──────────────────────────────────────────────────────
    if ext == ".zip":
        contents = file.file.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large (max 10 MB)")

        try:
            inner_files, skipped = unpack_zip(contents)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        if not inner_files:
            raise HTTPException(status_code=400, detail="ZIP contains no valid documents (supported: DOCX, TXT, RTF)")

        uid = current_user.id if current_user is not None else None
        industry_val = (industry.strip() or None) if industry else None
        domain_val = (domain.strip() or None) if domain else None
        customer_id_val = (customer_id.strip() or DEFAULT_CUSTOMER_ID) if customer_id else DEFAULT_CUSTOMER_ID
        storage = get_storage()
        created_docs: list[dict] = []

        for inner_filename, inner_bytes in inner_files:
            inner_ext = Path(inner_filename).suffix.lower()
            inner_file_type = "docx" if inner_ext == ".docx" else "rtf" if inner_ext == ".rtf" else "txt"

            content_hash = _compute_file_hash(inner_bytes)
            stored_filename = f"{uuid.uuid4().hex}_{inner_filename}"
            storage.save(stored_filename, inner_bytes, "application/octet-stream")

            tmp = tempfile.NamedTemporaryFile(suffix=inner_ext, delete=False)
            try:
                tmp.write(inner_bytes)
                tmp.flush()
                detected = detect_language(Path(tmp.name), inner_file_type)
            finally:
                tmp.close()
                Path(tmp.name).unlink(missing_ok=True)
            source_language = detected if detected else "unknown"

            doc = Document(
                filename=inner_filename,
                stored_filename=stored_filename,
                file_type=inner_file_type,
                source_language=source_language,
                target_language=target_language.strip(),
                customer_id=customer_id_val,
                industry=industry_val,
                domain=domain_val,
                org_id=current_org.id,
                project_id=validated_project_id,
                content_hash=content_hash,
                status="uploaded",
            )
            db.add(doc)
            db.commit()
            db.refresh(doc)

            run_document_pipeline.delay(doc.id, uid, current_org.id, style_value)
            created_docs.append({"id": doc.id, "filename": inner_filename})

        return JSONResponse(content={"documents": created_docs, "skipped_files": skipped})

    # ── Non-ZIP path (unchanged behaviour) ───────────────────────────────────
    doc = upload_document(
        request=request,
        file=file,
        target_language=target_language,
        industry=industry,
        domain=domain,
        customer_id=customer_id,
        db=db,
        current_org=current_org,
    )
    if validated_project_id is not None:
        doc.project_id = validated_project_id
        db.commit()
        db.refresh(doc)
    uid = current_user.id if current_user is not None else None
    run_document_pipeline.delay(doc.id, uid, current_org.id, style_value)
    return doc


@router.get("", response_model=list[DocumentResponse])
def list_documents(
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """List all documents belonging to the current user's organisation."""
    return (
        db.query(Document)
        .filter(Document.org_id == current_org.id, Document.deleted_at.is_(None))
        .order_by(Document.created_at.desc())
        .all()
    )


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """Get a single document by id."""
    doc = db.query(Document).filter(Document.id == document_id, Document.org_id == current_org.id, Document.deleted_at.is_(None)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.patch("/{document_id}/source-language", response_model=DocumentResponse)
def update_document_source_language(
    document_id: int,
    body: DocumentSourceLanguageUpdate,
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """Update a document's source language (manual override)."""
    doc = db.query(Document).filter(Document.id == document_id, Document.org_id == current_org.id, Document.deleted_at.is_(None)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    value = body.source_language.strip().lower()
    if value not in ALLOWED_SOURCE_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid source language. Allowed: {', '.join(sorted(ALLOWED_SOURCE_LANGUAGES))}",
        )
    doc.source_language = value
    db.commit()
    db.refresh(doc)
    return doc


@router.post("/{document_id}/parse", response_model=DocumentResponse)
def parse_document_by_id(
    document_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
    current_org: Organisation = Depends(get_current_org),
):
    """Queue parse + segment background stages for a document."""
    doc = db.query(Document).filter(Document.id == document_id, Document.org_id == current_org.id, Document.deleted_at.is_(None)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    active_job = (
        db.query(TranslationJob)
        .filter(TranslationJob.document_id == document_id)
        .filter(TranslationJob.status.in_(list(ACTIVE_TRANSLATION_JOB_STATUSES)))
        .first()
    )
    if active_job:
        raise HTTPException(status_code=409, detail="Cannot parse while a translation workflow is active")

    db.query(ProcessingStageJob).filter(
        ProcessingStageJob.document_id == document_id,
        ProcessingStageJob.translation_job_id.is_(None),
        ProcessingStageJob.status.in_(["queued", "running"]),
    ).delete(synchronize_session=False)

    _queue_stage_job(db=db, document_id=document_id, stage_name=PARSING_STAGE)
    _queue_stage_job(db=db, document_id=document_id, stage_name=SEGMENT_STAGE)
    doc.error_message = None
    doc.status = PARSING_STATUS
    db.commit()
    db.refresh(doc)
    uid = current_user.id if current_user is not None else None
    background_tasks.add_task(_run_document_pipeline, document_id, uid)
    return doc


@router.get("/{document_id}/segments", response_model=list[SegmentResponse])
def list_document_segments(
    document_id: int,
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """List segments for a document."""
    doc = db.query(Document).filter(Document.id == document_id, Document.org_id == current_org.id, Document.deleted_at.is_(None)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    segments = (
        db.query(DocumentSegment)
        .filter(DocumentSegment.document_id == document_id)
        .order_by(DocumentSegment.segment_index)
        .all()
    )
    return segments


@router.get("/{document_id}/blocks", response_model=list[DocumentBlockResponse])
def list_document_blocks(
    document_id: int,
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """List parsed document blocks for a document."""
    doc = db.query(Document).filter(Document.id == document_id, Document.org_id == current_org.id, Document.deleted_at.is_(None)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    blocks = (
        db.query(DocumentBlock)
        .filter(DocumentBlock.document_id == document_id)
        .order_by(DocumentBlock.block_index)
        .all()
    )
    return blocks


@router.get("/{document_id}/stages", response_model=list[ProcessingStageJobResponse])
def list_document_stage_jobs(
    document_id: int,
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    doc = db.query(Document).filter(Document.id == document_id, Document.org_id == current_org.id, Document.deleted_at.is_(None)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return (
        db.query(ProcessingStageJob)
        .filter(
            ProcessingStageJob.document_id == document_id,
            ProcessingStageJob.translation_job_id.is_(None),
        )
        .order_by(ProcessingStageJob.id.asc())
        .all()
    )


@router.get("/{document_id}/progress", response_model=DocumentProgressResponse)
def get_document_progress(
    document_id: int,
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    doc = db.query(Document).filter(Document.id == document_id, Document.org_id == current_org.id, Document.deleted_at.is_(None)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    stage_jobs = (
        db.query(ProcessingStageJob)
        .filter(
            ProcessingStageJob.document_id == document_id,
            ProcessingStageJob.translation_job_id.is_(None),
        )
        .order_by(ProcessingStageJob.id.asc())
        .all()
    )
    return _calculate_document_progress(doc, stage_jobs)


@router.post("/{document_id}/retry", response_model=DocumentResponse)
def retry_document_pipeline(
    document_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    doc = db.query(Document).filter(Document.id == document_id, Document.org_id == current_org.id, Document.deleted_at.is_(None)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    failed_stages = (
        db.query(ProcessingStageJob)
        .filter(
            ProcessingStageJob.document_id == document_id,
            ProcessingStageJob.translation_job_id.is_(None),
            ProcessingStageJob.status == "failed",
        )
        .all()
    )
    if not failed_stages:
        raise HTTPException(status_code=400, detail="No failed stage to retry")

    for stage_job in failed_stages:
        if stage_job.attempt_count >= stage_job.max_attempts:
            raise HTTPException(status_code=400, detail="One or more stages exceeded retry limit")
        stage_job.status = "queued"
        stage_job.error_message = None
        stage_job.started_at = None
        stage_job.finished_at = None

    doc.status = PARSING_STATUS
    doc.error_message = None
    db.commit()
    db.refresh(doc)
    logger.info("Retry queued for document_id=%d with %d failed stages", document_id, len(failed_stages))
    background_tasks.add_task(_run_document_pipeline, document_id)
    return doc


@router.delete("/{document_id}", status_code=204)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_org: Organisation = Depends(get_current_org),
):
    """Soft-delete a document and all its translation jobs."""
    doc = db.query(Document).filter(Document.id == document_id, Document.org_id == current_org.id, Document.deleted_at.is_(None)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    now = datetime.utcnow()
    doc.deleted_at = now
    db.query(TranslationJob).filter(
        TranslationJob.document_id == document_id,
        TranslationJob.deleted_at.is_(None),
    ).update({"deleted_at": now}, synchronize_session=False)
    db.commit()
