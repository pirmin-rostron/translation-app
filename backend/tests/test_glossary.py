"""Glossary term CRUD tests."""


def test_create_term(client, auth_headers):
    res = client.post(
        "/glossary-terms",
        json={
            "source_term": "Force Majeure",
            "target_term": "Höhere Gewalt",
            "source_language": "English",
            "target_language": "German",
            "industry": None,
            "domain": "legal",
        },
        headers=auth_headers,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["source_term"] == "Force Majeure"
    assert data["target_term"] == "Höhere Gewalt"
    assert "id" in data


def test_list_terms(client, auth_headers):
    # Create a term first
    client.post(
        "/glossary-terms",
        json={
            "source_term": "Indemnification",
            "target_term": "Entschädigung",
            "source_language": "English",
            "target_language": "German",
            "industry": None,
            "domain": None,
        },
        headers=auth_headers,
    )
    res = client.get("/glossary-terms", headers=auth_headers)
    assert res.status_code == 200
    terms = res.json()
    assert isinstance(terms, list)
    assert len(terms) >= 1


def test_create_term_unauthenticated(client):
    res = client.post(
        "/glossary-terms",
        json={
            "source_term": "test",
            "target_term": "test",
            "source_language": "English",
            "target_language": "German",
            "industry": None,
            "domain": None,
        },
    )
    assert res.status_code == 401
