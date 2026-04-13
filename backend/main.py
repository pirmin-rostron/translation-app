import logging
import os
from pathlib import Path

import redis as redis_lib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from database import SessionLocal, engine, init_db
from limiter import limiter
from models import Document, TranslationJob
from routers import auth, dashboard, documents, glossary_terms, projects, stats, translation_jobs, waitlist
from seeds import seed_initial_admin

logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")

app = FastAPI(
    title="Document Translation API",
    description="Backend API for the document translation application",
    version="0.1.0",
)

# CORS origins are configured via the ALLOWED_ORIGINS env var (comma-separated).
# Defaults to localhost for local dev. Set ALLOWED_ORIGINS=https://helvara.io in
# production .env — see .env.example.
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

Path("uploads").mkdir(exist_ok=True)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(glossary_terms.router)
app.include_router(projects.router)
app.include_router(translation_jobs.router)
app.include_router(waitlist.router)
app.include_router(stats.router)
app.include_router(dashboard.router)


def recover_stuck_jobs() -> None:
    """Reset jobs and documents stuck in transient states due to a server crash.

    Any job or document that was mid-processing when the server crashed will be
    stuck in an in-progress state forever. This resets them to a retryable failed
    state so the user can retry via the UI.
    """
    try:
        db = SessionLocal()
        try:
            stuck_jobs = (
                db.query(TranslationJob)
                .filter(TranslationJob.status.in_({"translating", "parsing", "queued"}))
                .all()
            )
            for job in stuck_jobs:
                job.status = "translation_failed"
                job.error_message = "Job was interrupted by a server restart. Please retry."

            stuck_docs = (
                db.query(Document)
                .filter(Document.status.in_({"parsing", "segmenting"}))
                .all()
            )
            for doc in stuck_docs:
                doc.status = "parse_failed"
                doc.error_message = "Processing was interrupted by a server restart. Please retry."

            db.commit()
            if stuck_jobs or stuck_docs:
                logging.info(
                    "Crash recovery: reset %d stuck job(s) and %d stuck document(s)",
                    len(stuck_jobs),
                    len(stuck_docs),
                )
            else:
                logging.info("Crash recovery: no stuck jobs or documents found")
        finally:
            db.close()
    except Exception:
        logging.exception("Crash recovery scan failed — continuing startup")


@app.on_event("startup")
def startup():
    init_db()
    seed_initial_admin()
    recover_stuck_jobs()


@app.get("/health")
def health() -> dict:
    """Health check endpoint for monitoring and load balancers."""
    return {"status": "ok"}


@app.get("/health/ready")
def health_ready() -> JSONResponse:
    """Readiness check — verifies DB and Redis connectivity.

    Returns 200 when all dependencies are reachable, 503 when any are not.
    Never exposes internal error details in the response body.
    """
    db_status = "ok"
    redis_status = "ok"

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        logging.exception("Readiness check: DB connection failed")
        db_status = "error"

    try:
        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        r = redis_lib.from_url(redis_url, socket_connect_timeout=2)
        r.ping()
    except Exception:
        logging.exception("Readiness check: Redis connection failed")
        redis_status = "error"

    all_ok = db_status == "ok" and redis_status == "ok"
    http_status = 200 if all_ok else 503
    return JSONResponse(
        status_code=http_status,
        content={
            "status": "ready" if all_ok else "degraded",
            "db": db_status,
            "redis": redis_status,
        },
    )
