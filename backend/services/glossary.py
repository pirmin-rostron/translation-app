from models import GlossaryTerm


def normalize_optional(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def glossary_term_to_match(term: GlossaryTerm) -> dict:
    return {
        "id": term.id,
        "source_term": term.source_term,
        "target_term": term.target_term,
        "source_language": term.source_language,
        "target_language": term.target_language,
        "industry": term.industry,
        "domain": term.domain,
    }


def glossary_match_in_text(source_text: str, source_term: str) -> bool:
    return source_term.lower() in source_text.lower()
