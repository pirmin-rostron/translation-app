"""Webhook delivery — sign and fire per-org webhook endpoints."""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import Any

import httpx

logger = logging.getLogger(__name__)

WEBHOOK_TIMEOUT_SECONDS = 10


def sign_payload(secret: str, body: bytes) -> str:
    """Return HMAC-SHA256 hex digest of *body* using *secret*."""
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def deliver_webhook(
    hooks: list[tuple[str, str]],
    event: str,
    payload: dict[str, Any],
) -> None:
    """Fire webhooks for a list of (url, secret) tuples. Never raises — errors are logged.

    The caller must query and pass hook credentials before starting a background thread —
    this function deliberately takes no db session to avoid cross-thread session sharing.
    """
    if not hooks:
        return

    body = json.dumps(
        {"event": event, "sent_at": datetime.now(timezone.utc).isoformat(), "data": payload},
        default=str,
    ).encode()

    for url, secret in hooks:
        signature = sign_payload(secret, body)
        headers = {
            "Content-Type": "application/json",
            "X-Webhook-Event": event,
            "X-Webhook-Signature": f"sha256={signature}",
        }
        try:
            response = httpx.post(
                url,
                content=body,
                headers=headers,
                timeout=WEBHOOK_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            logger.info("Webhook delivered: event=%s url=%s status=%d", event, url, response.status_code)
        except Exception:
            logger.exception("Webhook delivery failed: event=%s url=%s", event, url)
