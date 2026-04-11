"""Translation job lifecycle tests."""

from pathlib import Path

TEST_DOCS_DIR = Path(__file__).resolve().parent.parent.parent / "test_docs" / "test_docs"


def _upload_and_translate(client, auth_headers):
    """Helper: upload-and-translate, return the response JSON (includes job info)."""
    filepath = TEST_DOCS_DIR / "basic_test.rtf"
    with open(filepath, "rb") as f:
        res = client.post(
            "/documents/upload-and-translate",
            files={"file": ("basic_test.rtf", f, "application/rtf")},
            data={"target_language": "German", "translation_style": "natural"},
            headers=auth_headers,
        )
    assert res.status_code == 200, res.text
    return res.json()


def test_upload_and_translate_creates_job(client, auth_headers):
    data = _upload_and_translate(client, auth_headers)
    assert data["filename"] == "basic_test.rtf"
    assert "id" in data


def test_list_jobs(client, auth_headers):
    _upload_and_translate(client, auth_headers)
    res = client.get("/translation-jobs/", headers=auth_headers)
    assert res.status_code == 200
    jobs = res.json()
    assert isinstance(jobs, list)
    assert len(jobs) >= 1


def test_get_job_by_id(client, auth_headers):
    _upload_and_translate(client, auth_headers)
    # Get the job from the list
    list_res = client.get("/translation-jobs/", headers=auth_headers)
    assert list_res.status_code == 200
    jobs = list_res.json()
    assert len(jobs) >= 1
    job_id = jobs[0]["id"]
    res = client.get(f"/translation-jobs/{job_id}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["id"] == job_id
    assert res.json()["target_language"] == "German"
