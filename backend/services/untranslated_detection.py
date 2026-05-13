"""Detect English words that remain untranslated in target text.

Runs as a non-blocking post-translation quality check. For each translated
segment, tokenises the target text and flags words that look like common
English words which should have been translated into the target language.

Exclusions:
- Proper nouns (capitalised words not at sentence start)
- Words that appear in the glossary as locked/untranslatable terms
- Very short words (<=2 chars) — too many false positives
- Words that only contain digits or punctuation
- Common international terms (OK, IT, GPS, etc.)
"""

from __future__ import annotations

import re
from typing import Sequence

# Common English words that are frequently left untranslated by AI translators.
# This is not exhaustive — it targets high-signal, commonly missed words.
# Proper nouns and brand names are excluded by the capitalisation heuristic.
_COMMON_ENGLISH_WORDS: set[str] = {
    "about", "above", "after", "again", "against", "all", "also", "always",
    "and", "another", "any", "are", "available", "back", "based", "because",
    "been", "before", "being", "below", "best", "between", "both", "business",
    "but", "can", "change", "click", "come", "company", "compliance",
    "complete", "configuration", "content", "control", "could", "customer",
    "data", "default", "department", "design", "development", "digital",
    "display", "does", "down", "each", "effective", "email", "end",
    "engineering", "environment", "even", "every", "example", "experience",
    "features", "feedback", "file", "find", "first", "following", "for",
    "found", "from", "full", "general", "get", "global", "good", "group",
    "had", "has", "have", "help", "here", "high", "home", "how",
    "however", "impact", "implementation", "important", "include",
    "information", "input", "into", "issue", "its", "just", "keep",
    "key", "know", "last", "lead", "learning", "level", "like", "line",
    "list", "long", "look", "made", "main", "make", "management",
    "manager", "many", "marketing", "may", "meeting", "message", "model",
    "more", "most", "much", "must", "need", "network", "new", "next",
    "not", "note", "now", "number", "off", "only", "open", "option",
    "order", "other", "our", "out", "output", "over", "overview", "own",
    "page", "part", "password", "people", "performance", "place", "plan",
    "please", "point", "policy", "post", "power", "present", "process",
    "product", "program", "project", "provide", "public", "quality",
    "range", "real", "report", "request", "required", "resource",
    "result", "review", "right", "role", "run", "same", "schedule",
    "section", "security", "see", "server", "service", "set", "should",
    "show", "since", "site", "size", "small", "software", "some",
    "source", "standard", "start", "state", "step", "still", "storage",
    "such", "summary", "support", "system", "take", "target", "team",
    "technology", "test", "text", "than", "that", "the", "their", "them",
    "then", "there", "these", "they", "this", "those", "through", "time",
    "tool", "top", "total", "training", "type", "under", "update", "use",
    "used", "user", "using", "value", "version", "very", "view", "was",
    "way", "web", "well", "were", "what", "when", "where", "which",
    "while", "who", "will", "with", "without", "work", "working",
    "would", "year", "you", "your",
}

# Words that are internationally accepted even in non-English text.
# These should never be flagged.
_INTERNATIONAL_TERMS: set[str] = {
    "app", "blog", "brand", "browser", "budget", "cache", "chat", "cloud",
    "code", "cookie", "crash", "dashboard", "deadline", "debug", "demo",
    "deploy", "docker", "domain", "download", "drone", "emoji",
    "endpoint", "excel", "fair", "fake", "feedback", "film", "firewall",
    "fitness", "flash", "folder", "font", "format", "framework",
    "freelance", "gadget", "genre", "gps", "hacker", "hardware",
    "hashtag", "hobby", "homepage", "hosting", "hotspot", "html",
    "http", "https", "hub", "icon", "internet", "interview", "intranet",
    "jeans", "job", "jpeg", "json", "laptop", "laser", "layout",
    "level", "lifestyle", "like", "link", "live", "login", "logo",
    "look", "machine", "mainstream", "malware", "media", "memo",
    "memory", "menu", "micro", "modem", "mouse", "newsletter", "niche",
    "notebook", "offline", "online", "output", "outsourcing",
    "partner", "patch", "pdf", "phishing", "pixel", "plugin",
    "podcast", "pool", "popup", "portfolio", "post", "poster",
    "preview", "print", "printer", "profit", "provider", "proxy",
    "radar", "ranking", "rating", "reboot", "reload", "remote",
    "render", "responsive", "retail", "robot", "router", "saas",
    "scan", "scanner", "screenshot", "script", "scroll", "selfie",
    "sensor", "server", "share", "shop", "shopping", "shortcut",
    "signal", "site", "slider", "smartphone", "snippet", "socket",
    "spam", "sport", "sprint", "ssl", "startup", "status", "stock",
    "store", "stream", "streaming", "stress", "suite", "surf", "tag",
    "talent", "tablet", "template", "ticket", "timer", "token", "tool",
    "topic", "touchscreen", "trailer", "trend", "trigger",
    "tutorial", "tweet", "update", "upgrade", "upload", "url", "usb",
    "user", "vip", "virtual", "virus", "vpn", "web", "webcam",
    "webinar", "website", "widget", "wifi", "wiki", "workflow",
    "workshop", "xml", "zip", "zoom",
}

# Pattern to split text into word tokens
_WORD_RE = re.compile(r"[A-Za-zÀ-ÿ]+(?:['-][A-Za-zÀ-ÿ]+)*")


def detect_untranslated_english(
    translated_text: str,
    source_language: str,
    glossary_source_terms: Sequence[str] | None = None,
) -> list[str]:
    """Return a list of English words found in *translated_text* that likely
    should have been translated.

    Args:
        translated_text: The translated text in the target language.
        source_language: The source language code (e.g. "english", "en").
            If the source language is English, detection is skipped.
        glossary_source_terms: Optional set of glossary source terms that
            should not be flagged (they were intentionally kept).

    Returns:
        De-duplicated list of flagged English words (lowercased), ordered by
        first appearance.  Empty list if nothing is flagged.
    """
    # Skip detection when translating FROM a non-English source — the presence
    # of English words in the target is expected if the source isn't English
    # and the target IS English. We only flag when translating FROM English
    # into another language.
    src_lower = source_language.lower() if source_language else ""
    if src_lower not in ("english", "en"):
        return []

    glossary_lower = {t.lower() for t in (glossary_source_terms or [])}

    tokens = _WORD_RE.findall(translated_text)
    seen: set[str] = set()
    flagged: list[str] = []

    for i, token in enumerate(tokens):
        word_lower = token.lower()

        # Skip very short words — too many false positives
        if len(word_lower) <= 2:
            continue

        # Skip if not ASCII-letter-only (allows accented chars through)
        if not token.isascii():
            continue

        # Skip proper nouns: capitalised word not at sentence start
        if token[0].isupper() and i > 0:
            prev_char = translated_text[max(0, translated_text.index(token) - 2):translated_text.index(token)].strip()
            if prev_char and prev_char[-1] not in ".!?:":
                continue

        # Skip internationally accepted terms
        if word_lower in _INTERNATIONAL_TERMS:
            continue

        # Skip glossary terms (user intentionally kept them)
        if word_lower in glossary_lower:
            continue

        # Flag if it's a known common English word
        if word_lower in _COMMON_ENGLISH_WORDS and word_lower not in seen:
            seen.add(word_lower)
            flagged.append(word_lower)

    return flagged
