"""ZIP archive unpacking for batch document uploads."""

from __future__ import annotations

import io
import zipfile
from pathlib import Path

MAX_ZIP_FILES = 20
ALLOWED_INNER_EXTENSIONS = {".docx", ".txt", ".rtf"}


def unpack_zip(file_bytes: bytes) -> tuple[list[tuple[str, bytes]], list[str]]:
    """Unpack a ZIP archive and return valid inner document files.

    Skips __MACOSX metadata, hidden files (names starting with '.'), files
    with unsupported extensions, and directories.  Raises ValueError when
    the number of valid files exceeds MAX_ZIP_FILES.

    Args:
        file_bytes: Raw bytes of the ZIP archive.

    Returns:
        A tuple of (valid_files, skipped_filenames) where valid_files is a
        list of (filename, file_bytes) tuples.
    """
    valid_files: list[tuple[str, bytes]] = []
    skipped: list[str] = []

    with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
        for info in zf.infolist():
            # Skip directory entries
            if info.is_dir():
                continue

            raw_name = info.filename
            basename = Path(raw_name).name

            # Skip macOS resource-fork metadata
            if "__MACOSX" in raw_name:
                skipped.append(basename)
                continue

            # Skip hidden files
            if basename.startswith("."):
                skipped.append(basename)
                continue

            ext = Path(basename).suffix.lower()
            if ext not in ALLOWED_INNER_EXTENSIONS:
                skipped.append(basename)
                continue

            valid_files.append((basename, zf.read(raw_name)))

    if len(valid_files) > MAX_ZIP_FILES:
        raise ValueError(
            f"ZIP contains {len(valid_files)} valid files — maximum is {MAX_ZIP_FILES}"
        )

    return valid_files, skipped
