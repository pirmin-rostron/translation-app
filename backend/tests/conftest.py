"""Shared test fixtures — test DB, client, authenticated user."""

import os

# Set env vars BEFORE any app imports (auth.py reads SECRET_KEY at import time).
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://translation:translation@localhost:5432/translation_test",
)
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")
# Make Celery run tasks synchronously in-process — no Redis/worker needed.
os.environ["CELERY_TASK_ALWAYS_EAGER"] = "true"

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app

from fastapi.testclient import TestClient
from limiter import limiter
from celery_app import celery_app as celery


TEST_DATABASE_URL = os.environ["DATABASE_URL"]

# Disable rate limiting for tests
limiter.enabled = False

# Run Celery tasks synchronously — no Redis/worker needed
celery.conf.update(task_always_eager=True, task_eager_propagates=True)

engine = create_engine(TEST_DATABASE_URL)
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _ensure_test_db_exists() -> None:
    """Create the translation_test database if it doesn't exist."""
    # Connect to the default 'translation' database to issue CREATE DATABASE.
    admin_url = TEST_DATABASE_URL.rsplit("/", 1)[0] + "/translation"
    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = 'translation_test'")
        ).fetchone()
        if not exists:
            conn.execute(text("CREATE DATABASE translation_test"))
    admin_engine.dispose()


_ensure_test_db_exists()


@pytest.fixture(autouse=True)
def _setup_db():
    """Create all tables before each test, drop after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db():
    """Yield a DB session for direct model access in tests."""
    session = TestSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db):
    """FastAPI TestClient with DB session override."""

    def _override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def test_user(client):
    """Register a user, create an org, and return (user_dict, token)."""
    res = client.post(
        "/auth/register",
        json={
            "email": "testuser@example.com",
            "password": "TestPassword123!",
            "full_name": "Test User",
        },
    )
    assert res.status_code == 201, res.text
    # Login to get token
    login_res = client.post(
        "/auth/login",
        data={"username": "testuser@example.com", "password": "TestPassword123!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login_res.status_code == 200, login_res.text
    data = login_res.json()
    token = data["access_token"]
    # Create an org so org-scoped endpoints work
    org_res = client.post(
        "/auth/org",
        json={"name": "Test Organisation"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert org_res.status_code == 201, org_res.text
    return data["user"], token


@pytest.fixture()
def auth_headers(test_user):
    """Authorization headers for authenticated requests."""
    _, token = test_user
    return {"Authorization": f"Bearer {token}"}
