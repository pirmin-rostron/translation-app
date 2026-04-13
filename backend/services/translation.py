"""Translation service abstraction. Swap providers via environment config."""

import concurrent.futures
import json
import logging
import os
import re
from dataclasses import dataclass

import anthropic

logger = logging.getLogger(__name__)


class StructuredResponseParseError(ValueError):
    """Raised when structured model output cannot be parsed safely."""

    def __init__(self, message: str, raw_response: str = "", segment_id: int | None = None):
        super().__init__(message)
        self.raw_response = raw_response
        self.segment_id = segment_id


@dataclass
class TranslationSegmentResult:
    """Result of translating one segment, with optional ambiguity info."""

    primary_translation: str
    ambiguity_detected: bool = False
    ambiguity_details: dict | None = None
    input_tokens: int = 0
    output_tokens: int = 0


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
    """Abstract translation provider."""

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
        """Translate a single segment."""
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
    seen_pairs: set[tuple[str, str]] = set()
    distinct_translations: set[str] = set()
    distinct_meanings: set[str] = set()
    for idx, a in enumerate(alternatives):
        if not isinstance(a, dict):
            continue
        translation = str(a.get("translation", "")).strip()
        if not translation:
            continue
        meaning = str(a.get("meaning", "")).strip() or f"Possible meaning {idx + 1}"
        pair = (translation, meaning)
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)
        valid_alts.append({"translation": translation, "meaning": meaning})
        distinct_translations.add(translation.casefold())
        distinct_meanings.add(meaning.casefold())
    # Ambiguity must provide at least two distinct choices.
    if len(valid_alts) < 2 or len(distinct_translations) < 2 or len(distinct_meanings) < 2:
        return None
    explanation_text = str(explanation).strip() if explanation is not None else ""
    if not explanation_text:
        explanation_text = "The source phrase can be interpreted in more than one way."
    return {"source_span": str(source_span), "explanation": explanation_text, "alternatives": valid_alts}


def _build_glossary_block(glossary_terms: list[dict] | None) -> str:
    """Render glossary block for the system prompt. Returns empty string if no terms."""
    if not glossary_terms:
        return ""
    entries = []
    for term in glossary_terms:
        source_term = str(term.get("source_term", "")).strip()
        target_term = str(term.get("target_term", "")).strip()
        if source_term and target_term:
            entries.append(f"- {source_term} → {target_term}")
    if not entries:
        return ""
    return "Glossary — apply these terms exactly:\n" + "\n".join(entries)


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


def _fix_trailing_commas(text: str) -> str:
    """Remove trailing commas before closing braces or brackets."""
    return re.sub(r",(\s*[}\]])", r"\1", text)


def _fix_unescaped_newlines_in_strings(text: str) -> str:
    """Replace literal newline/carriage-return characters inside JSON string values with their escape sequences."""
    result: list[str] = []
    in_string = False
    escaped = False
    for char in text:
        if escaped:
            result.append(char)
            escaped = False
        elif char == "\\" and in_string:
            result.append(char)
            escaped = True
        elif char == '"':
            result.append(char)
            in_string = not in_string
        elif char == "\n" and in_string:
            result.append("\\n")
        elif char == "\r" and in_string:
            result.append("\\r")
        else:
            result.append(char)
    return "".join(result)


_TYPOGRAPHIC_QUOTES = ("\u201e", "\u201c", "\u201d")  # „  "  "


def _fix_typographic_quotes(text: str) -> str:
    """Replace Unicode typographic double-quote characters inside JSON string values with \\".

    Characters handled (all replaced with escaped double-quote):
      U+201E „  DOUBLE LOW-9 QUOTATION MARK (German opening)
      U+201C "  LEFT DOUBLE QUOTATION MARK
      U+201D "  RIGHT DOUBLE QUOTATION MARK

    Also handles the case where a German „ (U+201E) is paired with a plain ASCII closing "
    (U+0022) — a common model output pattern. Without this, the ASCII close is treated as
    the JSON string terminator, leaving the rest of the value outside the string and causing
    json.loads to fail even though „ itself was replaced correctly.

    Only characters that appear inside an already-open JSON string are touched;
    structural ASCII double-quotes that delimit the string are left unchanged.
    """
    result: list[str] = []
    in_string = False
    escaped = False
    expects_close = False  # True after seeing „; next " (ASCII or typographic) is its pair

    for char in text:
        if escaped:
            result.append(char)
            escaped = False
        elif char == "\\" and in_string:
            result.append(char)
            escaped = True
        elif char == '"':
            if in_string and expects_close:
                # ASCII " closing a „...pair — escape it rather than ending the JSON string.
                result.append('\\"')
                expects_close = False
            else:
                result.append(char)
                in_string = not in_string
        elif in_string and char in _TYPOGRAPHIC_QUOTES:
            result.append('\\"')
            if char == "\u201e":       # „ — German opening; expect a matching close
                expects_close = True
            elif expects_close:        # typographic close consumed the pending flag
                expects_close = False
        else:
            result.append(char)
    return "".join(result)


# Inline regression test — verifies the exact case that was failing:
# „ (U+201E) paired with a plain ASCII closing " inside a JSON string value.
assert _fix_typographic_quotes(
    '{"primary_translation": "\u201eVereinbarung" bedeutet.", "ambiguity_detected": false}'
) == '{"primary_translation": "\\"Vereinbarung\\" bedeutet.", "ambiguity_detected": false}', (
    "_fix_typographic_quotes: ASCII closing quote after \u201e was not escaped"
)
import json as _json_test
assert _json_test.loads(
    _fix_typographic_quotes(
        '{"primary_translation": "\u201eVereinbarung" bedeutet diesen Vertrag zwischen dem Kunden und dem Anbieter.", "ambiguity_detected": false, "ambiguity_details": null}'
    )
)["primary_translation"] == '"Vereinbarung" bedeutet diesen Vertrag zwischen dem Kunden und dem Anbieter.'


def _parse_json_safely(raw_text: str, segment_id: int | None = None) -> object:
    """Strip wrappers, apply corruption fixes, and parse JSON.

    Attempts three passes in order:
    1. Parse after standard fence stripping + corruption fixes.
    2. Extract the outermost {...} block with a regex and parse that.
    Raises StructuredResponseParseError if all passes fail.
    """
    cleaned = _strip_markdown_code_fences(raw_text)
    if not cleaned:
        raise StructuredResponseParseError(
            "Empty model response", raw_response=raw_text, segment_id=segment_id
        )

    # Apply common corruption fixes before the first parse attempt.
    cleaned = _fix_trailing_commas(cleaned)
    cleaned = _fix_unescaped_newlines_in_strings(cleaned)
    cleaned = _fix_typographic_quotes(cleaned)

    first_exc: json.JSONDecodeError | None = None

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        first_exc = exc

    # Fallback: extract the outermost {...} block and try again.
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    raise StructuredResponseParseError(
        str(first_exc), raw_response=raw_text, segment_id=segment_id
    ) from first_exc


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


def _style_instruction(style: str, target_language: str) -> str:
    match style:
        case "formal":
            return (
                f"Translate into formal {target_language}. Use formal register throughout "
                f"(e.g. Sie in German, vous in French). Use professional vocabulary appropriate to the domain."
            )
        case "literal":
            return (
                f"Translate into {target_language}, staying as close as possible to the original "
                "wording and sentence structure, even if it sounds less natural."
            )
        case _:
            return f"Translate into fluent, natural {target_language}, preserving meaning and readability."


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


class ClaudeTranslationProvider(TranslationProvider):
    """Claude-based translation with ambiguity detection. One API call per segment."""

    name = "claude"
    _model = "claude-sonnet-4-20250514"
    _max_tokens = 1000

    def __init__(self, api_key: str):
        self._client = anthropic.Anthropic(api_key=api_key)

    def _build_system_prompt(
        self,
        source_language: str,
        target_language: str,
        industry: str | None,
        domain: str | None,
        glossary_terms: list[dict] | None,
    ) -> str:
        src = "the detected source language" if source_language.lower() == "unknown" else source_language

        context_parts = []
        if industry:
            context_parts.append(f"Industry: {industry}")
        if domain:
            context_parts.append(f"Domain: {domain}")
        context_line = "\n".join(context_parts)

        glossary_block = _build_glossary_block(glossary_terms)

        lines = [
            "You are a professional translator. You translate documents accurately and consistently.",
            "",
            f"Language pair: {src} → {target_language}",
        ]
        if context_line:
            lines.append(context_line)
        if glossary_block:
            lines.append(glossary_block)
        lines += [
            "",
            "Important: Use only straight ASCII double quotes (\") inside JSON string values. Never use typographic quotes such as „ \u201c \u201d or any other Unicode quote characters in your JSON output.",
            "Your output must always be a single valid JSON object — no prose, no markdown, no explanation outside the JSON.",
        ]
        return "\n".join(lines)

    def _build_user_prompt(self, segment: SegmentContext, target_language: str, style: str) -> str:
        instruction = _style_instruction(style, target_language)
        return f"""{instruction}

Translate this segment. Detect material ambiguity only if a word or phrase could materially change meaning depending on interpretation.

Ambiguity rules:
- Only flag ambiguity if there are 2 or more genuinely distinct translations
- "ambiguity_details.explanation" must be in English
- Each alternative "meaning" must be in English
- "primary_translation" and all alternative "translation" values must be in {target_language}
- "source_span" is the exact ambiguous phrase from the source text
- If no material ambiguity exists, set "ambiguity_detected": false and "ambiguity_details": null

Return exactly this JSON structure:
{{
  "primary_translation": "...",
  "ambiguity_detected": true | false,
  "ambiguity_details": null | {{
    "source_span": "...",
    "explanation": "...",
    "alternatives": [
      {{ "translation": "...", "meaning": "..." }},
      {{ "translation": "...", "meaning": "..." }}
    ]
  }}
}}

Segment:
{segment.source_text}"""

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
        return self._translate_segment(
            segment=segment,
            source_language=source_language,
            target_language=target_language,
            translation_style=translation_style,
            industry=industry,
            domain=domain,
        )

    def _translate_segment(
        self,
        segment: SegmentContext,
        source_language: str,
        target_language: str,
        translation_style: str,
        industry: str | None,
        domain: str | None,
    ) -> TranslationSegmentResult:
        system_prompt = self._build_system_prompt(
            source_language=source_language,
            target_language=target_language,
            industry=industry,
            domain=domain,
            glossary_terms=segment.glossary_terms,
        )
        user_prompt = self._build_user_prompt(segment, target_language, translation_style)

        logger.info(
            "Translation provider=%s segment_id=%d requesting model response",
            self.name,
            segment.segment_id,
        )

        # Track cumulative token usage across retries
        _total_input_tokens = 0
        _total_output_tokens = 0

        def _call_api() -> str:
            nonlocal _total_input_tokens, _total_output_tokens
            resp = self._client.messages.create(
                model=self._model,
                max_tokens=self._max_tokens,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
            if hasattr(resp, "usage") and resp.usage:
                _total_input_tokens += getattr(resp.usage, "input_tokens", 0)
                _total_output_tokens += getattr(resp.usage, "output_tokens", 0)
            return resp.content[0].text

        raw_text = _call_api()
        logger.info(
            "Translation provider=%s segment_id=%d raw response=%r",
            self.name,
            segment.segment_id,
            raw_text,
        )

        try:
            parsed = _parse_json_safely(raw_text, segment_id=segment.segment_id)
        except StructuredResponseParseError:
            logger.warning(
                "Translation provider=%s segment_id=%d JSON parse failed; retrying once. raw_response=%r",
                self.name,
                segment.segment_id,
                raw_text,
            )
            raw_text = _call_api()
            logger.info(
                "Translation provider=%s segment_id=%d retry raw response=%r",
                self.name,
                segment.segment_id,
                raw_text,
            )
            try:
                parsed = _parse_json_safely(raw_text, segment_id=segment.segment_id)
            except StructuredResponseParseError:
                logger.warning(
                    "Translation provider=%s segment_id=%d JSON parse failed after retry. raw_response=%r",
                    self.name,
                    segment.segment_id,
                    raw_text,
                )
                raise

        if not isinstance(parsed, dict):
            raise StructuredResponseParseError(
                f"Expected a JSON object, got {type(parsed).__name__}",
                raw_response=raw_text,
                segment_id=segment.segment_id,
            )

        primary_translation = _coerce_translation_text(parsed)
        if not primary_translation:
            raise StructuredResponseParseError(
                "Missing or empty primary_translation",
                raw_response=raw_text,
                segment_id=segment.segment_id,
            )

        ambiguity_detected = parsed.get("ambiguity_detected") is True
        ambiguity_details = (
            _safe_ambiguity_details(parsed.get("ambiguity_details")) if ambiguity_detected else None
        )
        if ambiguity_detected and not ambiguity_details:
            logger.warning(
                "Translation provider=%s segment_id=%d ambiguity_detected=true but details invalid; "
                "defaulting ambiguity to false",
                self.name,
                segment.segment_id,
            )
            ambiguity_detected = False

        logger.info(
            "Translation provider=%s segment_id=%d parse succeeded ambiguity_detected=%s",
            self.name,
            segment.segment_id,
            ambiguity_detected,
        )
        return TranslationSegmentResult(
            primary_translation=primary_translation,
            ambiguity_detected=ambiguity_detected,
            ambiguity_details=ambiguity_details,
            input_tokens=_total_input_tokens,
            output_tokens=_total_output_tokens,
        )

    def translate_batch(
        self,
        segments: list[SegmentContext],
        source_language: str,
        target_language: str,
        translation_style: str = "natural",
        industry: str | None = None,
        domain: str | None = None,
    ) -> list[TranslationSegmentResult]:
        """Translate segments in parallel using a thread pool. Results preserve input order."""

        def _translate_one(segment: SegmentContext) -> TranslationSegmentResult:
            try:
                return self._translate_segment(
                    segment=segment,
                    source_language=source_language,
                    target_language=target_language,
                    translation_style=translation_style,
                    industry=industry,
                    domain=domain,
                )
            except Exception as exc:
                logger.warning(
                    "translate_batch: segment_id=%d failed: %s",
                    segment.segment_id,
                    exc,
                )
                raise

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(_translate_one, s) for s in segments]
            return [f.result() for f in futures]


def _is_valid_api_key(key: str) -> bool:
    """Return True if key looks like a real API key, not a placeholder."""
    if not key or len(key) < 20:
        return False
    placeholders = ("sk-your-key", "sk-...", "your-api-key", "xxx")
    return key.lower() not in (p.lower() for p in placeholders)


def get_translation_provider() -> tuple[TranslationProvider, str]:
    """
    Return (provider, provider_name) based on environment.
    - TRANSLATION_PROVIDER=claude and valid ANTHROPIC_API_KEY -> Claude
    - Otherwise -> mock
    """
    provider_name = os.getenv("TRANSLATION_PROVIDER", "").strip().lower()
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()

    if provider_name == "claude" and _is_valid_api_key(api_key):
        logger.info("Translation provider: Claude (real)")
        return ClaudeTranslationProvider(api_key=api_key), "claude"
    if provider_name == "claude" and not _is_valid_api_key(api_key):
        logger.warning(
            "Translation provider: mock (TRANSLATION_PROVIDER=claude but ANTHROPIC_API_KEY missing or placeholder)"
        )
    else:
        logger.info("Translation provider: mock")
    return MockTranslationProvider(), "mock"
