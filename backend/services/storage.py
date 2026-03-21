"""Storage abstraction — local disk and S3 backends.

Select the backend with the STORAGE_BACKEND env var: "local" (default) or "s3".
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Protocol

logger = logging.getLogger(__name__)

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))


class StorageBackend(Protocol):
    def save(self, filename: str, content: bytes, content_type: str) -> str:
        """Save content and return the storage key used to retrieve it later."""

    def load(self, path: str) -> bytes:
        """Load and return file content by the key returned from save()."""

    def delete(self, path: str) -> None:
        """Delete a file by key. Never raises."""

    def get_url(self, path: str) -> str:
        """Return a URL or path that can be used to serve the file."""


class LocalStorageBackend:
    """Stores files on the local filesystem under UPLOAD_DIR."""

    def __init__(self) -> None:
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    def save(self, filename: str, content: bytes, content_type: str) -> str:
        (UPLOAD_DIR / filename).write_bytes(content)
        return filename

    def load(self, path: str) -> bytes:
        return (UPLOAD_DIR / path).read_bytes()

    def delete(self, path: str) -> None:
        try:
            (UPLOAD_DIR / path).unlink()
        except FileNotFoundError:
            logger.warning("LocalStorage delete: file not found: %s", path)
        except Exception:
            logger.exception("LocalStorage delete: unexpected error for path: %s", path)

    def get_url(self, path: str) -> str:
        return str(UPLOAD_DIR / path)


class S3StorageBackend:
    """Stores files in an S3 bucket. Requires boto3 and AWS credentials."""

    def __init__(self) -> None:
        try:
            import boto3
        except ImportError:
            raise RuntimeError(
                "boto3 is required for S3 storage. Add boto3 to requirements.txt."
            )

        bucket = os.getenv("S3_BUCKET_NAME")
        if not bucket:
            raise RuntimeError(
                "S3_BUCKET_NAME environment variable is required when STORAGE_BACKEND=s3"
            )
        access_key = os.getenv("AWS_ACCESS_KEY_ID")
        secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
        if not access_key or not secret_key:
            raise RuntimeError(
                "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required when STORAGE_BACKEND=s3"
            )
        region = os.getenv("AWS_REGION", "ap-southeast-2")

        self._bucket = bucket
        self._client = boto3.client(
            "s3",
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region,
        )

    def save(self, filename: str, content: bytes, content_type: str) -> str:
        self._client.put_object(
            Bucket=self._bucket,
            Key=filename,
            Body=content,
            ContentType=content_type,
        )
        return filename

    def load(self, path: str) -> bytes:
        response = self._client.get_object(Bucket=self._bucket, Key=path)
        return response["Body"].read()

    def delete(self, path: str) -> None:
        try:
            self._client.delete_object(Bucket=self._bucket, Key=path)
        except Exception:
            logger.exception("S3 delete failed for key: %s", path)

    def get_url(self, path: str) -> str:
        # Presigned URLs to be added when S3 is fully activated.
        return f"s3://{self._bucket}/{path}"


def get_storage() -> StorageBackend:
    """Return the configured storage backend.

    STORAGE_BACKEND env var: "local" (default) or "s3".
    Fails fast with a clear error if "s3" is requested without credentials.
    """
    backend = os.getenv("STORAGE_BACKEND", "local").lower()
    if backend == "s3":
        return S3StorageBackend()
    return LocalStorageBackend()
