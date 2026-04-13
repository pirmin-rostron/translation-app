from celery_app import celery_app


@celery_app.task(
    name="tasks.run_document_pipeline",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
)
def run_document_pipeline(self, document_id: int, user_id: int | None = None, org_id: int | None = None, translation_style: str = "natural", review_mode: str = "autopilot", fan_out_languages: list[str] | None = None):
    """Parse and segment a document, then queue translation with the given style."""
    # Import here to avoid circular imports
    from routers.documents import _run_document_pipeline_from_task
    _run_document_pipeline_from_task(document_id=document_id, user_id=user_id, org_id=org_id, translation_style=translation_style, review_mode=review_mode, fan_out_languages=fan_out_languages)


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


@celery_app.task(name="tasks.check_due_date_reminders")
def check_due_date_reminders():
    """Daily task: find jobs/projects due within 3 days and log reminders.

    Updates reminder_sent_3day / reminder_sent_1day flags to avoid duplicates.
    Does NOT send emails yet — SES not live.
    """
    import logging
    from datetime import date, timedelta
    from database import SessionLocal
    from models import TranslationJob, Project

    logger = logging.getLogger("tasks.reminders")
    db = SessionLocal()
    try:
        today = date.today()
        three_days = today + timedelta(days=3)
        one_day = today + timedelta(days=1)

        # Jobs due within 3 days that haven't had a 3-day reminder
        jobs_3d = (
            db.query(TranslationJob)
            .filter(
                TranslationJob.deleted_at.is_(None),
                TranslationJob.due_date.isnot(None),
                TranslationJob.due_date <= three_days,
                TranslationJob.due_date >= today,
                TranslationJob.reminder_sent_3day.is_(False),
            )
            .all()
        )
        for job in jobs_3d:
            logger.info("3-day reminder: job_id=%d due=%s status=%s", job.id, job.due_date, job.status)
            # TODO: Send SES email reminder here when SES is live
            job.reminder_sent_3day = True

        # Jobs due within 1 day that haven't had a 1-day reminder
        jobs_1d = (
            db.query(TranslationJob)
            .filter(
                TranslationJob.deleted_at.is_(None),
                TranslationJob.due_date.isnot(None),
                TranslationJob.due_date <= one_day,
                TranslationJob.due_date >= today,
                TranslationJob.reminder_sent_1day.is_(False),
            )
            .all()
        )
        for job in jobs_1d:
            logger.info("1-day reminder: job_id=%d due=%s status=%s", job.id, job.due_date, job.status)
            # TODO: Send SES email reminder here when SES is live
            job.reminder_sent_1day = True

        # Projects due within 3 days (log only — no reminder flags on Project model)
        projects_3d = (
            db.query(Project)
            .filter(
                Project.deleted_at.is_(None),
                Project.due_date.isnot(None),
                Project.due_date <= three_days,
                Project.due_date >= today,
            )
            .all()
        )
        for proj in projects_3d:
            logger.info("Project reminder: project_id=%d name=%s due=%s", proj.id, proj.name, proj.due_date)
            # TODO: Send SES email reminder here when SES is live

        db.commit()
        logger.info("Due date reminder check complete: %d job 3-day, %d job 1-day, %d project reminders",
                     len(jobs_3d), len(jobs_1d), len(projects_3d))
    except Exception:
        logger.exception("Due date reminder task failed")
    finally:
        db.close()
