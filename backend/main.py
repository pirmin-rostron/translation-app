import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import SessionLocal, init_db
from models import Document, TranslationJob
from routers import auth, documents, glossary_terms, translation_jobs
from seeds import seed_initial_admin

logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")

app = FastAPI(
    title="Document Translation API",
    description="Backend API for the document translation application",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Path("uploads").mkdir(exist_ok=True)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(glossary_terms.router)
app.include_router(translation_jobs.router)


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
                .filter(TranslationJob.status.in_({"translating", "parsing"}))
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
