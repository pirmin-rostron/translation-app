"""Translation service abstraction. Swap providers via environment config."""

import json
import logging
import os
import re
from dataclasses import dataclass

from openai import OpenAI

logger = logging.getLogger(__name__)


class StructuredResponseParseError(ValueError):
    """Raised when structured model output cannot be parsed safely."""

    def __init__(self, message: str, raw_response: str = ""):
        super().__init__(message)
        self.raw_response = raw_response


@dataclass
class TranslationSegmentResult:
    """Result of translating one segment, with optional ambiguity info."""

    primary_translation: str
    ambiguity_detected: bool = False
    ambiguity_details: dict | None = None


def get_batch_size() -> int:
    """Return batch size from TRANSLATION_BATCH_SIZE env, default 5."""
    try:
        val = int(os.getenv("TRANSLATION_BATCH_SIZE", "5"))
        return max(1, min(val, 50))
    except ValueError:
        return 5


class SegmentContext:
    """Context for a single segment to translate."""

    def __init__(
        self,
        segment_id: int,
        source_text: str,
        context_before: str | None = None,
        context_after: str | None = None,
        glossary_terms: list[dict] | None = None,
    ):
        self.segment_id = segment_id
        self.source_text = source_text
        self.context_before = context_before
        self.context_after = context_after
        self.glossary_terms = glossary_terms or []


class TranslationProvider:
    """Abstract translation provider. Implement translate_batch() for backends."""

    name: str = "unknown"

    def translate(
        self,
        source_text: str,
        source_language: str,
        target_language: str,
        translation_style: str = "natural",
        industry: str | None = None,
        domain: str | None = None,
        context_before: str | None = None,
        context_after: str | None = None,
        glossary_terms: list[dict] | None = None,
    ) -> TranslationSegmentResult:
        """Translate a single segment. Used as fallback when batch fails."""
        raise NotImplementedError

    def translate_batch(
        self,
        segments: list[SegmentContext],
        source_language: str,
        target_language: str,
        translation_style: str = "natural",
        industry: str | None = None,
        domain: str | None = None,
    ) -> list[TranslationSegmentResult]:
        """Translate multiple segments. Returns results in same order."""
        raise NotImplementedError


def _safe_ambiguity_details(obj: object) -> dict | None:
    """Validate and return ambiguity_details dict, or None if invalid."""
    if obj is None:
        return None
    if not isinstance(obj, dict):
        return None
    source_span = obj.get("source_span")
    explanation = obj.get("explanation")
    alternatives = obj.get("alternatives")
    if not source_span or not isinstance(alternatives, list):
        return None
    valid_alts = []
    for idx, a in enumerate(alternatives):
        if not isinstance(a, dict):
            continue
        translation = str(a.get("translation", "")).strip()
        if not translation:
            continue
        meaning = str(a.get("meaning", "")).strip() or f"Possible meaning {idx + 1}"
        valid_alts.append({"translation": translation, "meaning": meaning})
    if not valid_alts:
        return None
    explanation_text = str(explanation).strip() if explanation is not None else ""
    if not explanation_text:
        explanation_text = "The source phrase can be interpreted in more than one way."
    return {"source_span": str(source_span), "explanation": explanation_text, "alternatives": valid_alts}


def _build_glossary_instruction_for_segment(glossary_terms: list[dict] | None) -> str:
    """Render glossary instructions for a segment prompt."""
    if not glossary_terms:
        return ""

    entries = []
    for term in glossary_terms:
        source_term = str(term.get("source_term", "")).strip()
        target_term = str(term.get("target_term", "")).strip()
        if source_term and target_term:
            entries.append(f'- "{source_term}" -> "{target_term}"')

    if not entries:
        return ""

    return (
        "Glossary terms: When the source term appears, use the preferred target term if it fits the context.\n"
        + "\n".join(entries)
    )


def _strip_markdown_code_fences(raw_text: str) -> str:
    """Trim whitespace and unwrap ```json fenced blocks if present."""
    text = raw_text.lstrip("\ufeff").strip()
    if not text.startswith("```"):
        return text

    lines = text.splitlines()
    if not lines:
        return ""

    if re.match(r"^```(?:json)?\s*$", lines[0].strip(), flags=re.IGNORECASE):
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        return "\n".join(lines).strip()

    return text


def _parse_json_safely(raw_text: str) -> object:
    """Strip wrappers and parse JSON, raising a structured error on failure."""
    cleaned = _strip_markdown_code_fences(raw_text)
    if not cleaned:
        raise StructuredResponseParseError("Empty model response", raw_response=raw_text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise StructuredResponseParseError(str(exc), raw_response=raw_text) from exc


def _coerce_translation_text(obj: object) -> str | None:
    """Extract a translation string from common response shapes."""
    if obj is None:
        return None
    if isinstance(obj, str):
        text = obj.strip()
        return text or None
    if isinstance(obj, dict):
        for key in ("primary_translation", "translation", "translated_text", "text", "output_text"):
            value = obj.get(key)
            if value is not None:
                text = str(value).strip()
                if text:
                    return text
    return None


def _recover_plain_translations(raw_text: str, expected_count: int) -> list[str] | None:
    """
    Recover plain translations from raw model output.

    Supports plain text for single segments and JSON arrays/objects when present.
    """
    cleaned = _strip_markdown_code_fences(raw_text)
    if not cleaned:
        return None

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        parsed = None

    if expected_count == 1:
        if parsed is not None:
            if isinstance(parsed, list) and parsed:
                text = _coerce_translation_text(parsed[0])
                if text:
                    return [text]
            text = _coerce_translation_text(parsed)
            if text:
                return [text]
        return [cleaned]

    if isinstance(parsed, list) and len(parsed) == expected_count:
        recovered = []
        for item in parsed:
            text = _coerce_translation_text(item)
            if text is None:
                return None
            recovered.append(text)
        return recovered

    return None


class MockTranslationProvider(TranslationProvider):
    """Fallback provider. Returns mock output when no API key is configured."""

    name = "mock"

    def translate(
        self,
        source_text: str,
        source_language: str,
        target_language: str,
        translation_style: str = "natural",
        industry: str | None = None,
        domain: str | None = None,
        context_before: str | None = None,
        context_after: str | None = None,
        glossary_terms: list[dict] | None = None,
    ) -> TranslationSegmentResult:
        return TranslationSegmentResult(primary_translation=f"[TRANSLATED] {source_text}")

    def translate_batch(
        self,
        segments: list[SegmentContext],
        source_language: str,
        target_language: str,
        translation_style: str = "natural",
        industry: str | None = None,
        domain: str | None = None,
    ) -> list[TranslationSegmentResult]:
        return [TranslationSegmentResult(primary_translation=f"[TRANSLATED] {s.source_text}") for s in segments]


def _translation_style_instruction(target_language: str, translation_style: str) -> str:
    style = (translation_style or "natural").strip().lower()
    if style == "literal":
        return (
            f"Translate the following text into {target_language}, staying as close as possible to the original "
            "wording and sentence structure, even if it sounds less natural."
        )
    return (
        f"Translate the following text into fluent, natural {target_language}, preserving meaning and readability."
    )


class OpenAITranslationProvider(TranslationProvider):
    """OpenAI-based translation with ambiguity detection."""

    name = "openai"

    def __init__(self, api_key: str):
        self._client = OpenAI(api_key=api_key)

    def _extract_response_text(self, response: object) -> str:
        """Read the actual text payload from OpenAI responses/chat-completions."""
        output_text = getattr(response, "output_text", None)
        if isinstance(output_text, str) and output_text.strip():
            return output_text

        choices = getattr(response, "choices", None)
        if isinstance(choices, list) and choices:
            first_choice = choices[0]
            message = getattr(first_choice, "message", None)
            content = getattr(message, "content", None)
            if isinstance(content, str):
                return content
            if isinstance(content, list):
                parts = []
                for part in content:
                    if isinstance(part, dict):
                        text = part.get("text")
                        if isinstance(text, dict):
                            text = text.get("value")
                    else:
                        text = getattr(part, "text", None)
                        if isinstance(text, dict):
                            text = text.get("value")
                        elif hasattr(text, "value"):
                            text = text.value
                    if text is not None:
                        parts.append(str(text))
                if parts:
                    return "".join(parts)
            text = getattr(first_choice, "text", None)
            if isinstance(text, str):
                return text

        return ""

    def _request_text(self, prompt: str, purpose: str) -> str:
        """Call OpenAI and log the raw text before any parsing."""
        logger.info("Translation provider=%s purpose=%s requesting model response", self.name, purpose)
        response = self._client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
        raw_text = self._extract_response_text(response)
        logger.info("Translation provider=%s purpose=%s raw response=%r", self.name, purpose, raw_text)
        return raw_text

    def translate(
        self,
        source_text: str,
        source_language: str,
        target_language: str,
        translation_style: str = "natural",
        industry: str | None = None,
        domain: str | None = None,
        context_before: str | None = None,
        context_after: str | None = None,
        glossary_terms: list[dict] | None = None,
    ) -> TranslationSegmentResult:
        segment = SegmentContext(0, source_text, context_before, context_after, glossary_terms)
        try:
            return self._translate_with_ambiguity(
                segments=[segment],
                source_language=source_language,
                target_language=target_language,
                translation_style=translation_style,
                industry=industry,
                domain=domain,
            )[0]
        except StructuredResponseParseError as exc:
            logger.warning(
                "Translation provider=%s structured parse failed for single segment; raw response=%r; "
                "falling back to plain translation: %s",
                self.name,
                exc.raw_response,
                exc,
            )
        except Exception as exc:
            logger.warning(
                "Translation provider=%s structured single-segment request failed; "
                "falling back to plain translation: %s",
                self.name,
                exc,
            )

        translations = self._fallback_translate_only(
            segments=[segment],
            source_language=source_language,
            target_language=target_language,
            translation_style=translation_style,
            industry=industry,
            domain=domain,
        )
        if translations and translations[0].strip():
            logger.info("Translation provider=%s plain single-segment fallback succeeded", self.name)
            return TranslationSegmentResult(
                primary_translation=translations[0].strip(),
                ambiguity_detected=False,
                ambiguity_details=None,
            )

        raise ValueError("No usable translation could be recovered for single segment")

    def _translate_with_ambiguity(
        self,
        segments: list[SegmentContext],
        source_language: str,
        target_language: str,
        translation_style: str = "natural",
        industry: str | None = None,
        domain: str | None = None,
    ) -> list[TranslationSegmentResult]:
        """Call OpenAI with translation + ambiguity detection. Returns list of TranslationSegmentResult."""
        context_parts = []
        if industry:
            context_parts.append(f"Industry: {industry}")
        if domain:
            context_parts.append(f"Domain: {domain}")
        context_line = "\n".join(context_parts) if context_parts else "General text."
        src = "the detected source language" if source_language.lower() == "unknown" else source_language
        style_instruction = _translation_style_instruction(target_language, translation_style)

        texts = [s.source_text for s in segments]
        if len(segments) == 1:
            glossary_block = _build_glossary_instruction_for_segment(segments[0].glossary_terms)
            prompt = f"""{style_instruction}
Then detect material ambiguity for this single segment translated from {src}.

Context: {context_line}

{glossary_block}

Rules for ambiguity: Only flag when a word/phrase could MATERIALLY change meaning (e.g. "table" as verb: present for discussion vs postpone). Do NOT flag stylistic differences or minor synonyms. Use industry/domain context. Keep false positives low.

Important: There is exactly one input segment. Even if it contains multiple sentences, bullet points, or lines, keep everything inside one translated segment. Do not split it into multiple output items.

Return exactly one JSON object with these fields:
- "primary_translation": the full translation of the entire segment
- "ambiguity_detected": true only if material ambiguity exists
- "ambiguity_details": null, or {{"source_span": "the ambiguous phrase", "explanation": "brief explanation", "alternatives": [{{"translation": "...", "meaning": "..."}}, ...]}}

Segment:
{json.dumps(texts[0])}

Return only valid JSON. Do not include markdown, code fences, explanations, headings, or any extra text before or after the JSON object."""
        else:
            glossary_by_segment = [
                {
                    "segment_id": s.segment_id,
                    "source_text": s.source_text,
                    "glossary_terms": s.glossary_terms,
                }
                for s in segments
            ]
            prompt = f"""{style_instruction}
Then detect material ambiguity for each segment translated from {src}.

Context: {context_line}

Rules for ambiguity: Only flag when a word/phrase could MATERIALLY change meaning (e.g. "table" as verb: present for discussion vs postpone). Do NOT flag stylistic differences or minor synonyms. Use industry/domain context. Keep false positives low.

Glossary rule: If a segment includes matching glossary terms, use the provided target terms when applicable.

Glossary by segment:
{json.dumps(glossary_by_segment)}

Return a JSON array with one object per segment. Each object:
- "primary_translation": the translation
- "ambiguity_detected": true only if material ambiguity exists
- "ambiguity_details": null, or {{"source_span": "the ambiguous phrase", "explanation": "brief explanation", "alternatives": [{{"translation": "...", "meaning": "..."}}, ...]}}

Segments:
{json.dumps(texts)}

Return only valid JSON. Do not include markdown, code fences, explanations, headings, or any extra text before or after the JSON array."""

        raw_text = self._request_text(prompt, purpose=f"structured_batch_{len(segments)}")
        parsed = _parse_json_safely(raw_text)
        if len(segments) == 1 and isinstance(parsed, dict):
            parsed_items = [parsed]
        elif isinstance(parsed, list):
            parsed_items = parsed
        else:
            parsed_items = None

        if not isinstance(parsed_items, list) or len(parsed_items) != len(segments):
            got = len(parsed_items) if isinstance(parsed_items, list) else "non-list"
            raise StructuredResponseParseError(
                f"Expected {len(segments)} items, got {got}",
                raw_response=raw_text,
            )

        results = []
        for i, item in enumerate(parsed_items):
            if not isinstance(item, dict):
                raise StructuredResponseParseError(
                    f"Item {i} is not an object",
                    raw_response=raw_text,
                )

            primary_translation = _coerce_translation_text(item)
            if not primary_translation:
                raise StructuredResponseParseError(
                    f"Item {i} missing primary_translation",
                    raw_response=raw_text,
                )

            ambiguity_detected = item.get("ambiguity_detected") is True
            ambiguity_details = _safe_ambiguity_details(item.get("ambiguity_details")) if ambiguity_detected else None
            if ambiguity_detected and not ambiguity_details:
                logger.warning(
                    "Translation provider=%s structured parse recovered item=%d with invalid ambiguity_details; "
                    "defaulting ambiguity to false",
                    self.name,
                    i,
                )
                ambiguity_detected = False

            results.append(
                TranslationSegmentResult(
                    primary_translation=primary_translation,
                    ambiguity_detected=ambiguity_detected,
                    ambiguity_details=ambiguity_details,
                )
            )

        logger.info(
            "Translation provider=%s structured parse succeeded for %d segment(s)",
            self.name,
            len(results),
        )
        return results

    def _fallback_translate_only(
        self,
        segments: list[SegmentContext],
        source_language: str,
        target_language: str,
        translation_style: str,
        industry: str | None,
        domain: str | None,
    ) -> list[str]:
        """Simple translate without ambiguity (fallback)."""
        context_parts = []
        if industry:
            context_parts.append(f"Industry: {industry}")
        if domain:
            context_parts.append(f"Domain: {domain}")
        context_line = "\n".join(context_parts) if context_parts else "General text."
        src = "the detected source language" if source_language.lower() == "unknown" else source_language
        style_instruction = _translation_style_instruction(target_language, translation_style)
        if len(segments) == 1:
            segment = segments[0]
            glossary_block = _build_glossary_instruction_for_segment(segment.glossary_terms)
            prompt = f"""{style_instruction}
Source language: {src}

Context: {context_line}
{glossary_block}
Previous context: {segment.context_before or ""}
Next context: {segment.context_after or ""}

Source text:
{segment.source_text}

Return only the translated text. Do not return JSON, markdown, code fences, explanations, or quotes around the answer."""
        else:
            texts_json = json.dumps([s.source_text for s in segments])
            prompt = f"""{style_instruction}
Source language: {src}
Context: {context_line}

Return only a valid JSON array of translated strings in the same order. Do not include markdown, code fences, explanations, headings, or any extra text before or after the JSON.

{texts_json}"""

        raw_text = self._request_text(prompt, purpose=f"plain_fallback_{len(segments)}")
        recovered = _recover_plain_translations(raw_text, expected_count=len(segments))
        if recovered is not None:
            logger.info(
                "Translation provider=%s plain fallback recovered %d translation(s)",
                self.name,
                len(recovered),
            )
            return recovered

        logger.warning(
            "Translation provider=%s plain fallback could not recover usable translation(s); raw response=%r",
            self.name,
            raw_text,
        )
        raise ValueError("Plain translation fallback returned no usable translation")

    def translate_batch(
        self,
        segments: list[SegmentContext],
        source_language: str,
        target_language: str,
        translation_style: str = "natural",
        industry: str | None = None,
        domain: str | None = None,
    ) -> list[TranslationSegmentResult]:
        if not segments:
            return []
        if len(segments) == 1:
            s = segments[0]
            return [
                self.translate(
                    source_text=s.source_text,
                    source_language=source_language,
                    target_language=target_language,
                    translation_style=translation_style,
                    industry=industry,
                    domain=domain,
                    context_before=s.context_before,
                    context_after=s.context_after,
                    glossary_terms=s.glossary_terms,
                )
            ]
        try:
            return self._translate_with_ambiguity(
                segments=segments,
                source_language=source_language,
                target_language=target_language,
                translation_style=translation_style,
                industry=industry,
                domain=domain,
            )
        except StructuredResponseParseError as exc:
            logger.warning(
                "Translation provider=%s structured batch parse failed for %d segment(s); raw response=%r; "
                "falling back to single-segment translation: %s",
                self.name,
                len(segments),
                exc.raw_response,
                exc,
            )
        except Exception as e:
            logger.warning(
                "Translation provider=%s batch request failed for %d segment(s); "
                "falling back to single-segment translation: %s",
                self.name,
                len(segments),
                e,
            )
            return [
                self.translate(
                    source_text=s.source_text,
                    source_language=source_language,
                    target_language=target_language,
                    translation_style=translation_style,
                    industry=industry,
                    domain=domain,
                    context_before=s.context_before,
                    context_after=s.context_after,
                    glossary_terms=s.glossary_terms,
                )
                for s in segments
            ]
        return [
            self.translate(
                source_text=s.source_text,
                source_language=source_language,
                target_language=target_language,
                translation_style=translation_style,
                industry=industry,
                domain=domain,
                context_before=s.context_before,
                context_after=s.context_after,
                glossary_terms=s.glossary_terms,
            )
            for s in segments
        ]


def _is_valid_api_key(key: str) -> bool:
    """Return True if key looks like a real API key, not a placeholder."""
    if not key or len(key) < 20:
        return False
    placeholders = ("sk-your-key", "sk-...", "your-api-key", "xxx")
    return key.lower() not in (p.lower() for p in placeholders)


def get_translation_provider() -> tuple[TranslationProvider, str]:
    """
    Return (provider, provider_name) based on environment.
    - TRANSLATION_PROVIDER=openai and valid OPENAI_API_KEY -> OpenAI
    - Otherwise -> mock
    """
    provider_name = os.getenv("TRANSLATION_PROVIDER", "").strip().lower()
    api_key = os.getenv("OPENAI_API_KEY", "").strip()

    if provider_name == "openai" and _is_valid_api_key(api_key):
        logger.info("Translation provider: OpenAI (real)")
        return OpenAITranslationProvider(api_key=api_key), "openai"
    if provider_name == "openai" and not _is_valid_api_key(api_key):
        logger.warning(
            "Translation provider: mock (TRANSLATION_PROVIDER=openai but OPENAI_API_KEY missing or placeholder)"
        )
    else:
        logger.info("Translation provider: mock")
    return MockTranslationProvider(), "mock"
