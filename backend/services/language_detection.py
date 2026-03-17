"""Detect source language from document content."""

from pathlib import Path

import langdetect
from langdetect import LangDetectException

from services.parser import parse_document

MIN_TEXT_LENGTH = 50


def detect_language(filepath: Path, file_type: str) -> str | None:
    """
    Extract text from the document and detect its language.
    Returns ISO 639-1 code (e.g. 'en', 'de') or None if detection fails.
    """
    try:
        blocks = parse_document(filepath, file_type)
        text = " ".join(block.text_original for block in blocks)
        text = text.strip()
        if len(text) < MIN_TEXT_LENGTH:
            return None
        return langdetect.detect(text)
    except (LangDetectException, ValueError, OSError):
        return None
