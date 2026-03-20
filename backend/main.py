import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
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


@app.on_event("startup")
def startup():
    init_db()
    seed_initial_admin()


@app.get("/health")
def health() -> dict:
    """Health check endpoint for monitoring and load balancers."""
    return {"status": "ok"}
