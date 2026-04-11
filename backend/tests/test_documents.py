"""Document parser tests — verify block output for all 3 test RTF files."""

from pathlib import Path

from services.parser import parse_document

TEST_DOCS_DIR = Path(__file__).resolve().parent.parent.parent / "test_docs" / "test_docs"


def test_parser_basic_rtf():
    filepath = TEST_DOCS_DIR / "basic_test.rtf"
    assert filepath.exists(), f"Missing test file: {filepath}"
    blocks = parse_document(filepath, "rtf")
    assert len(blocks) > 0, "basic_test.rtf should produce at least one block"
    for block in blocks:
        assert block.text_original.strip(), "Block should have non-empty text"


def test_parser_legal_rtf():
    filepath = TEST_DOCS_DIR / "legal_test.rtf"
    assert filepath.exists(), f"Missing test file: {filepath}"
    blocks = parse_document(filepath, "rtf")
    assert len(blocks) > 0, "legal_test.rtf should produce at least one block"


def test_parser_messy_rtf():
    filepath = TEST_DOCS_DIR / "messy_test.rtf"
    assert filepath.exists(), f"Missing test file: {filepath}"
    blocks = parse_document(filepath, "rtf")
    assert len(blocks) > 0, "messy_test.rtf should produce at least one block"


def test_parser_block_types():
    """Verify parser returns valid block types."""
    filepath = TEST_DOCS_DIR / "legal_test.rtf"
    blocks = parse_document(filepath, "rtf")
    valid_types = {"heading", "paragraph", "bullet_item"}
    for block in blocks:
        assert block.block_type in valid_types, f"Unexpected block type: {block.block_type}"


def test_upload_rtf(client, auth_headers):
    """Upload basic_test.rtf via the API and verify document is created."""
    filepath = TEST_DOCS_DIR / "basic_test.rtf"
    with open(filepath, "rb") as f:
        res = client.post(
            "/documents/upload",
            files={"file": ("basic_test.rtf", f, "application/rtf")},
            data={"target_language": "German"},
            headers=auth_headers,
        )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["filename"] == "basic_test.rtf"
    assert "id" in data
