from dataclasses import dataclass
from pathlib import Path
import re

from docx import Document as DocxDocument
from striprtf.striprtf import rtf_to_text

BULLET_PREFIX_RE = re.compile(r"^\s*([*\-•])\s+(.*)$")
HEADING_STYLE_RE = re.compile(r"^heading\s*(\d+)?$", re.IGNORECASE)


@dataclass
class ParsedDocumentBlock:
    block_type: str
    text_original: str
    formatting_json: dict | None = None


def _normalize_text(text: str) -> str:
    return "\n".join(line.rstrip() for line in text.splitlines()).strip()


def _classify_plain_text_block(text: str) -> ParsedDocumentBlock:
    bullet_match = BULLET_PREFIX_RE.match(text)
    if bullet_match:
        marker, body = bullet_match.groups()
        return ParsedDocumentBlock(
            block_type="bullet_item",
            text_original=body.strip(),
            formatting_json={"marker": marker},
        )

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    single_line = len(lines) == 1
    heading_like = (
        single_line
        and len(lines[0]) <= 80
        and len(lines[0].split()) <= 10
        and not lines[0].endswith((".", "!", "?", ";"))
    )
    if heading_like:
        return ParsedDocumentBlock(block_type="heading", text_original=lines[0], formatting_json=None)

    return ParsedDocumentBlock(block_type="paragraph", text_original=text, formatting_json=None)


def parse_txt(filepath: Path) -> list[ParsedDocumentBlock]:
    """Parse TXT into headings, paragraphs, and bullet items."""
    text = filepath.read_text(encoding="utf-8", errors="replace")
    blocks = []
    for raw_block in re.split(r"\n\s*\n", text):
        cleaned = _normalize_text(raw_block)
        if cleaned:
            blocks.append(_classify_plain_text_block(cleaned))
    return blocks


def parse_docx(filepath: Path) -> list[ParsedDocumentBlock]:
    """Parse DOCX while preserving simple block types."""
    doc = DocxDocument(str(filepath))
    blocks: list[ParsedDocumentBlock] = []
    for para in doc.paragraphs:
        text = _normalize_text(para.text)
        if not text:
            continue

        style_name = (para.style.name or "").strip() if para.style else ""
        if HEADING_STYLE_RE.match(style_name):
            blocks.append(
                ParsedDocumentBlock(
                    block_type="heading",
                    text_original=text,
                    formatting_json={"style_name": style_name},
                )
            )
            continue

        bullet_match = BULLET_PREFIX_RE.match(text)
        if "list bullet" in style_name.lower() or bullet_match:
            marker = bullet_match.group(1) if bullet_match else "•"
            body = bullet_match.group(2).strip() if bullet_match else text
            blocks.append(
                ParsedDocumentBlock(
                    block_type="bullet_item",
                    text_original=body,
                    formatting_json={"style_name": style_name or None, "marker": marker},
                )
            )
            continue

        blocks.append(
            ParsedDocumentBlock(
                block_type="paragraph",
                text_original=text,
                formatting_json={"style_name": style_name or None},
            )
        )
    return blocks


def parse_rtf(filepath: Path) -> list[ParsedDocumentBlock]:
    """Parse RTF into simple text blocks using plain-text heuristics."""
    raw = filepath.read_text(encoding="utf-8", errors="replace")
    text = rtf_to_text(raw)
    blocks = []
    for raw_block in re.split(r"\n\s*\n", text):
        cleaned = _normalize_text(raw_block)
        if cleaned:
            blocks.append(_classify_plain_text_block(cleaned))
    return blocks


def split_block_into_segments(block: ParsedDocumentBlock) -> list[str]:
    """Return translation segments for a block. MVP keeps one segment per block."""
    text = block.text_original.strip()
    return [text] if text else []


def parse_document(filepath: Path, file_type: str) -> list[ParsedDocumentBlock]:
    """Parse a document file into ordered document blocks."""
    if file_type == "txt":
        return parse_txt(filepath)
    if file_type == "docx":
        return parse_docx(filepath)
    if file_type == "rtf":
        return parse_rtf(filepath)
    raise ValueError(f"Unsupported file type: {file_type}")
