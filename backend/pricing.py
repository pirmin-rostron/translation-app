"""Anthropic API pricing configuration and cost calculation."""

ANTHROPIC_PRICING: dict[str, dict[str, float]] = {
    "claude-sonnet-4-20250514": {
        "input_per_million": 3.00,
        "output_per_million": 15.00,
    },
}

# Fallback model key if exact model not found in pricing table
_DEFAULT_MODEL = "claude-sonnet-4-20250514"


def calculate_api_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate estimated USD cost for an Anthropic API call."""
    pricing = ANTHROPIC_PRICING.get(model, ANTHROPIC_PRICING[_DEFAULT_MODEL])
    return (input_tokens * pricing["input_per_million"] / 1_000_000) + \
           (output_tokens * pricing["output_per_million"] / 1_000_000)
