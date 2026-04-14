from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re

from docx import Document as DocxDocument
from striprtf.striprtf import rtf_to_text

BULLET_PREFIX_RE = re.compile(r"^\s*([*\-•])\s+(.*)$")
HEADING_STYLE_RE = re.compile(r"^heading\s*(\d+)?$", re.IGNORECASE)
RTF_CONTROL_RE = re.compile(r"\\[a-zA-Z]+-?\d*\s?")
_RTF_CONTROL_STRIP_RE = re.compile(r"\\[a-zA-Z]+-?\d*")


@dataclass
class ParsedDocumentBlock:
    block_type: str
    text_original: str
    formatting_json: dict | None = None


def _normalize_text(text: str) -> str:
    return "\n".join(line.rstrip() for line in text.splitlines()).strip()


def _is_heading_line(line: str) -> bool:
    """Return True if a single line looks like a section heading."""
    return (
        len(line) <= 80
        and len(line.split()) <= 10
        and not line.endswith((".", "!", "?", ";"))
        and not line.startswith(("-", "•", "*"))
        and "@" not in line
        and "://" not in line
    )


def _classify_plain_text_block(text: str) -> list[ParsedDocumentBlock]:
    """Classify a raw text block, returning one or more ParsedDocumentBlocks.

    When a block's first line looks like a heading but subsequent lines are body
    text, the heading is split into its own block so section labels render
    separately from paragraph content.
    """
    bullet_match = BULLET_PREFIX_RE.match(text)
    if bullet_match:
        marker, body = bullet_match.groups()
        return [ParsedDocumentBlock(
            block_type="bullet_item",
            text_original=body.strip(),
            formatting_json={"marker": marker},
        )]

    lines = [line.strip() for line in text.splitlines() if line.strip()]

    # Single line — classify directly
    if len(lines) == 1:
        if _is_heading_line(lines[0]):
            return [ParsedDocumentBlock(block_type="heading", text_original=lines[0], formatting_json=None)]
        return [ParsedDocumentBlock(block_type="paragraph", text_original=text, formatting_json=None)]

    # Multi-line: if the first line looks like a heading, split it out
    if _is_heading_line(lines[0]):
        heading = ParsedDocumentBlock(block_type="heading", text_original=lines[0], formatting_json=None)
        rest = "\n".join(lines[1:])
        body = ParsedDocumentBlock(block_type="paragraph", text_original=rest, formatting_json=None)
        return [heading, body]

    return [ParsedDocumentBlock(block_type="paragraph", text_original=text, formatting_json=None)]


def parse_txt(filepath: Path) -> list[ParsedDocumentBlock]:
    """Parse TXT into headings, paragraphs, and bullet items."""
    text = filepath.read_text(encoding="utf-8", errors="replace")
    blocks: list[ParsedDocumentBlock] = []
    for raw_block in re.split(r"\n\s*\n", text):
        cleaned = _normalize_text(raw_block)
        if cleaned:
            blocks.extend(_classify_plain_text_block(cleaned))
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


def _is_rtf_header_noise(text: str) -> bool:
    """Return True if the text block is RTF header/control noise with no real content.

    After rtf_to_text decodes the outer RTF wrapper, escaped inner RTF preamble
    (e.g. {\\rtf1\\ansi\\deff0, {\\fonttbl...}, \\fs24) can leak through as the
    first few text blocks.  These contain no translatable content and must be skipped.
    """
    # Strip all RTF control words (e.g. \rtf1, \ansi, \fonttbl, \fs24, \par)
    remainder = _RTF_CONTROL_STRIP_RE.sub("", text)
    # Strip structural characters: braces, digits, semicolons
    remainder = re.sub(r"[{}\d;]", "", remainder)
    remainder = re.sub(r"\s+", " ", remainder).strip()

    # Case 1: nothing meaningful remains at all
    if not remainder:
        return True

    # Case 2: block opens with a brace group — these are RTF structural groups
    # (e.g. {\fonttbl ...}) whose only text remnants are font names, not prose.
    if text.lstrip().startswith("{"):
        return True

    return False


def _decode_rtf_text(raw: str) -> str:
    """Decode RTF to plain text, handling double-wrapped RTF files.

    Some editors (e.g. macOS TextEdit) wrap RTF content inside an outer RTF
    envelope.  After the first decode the output is still valid RTF — detect
    this and decode a second time.
    """
    text = rtf_to_text(raw)
    if text.lstrip().startswith("{\\rtf"):
        text = rtf_to_text(text)
    return text


def parse_rtf(filepath: Path) -> list[ParsedDocumentBlock]:
    """Parse RTF into simple text blocks using plain-text heuristics."""
    raw = filepath.read_text(encoding="utf-8", errors="replace")
    text = _decode_rtf_text(raw)
    blocks: list[ParsedDocumentBlock] = []
    for raw_block in re.split(r"\n\s*\n", text):
        cleaned = _normalize_text(raw_block)
        if cleaned and not _is_rtf_header_noise(cleaned):
            blocks.extend(_classify_plain_text_block(cleaned))
    return blocks


def split_block_into_segments(block: ParsedDocumentBlock) -> list[str]:
    """Return translation segments for a block.

    Paragraph blocks with multiple lines/sentences are split to preserve full
    reconstructed output and avoid single-snippet collapse in downstream review.
    """
    text = (block.text_original or "").strip()
    if not text:
        return []

    if block.block_type in {"heading", "bullet_item"}:
        return [text]

    normalized = text.replace("\\par", "\n")
    lines = [line.strip() for line in normalized.splitlines() if line.strip()]
    if not lines:
        return [text]

    segments: list[str] = []
    for line in lines:
        cleaned_line = RTF_CONTROL_RE.sub(" ", line).replace("{", " ").replace("}", " ")
        cleaned_line = re.sub(r"\s+", " ", cleaned_line).strip()
        if not cleaned_line:
            continue

        # Preserve sentence-level context in long lines while keeping short labels intact.
        sentence_parts = [part.strip() for part in re.split(r"(?<=[.!?])\s+", cleaned_line) if part.strip()]
        if len(sentence_parts) > 1:
            segments.extend(sentence_parts)
        else:
            segments.append(cleaned_line)

    return segments if segments else [text]


def parse_document(filepath: Path, file_type: str) -> list[ParsedDocumentBlock]:
    """Parse a document file into ordered document blocks."""
    if file_type == "txt":
        blocks = parse_txt(filepath)
    elif file_type == "docx":
        blocks = parse_docx(filepath)
    elif file_type == "rtf":
        blocks = parse_rtf(filepath)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")
    return blocks
