import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import get_db
from models import Document, DocumentBlock, DocumentSegment, SegmentAnnotation
from schemas import DocumentBlockResponse, DocumentResponse, DocumentSourceLanguageUpdate, SegmentResponse
from services.language_detection import detect_language
from services.parser import parse_document, split_block_into_segments


router = APIRouter(prefix="/api/documents", tags=["documents"])

ALLOWED_EXTENSIONS = {".docx", ".txt", ".rtf"}
ALLOWED_SOURCE_LANGUAGES = {"en", "de", "fr", "es", "it", "nl", "pt", "zh", "ja", "ko", "ar"}
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


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
def upload_document(
    file: UploadFile = File(...),
    target_language: str = Form(..., min_length=1, max_length=50),
    industry: str | None = Form(None, max_length=100),
    domain: str | None = Form(None, max_length=100),
    db: Session = Depends(get_db),
):
    """Upload a DOCX, TXT, or RTF document. Source language is auto-detected."""
    filename, file_type = validate_file(file)

    industry_val = (industry.strip() or None) if industry else None
    domain_val = (domain.strip() or None) if domain else None

    contents = file.file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stored_filename = f"{uuid.uuid4().hex}_{filename}"
    filepath = UPLOAD_DIR / stored_filename
    filepath.write_bytes(contents)

    detected = detect_language(filepath, file_type)
    source_language = detected if detected else "unknown"

    doc = Document(
        filename=filename,
        stored_filename=stored_filename,
        file_type=file_type,
        source_language=source_language,
        target_language=target_language.strip(),
        industry=industry_val,
        domain=domain_val,
        status="uploaded",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("", response_model=list[DocumentResponse])
def list_documents(db: Session = Depends(get_db)):
    """List all uploaded documents."""
    return db.query(Document).order_by(Document.created_at.desc()).all()


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(document_id: int, db: Session = Depends(get_db)):
    """Get a single document by id."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.patch("/{document_id}/source-language", response_model=DocumentResponse)
def update_document_source_language(
    document_id: int,
    body: DocumentSourceLanguageUpdate,
    db: Session = Depends(get_db),
):
    """Update a document's source language (manual override)."""
    doc = db.query(Document).filter(Document.id == document_id).first()
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
def parse_document_by_id(document_id: int, db: Session = Depends(get_db)):
    """Parse a document into blocks and segments. Updates status to 'parsed'."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    filepath = UPLOAD_DIR / doc.stored_filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    parsed_blocks = parse_document(filepath, doc.file_type)

    existing_segments = (
        db.query(DocumentSegment.id).filter(DocumentSegment.document_id == document_id).all()
    )
    existing_segment_ids = [segment_id for (segment_id,) in existing_segments]
    if existing_segment_ids:
        db.query(SegmentAnnotation).filter(SegmentAnnotation.segment_id.in_(existing_segment_ids)).delete(
            synchronize_session=False
        )

    db.query(DocumentSegment).filter(DocumentSegment.document_id == document_id).delete()
    db.query(DocumentBlock).filter(DocumentBlock.document_id == document_id).delete()

    blocks: list[DocumentBlock] = []
    segment_specs: list[tuple[DocumentBlock, str, str | None]] = []
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
        blocks.append(block)

        segment_texts = split_block_into_segments(parsed_block)
        for segment_text in segment_texts:
            heading_path = parsed_block.text_original if parsed_block.block_type == "heading" else None
            segment_specs.append((block, segment_text, heading_path))

    db.flush()

    segments = []
    all_segment_texts = [segment_text for _, segment_text, _ in segment_specs]
    for segment_index, (block, segment_text, heading_path) in enumerate(segment_specs):
        context_before = all_segment_texts[segment_index - 1] if segment_index > 0 else None
        context_after = all_segment_texts[segment_index + 1] if segment_index < len(all_segment_texts) - 1 else None
        seg = DocumentSegment(
            document_id=document_id,
            block_id=block.id,
            segment_index=segment_index,
            segment_type=block.block_type,
            source_text=segment_text,
            context_before=context_before,
            context_after=context_after,
            heading_path=heading_path,
        )
        segments.append(seg)

    if segments:
        db.add_all(segments)
    doc.status = "parsed"
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/{document_id}/segments", response_model=list[SegmentResponse])
def list_document_segments(document_id: int, db: Session = Depends(get_db)):
    """List segments for a document."""
    doc = db.query(Document).filter(Document.id == document_id).first()
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
def list_document_blocks(document_id: int, db: Session = Depends(get_db)):
    """List parsed document blocks for a document."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    blocks = (
        db.query(DocumentBlock)
        .filter(DocumentBlock.document_id == document_id)
        .order_by(DocumentBlock.block_index)
        .all()
    )
    return blocks
