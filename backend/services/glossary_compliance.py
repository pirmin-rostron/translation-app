"""Glossary compliance verification — detect when translated output ignores glossary terms.

Runs as a non-blocking post-translation quality check. For each segment where
glossary_applied is True, verifies that the expected target term actually
appears in the translated output. Flags misses as glossary_violations.

Edge cases handled:
- Case-insensitive matching
- Partial/substring matching (the target term may appear as part of a larger word)
- Multiple glossary terms per segment
"""

from __future__ import annotations

import re
from typing import Any, Sequence


def check_glossary_compliance(
    translated_text: str,
    glossary_matches: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    """Check whether glossary target terms appear in the translated output.

    Args:
        translated_text: The final translated text for a segment.
        glossary_matches: The glossary_matches JSONB payload stored on the
            TranslationResult, expected shape:
            {"matches": [{"source_term": str, "target_term": str}, ...]}

    Returns:
        List of violation dicts for terms not found in output:
        [{"source_term": str, "expected_target": str, "found_in_output": False}]
        Empty list if all terms are present or no glossary was applied.
    """
    if not glossary_matches or not translated_text:
        return []

    matches = glossary_matches.get("matches")
    if not matches or not isinstance(matches, list):
        return []

    text_lower = translated_text.lower()
    violations: list[dict[str, Any]] = []

    for match in matches:
        if not isinstance(match, dict):
            continue
        source_term = match.get("source_term", "")
        target_term = match.get("target_term", "")
        if not source_term or not target_term:
            continue

        # Check if the target term appears in the translated text.
        # Use case-insensitive substring check — the term may be inflected
        # (plurals, conjugations) so we also check the stem (first 4+ chars).
        target_lower = target_term.lower()

        found = target_lower in text_lower
        if not found and len(target_lower) >= 4:
            # Try a stem match: at least 80% of the term must match
            min_stem = max(4, int(len(target_lower) * 0.8))
            stem = target_lower[:min_stem]
            found = stem in text_lower

        if not found:
            violations.append({
                "source_term": source_term,
                "expected_target": target_term,
                "found_in_output": False,
            })

    return violations
