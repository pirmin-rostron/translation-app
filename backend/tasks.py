from celery_app import celery_app


@celery_app.task(
    name="tasks.run_document_pipeline",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
)
def run_document_pipeline(self, document_id: int, user_id: int | None = None, org_id: int | None = None, translation_style: str = "natural"):
    """Parse and segment a document, then queue translation with the given style."""
    # Import here to avoid circular imports
    from routers.documents import _run_document_pipeline_from_task
    _run_document_pipeline_from_task(document_id=document_id, user_id=user_id, org_id=org_id, translation_style=translation_style)


@celery_app.task(
    name="tasks.run_translation_pipeline",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def run_translation_pipeline(self, translation_job_id: int, user_id: int | None = None, org_id: int | None = None):
    """Translate a document job."""
    from routers.translation_jobs import _run_translation_pipeline_from_task
    _run_translation_pipeline_from_task(translation_job_id=translation_job_id, user_id=user_id, org_id=org_id)
