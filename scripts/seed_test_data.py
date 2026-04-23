#!/usr/bin/env python3
"""
Seed test data for the Helvara redesign QA.

Creates: 1 test user (or reuses existing), 1 project with 2 documents,
translation jobs in various statuses, and review blocks/segments for
testing the review page.

Run against local Docker postgres:
    docker compose exec -T backend python /app/../scripts/seed_test_data.py
Or directly (with venv activated + DATABASE_URL set):
    DATABASE_URL=postgresql://translation:translation@localhost:5432/translation \
    python scripts/seed_test_data.py

Idempotent — safe to run multiple times. Checks for existing data before inserting.
"""

import os
import sys
import json
from datetime import datetime, date, timedelta

# Add backend to path so we can import models
backend_dir = os.path.join(os.path.dirname(__file__), "..", "backend")
sys.path.insert(0, os.path.abspath(backend_dir))

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://translation:translation@localhost:5432/translation",
)
os.environ.setdefault("SECRET_KEY", "dev-secret-key-change-in-production")

from database import SessionLocal, init_db
from models import (
    Organisation,
    User,
    OrgMembership,
    Project,
    Document,
    DocumentBlock,
    DocumentSegment,
    TranslationJob,
    TranslationResult,
    ProcessingStageJob,
    GlossaryTerm,
    SegmentAnnotation,
)
from services.auth import hash_password

# ── Constants ────────────────────────────────────────────────────────────────

TEST_EMAIL = "pirmin@translationapp.com"
TEST_PASSWORD = "Admin1234!"
ORG_NAME = "Pirmin's Workspace"
PROJECT_NAME = "Nova Launch — Spring Campaign"
NOW = datetime.utcnow()

# Source text blocks for document 1 (press release)
PRESS_RELEASE_BLOCKS = [
    {
        "type": "heading",
        "source": "Nova Wireless Headphones — Press Release",
        "target": "Auriculares inalámbricos Nova — Comunicado de prensa",
    },
    {
        "type": "paragraph",
        "source": "Today we're unveiling Nova, a wireless headphone built around the simple idea that great sound should disappear into the moment.",
        "target": "Hoy presentamos Nova, unos auriculares inalámbricos diseñados en torno a una idea simple: que el gran sonido debería desaparecer en el momento.",
        "insights": {"glossary": True, "glossary_term": "Nova", "glossary_note": "Product name — do not translate"},
        "memory": {"used": True, "score": 0.92, "note": "Strong match from Autumn Nova campaign"},
    },
    {
        "type": "paragraph",
        "source": "Built for creators who move between studio and street, Nova pairs studio-grade drivers with adaptive noise cancellation that learns your environment.",
        "target": "Creados para quienes se mueven entre el estudio y la calle, Nova combina controladores de calidad profesional con cancelación de ruido adaptativa que aprende de tu entorno.",
        "memory": {"used": True, "score": 0.92, "note": "92% match — Autumn campaign, reused phrasing"},
    },
    {
        "type": "paragraph",
        "source": "Charge for ten minutes, run for ten hours.",
        "target": "Cárgalos diez minutos, úsalos diez horas.",
        "ambiguity": {
            "source_span": "Charge for ten minutes, run for ten hours.",
            "explanation": "Tagline structure — parallelism can read imperative or editorial.",
            "alternatives": [
                {"meaning": "Imperative — source-faithful", "translation": "Cárgalos diez minutos, úsalos diez horas."},
                {"meaning": "Editorial — brand-forward", "translation": "Diez minutos de carga, diez horas de uso."},
                {"meaning": "Active — punchy, rhythmic", "translation": "Diez minutos cargando, diez horas escuchando."},
            ],
        },
    },
    {
        "type": "paragraph",
        "source": 'Nova ships in three finishes — Ink, Sand, and Moss — each cut from recycled aluminum.',
        "target": "Nova llega en tres acabados —Tinta, Arena y Musgo—, fabricados con aluminio reciclado.",
        "ambiguity": {
            "source_span": "ships in",
            "explanation": '"Ships in" is colloquial; "llega en" reads like a launch announcement.',
            "alternatives": [
                {"meaning": "Natural — preferred", "translation": "Nova llega en tres acabados —Tinta, Arena y Musgo—, fabricados con aluminio reciclado."},
                {"meaning": "Literal — source-faithful", "translation": "Nova se ofrece en tres acabados —Tinta, Arena y Musgo—, cortados en aluminio reciclado."},
            ],
        },
        "insights": {"glossary": True, "glossary_term": "Ink / Sand / Moss", "glossary_note": "Color names — approved Spanish set"},
    },
    {
        "type": "paragraph",
        "source": "Pre-orders open today at helvara.example.com/nova.",
        "target": "Las reservas abren hoy en helvara.example.com/nova.",
    },
    {
        "type": "paragraph",
        "source": "Price starts at $299 USD, with regional pricing in local currencies at checkout.",
        "target": "El precio inicia en 299 USD, con precios regionales en monedas locales al pagar.",
        "insights": {"glossary": True, "glossary_term": "USD", "glossary_note": "Keep currency codes as-is"},
    },
    {
        "type": "paragraph",
        "source": "We can't wait for you to hear it.",
        "target": "Estamos deseando que lo escuches.",
        "memory": {"used": True, "score": 0.88, "note": "Consistent with past brand voice"},
    },
]

# Source text blocks for document 2 (product onepager)
ONEPAGER_BLOCKS = [
    {
        "type": "heading",
        "source": "Nova Product One-Pager",
        "target": "Nova — Resumen del producto",
    },
    {
        "type": "paragraph",
        "source": "Nova redefines wireless audio with studio-grade 50mm drivers, adaptive hybrid ANC, and a battery that lasts all day on a single charge.",
        "target": "Nova redefine el audio inalámbrico con controladores de 50 mm de calidad profesional, cancelación de ruido adaptativa híbrida y una batería que dura todo el día con una sola carga.",
    },
    {
        "type": "paragraph",
        "source": "Three premium finishes — Ink, Sand, Moss — crafted from 100% recycled aluminum.",
        "target": "Tres acabados premium —Tinta, Arena, Musgo— fabricados con aluminio 100% reciclado.",
    },
    {
        "type": "paragraph",
        "source": "Available in North America, Europe, and Mexico at launch. Expanding to Asia-Pacific in Q3.",
        "target": "Disponible en América del Norte, Europa y México en el lanzamiento. Expansión a Asia-Pacífico en el tercer trimestre.",
    },
]


def seed():
    db = SessionLocal()
    try:
        _seed(db)
    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        db.close()


def _seed(db):
    # ── 1. Org + User ────────────────────────────────────────────────────
    org = db.query(Organisation).filter(Organisation.name == ORG_NAME).first()
    if not org:
        org = Organisation(name=ORG_NAME, tier="free", is_active=True)
        db.add(org)
        db.flush()
        print(f"  Created org: {org.name} (id={org.id})")
    else:
        print(f"  Using existing org: {org.name} (id={org.id})")

    user = db.query(User).filter(User.email == TEST_EMAIL).first()
    if not user:
        user = User(
            email=TEST_EMAIL,
            hashed_password=hash_password(TEST_PASSWORD),
            full_name="Pirmin",
            is_active=True,
            is_admin=True,
        )
        db.add(user)
        db.flush()
        print(f"  Created user: {user.email} (id={user.id})")
    else:
        print(f"  Using existing user: {user.email} (id={user.id})")

    membership = (
        db.query(OrgMembership)
        .filter(OrgMembership.org_id == org.id, OrgMembership.user_id == user.id)
        .first()
    )
    if not membership:
        membership = OrgMembership(org_id=org.id, user_id=user.id, role="owner")
        db.add(membership)
        db.flush()

    # ── 2. Project ────────────────────────────────────────────────────────
    project = (
        db.query(Project)
        .filter(Project.org_id == org.id, Project.name == PROJECT_NAME)
        .first()
    )
    if project:
        print(f"  Project '{PROJECT_NAME}' already exists (id={project.id}) — skipping seed.")
        print("  To re-seed, delete the project first:")
        print(f"    docker compose exec -T postgres psql -U translation -c \"DELETE FROM projects WHERE id={project.id};\"")
        db.commit()
        return

    project = Project(
        org_id=org.id,
        name=PROJECT_NAME,
        description="Hero site copy, press release, and product one-pager for the Nova headphones launch across Spanish-speaking markets.",
        target_languages=json.dumps(["Spanish", "French"]),
        default_tone="neutral",
        due_date=date.today() + timedelta(days=12),
    )
    db.add(project)
    db.flush()
    print(f"  Created project: {project.name} (id={project.id})")

    # ── 3. Glossary terms ─────────────────────────────────────────────────
    glossary_pairs = [
        ("Nova", "Nova", "Product name — do not translate"),
        ("adaptive noise cancellation", "cancelación de ruido adaptativa", "Technical term"),
        ("Ink", "Tinta", "Color name — Nova finish"),
        ("Sand", "Arena", "Color name — Nova finish"),
        ("Moss", "Musgo", "Color name — Nova finish"),
    ]
    for src, tgt, _note in glossary_pairs:
        existing = (
            db.query(GlossaryTerm)
            .filter(
                GlossaryTerm.org_id == org.id,
                GlossaryTerm.source_term == src,
                GlossaryTerm.target_language == "Spanish",
            )
            .first()
        )
        if not existing:
            db.add(GlossaryTerm(
                source_term=src,
                target_term=tgt,
                source_language="English",
                target_language="Spanish",
                org_id=org.id,
            ))
    db.flush()
    print(f"  Seeded {len(glossary_pairs)} glossary terms")

    # ── 4. Document 1 — Press Release (in_review) ────────────────────────
    doc1 = _create_document(
        db, org, project,
        filename="nova-press-release.rtf",
        file_type="rtf",
        blocks_data=PRESS_RELEASE_BLOCKS,
    )
    job1 = _create_job(
        db, org, doc1,
        target_language="Spanish",
        status="in_review",
        blocks_data=PRESS_RELEASE_BLOCKS,
    )
    print(f"  Created doc1: {doc1.filename} (id={doc1.id}) with job (id={job1.id}, status=in_review)")

    # ── 5. Document 1 — second job (processing, FR) ──────────────────────
    job1_fr = _create_job(
        db, org, doc1,
        target_language="French",
        status="translating",
        blocks_data=None,  # no results yet
        progress_pct=42,
    )
    print(f"  Created job for FR: (id={job1_fr.id}, status=translating, 42%)")

    # ── 6. Document 2 — Onepager (completed) ─────────────────────────────
    doc2 = _create_document(
        db, org, project,
        filename="nova-product-onepager.docx",
        file_type="docx",
        blocks_data=ONEPAGER_BLOCKS,
    )
    job2 = _create_job(
        db, org, doc2,
        target_language="Spanish",
        status="completed",
        blocks_data=ONEPAGER_BLOCKS,
        all_approved=True,
    )
    print(f"  Created doc2: {doc2.filename} (id={doc2.id}) with job (id={job2.id}, status=completed)")

    # ── 7. Document 2 — exported job ─────────────────────────────────────
    job2_exp = _create_job(
        db, org, doc2,
        target_language="French",
        status="exported",
        blocks_data=ONEPAGER_BLOCKS,
        all_approved=True,
    )
    print(f"  Created exported job for FR: (id={job2_exp.id}, status=exported)")

    db.commit()
    print()
    print("=== Seed complete ===")
    print(f"  Login: {TEST_EMAIL} / {TEST_PASSWORD}")
    print(f"  Project: {project.name} (id={project.id})")
    print(f"  Review page: /translation-jobs/{job1.id}")
    print(f"  Documents: {doc1.filename} (id={doc1.id}), {doc2.filename} (id={doc2.id})")


def _create_document(db, org, project, filename, file_type, blocks_data):
    """Create a document with blocks and segments."""
    total_words = sum(len(b["source"].split()) for b in blocks_data)

    doc = Document(
        filename=filename,
        stored_filename=f"seed_{filename}",
        file_type=file_type,
        source_language="English",
        target_language="Spanish",
        org_id=org.id,
        project_id=project.id,
        status="parsed",
        created_at=NOW - timedelta(days=3),
    )
    db.add(doc)
    db.flush()

    for i, bdata in enumerate(blocks_data):
        block = DocumentBlock(
            document_id=doc.id,
            block_index=i,
            block_type=bdata["type"],
            text_original=bdata["source"],
            text_translated=bdata["target"],
        )
        db.add(block)
        db.flush()

        seg = DocumentSegment(
            document_id=doc.id,
            block_id=block.id,
            segment_index=i,
            segment_type=bdata["type"],
            source_text=bdata["source"],
        )
        db.add(seg)
        db.flush()

        # Store segment ID on block data for job creation
        bdata["_block_id"] = block.id
        bdata["_segment_id"] = seg.id

    return doc


def _create_job(db, org, doc, target_language, status, blocks_data, all_approved=False, progress_pct=None):
    """Create a translation job with results."""
    total_segments = len(blocks_data) if blocks_data else 0
    completed = total_segments if status in ("in_review", "completed", "exported", "ready_for_export") else 0

    if progress_pct is not None:
        completed = int(total_segments * progress_pct / 100) if total_segments else 0

    job = TranslationJob(
        document_id=doc.id,
        source_language="English",
        target_language=target_language,
        status=status,
        review_mode="autopilot",
        translation_style="natural",
        org_id=org.id,
        progress_total_segments=total_segments,
        progress_completed_segments=completed,
        progress_started_at=NOW - timedelta(hours=1),
        created_at=NOW - timedelta(hours=2),
        last_saved_at=NOW - timedelta(minutes=10) if status == "in_review" else None,
    )
    db.add(job)
    db.flush()

    # Processing stage
    stage_status = "completed" if status in ("in_review", "completed", "exported") else "processing"
    db.add(ProcessingStageJob(
        document_id=doc.id,
        translation_job_id=job.id,
        stage_name="translation",
        status=stage_status,
        started_at=NOW - timedelta(hours=1),
        finished_at=NOW - timedelta(minutes=30) if stage_status == "completed" else None,
    ))

    if not blocks_data:
        db.flush()
        return job

    # Create translation results for each segment
    for i, bdata in enumerate(blocks_data):
        seg_id = bdata.get("_segment_id")
        if not seg_id:
            continue

        has_ambiguity = "ambiguity" in bdata
        amb_details = bdata.get("ambiguity")
        has_glossary = bdata.get("insights", {}).get("glossary", False)
        memory_info = bdata.get("memory", {})
        has_memory = memory_info.get("used", False)

        # Determine review status
        if all_approved:
            review_status = "approved"
        elif has_ambiguity:
            review_status = "unreviewed"
        elif i < 3:
            review_status = "approved"  # first few blocks auto-approved
        else:
            review_status = "unreviewed"

        glossary_matches = None
        if has_glossary:
            insights = bdata["insights"]
            glossary_matches = {
                "matches": [{
                    "source_term": insights.get("glossary_term", ""),
                    "target_term": insights.get("glossary_note", ""),
                }]
            }

        semantic_details = None
        if has_memory:
            semantic_details = {
                "match_type": "semantic_memory",
                "suggested_translation": bdata["target"],
                "similarity_score": memory_info.get("score", 0.9),
                "source_text": bdata["source"],
            }

        ambiguity_details_json = None
        if amb_details:
            ambiguity_details_json = {
                "source_span": amb_details["source_span"],
                "explanation": amb_details["explanation"],
                "alternatives": amb_details["alternatives"],
            }

        result = TranslationResult(
            job_id=job.id,
            segment_id=seg_id,
            primary_translation=bdata["target"],
            final_translation=bdata["target"],
            confidence_score=memory_info.get("score", 0.85) if has_memory else 0.80,
            review_status=review_status,
            exact_memory_used=False,
            semantic_memory_used=has_memory,
            semantic_memory_details=semantic_details,
            ambiguity_detected=has_ambiguity,
            ambiguity_details=ambiguity_details_json,
            glossary_applied=has_glossary,
            glossary_matches=glossary_matches,
        )
        db.add(result)

        # Add ambiguity annotation if applicable
        if has_ambiguity and amb_details:
            span_text = amb_details["source_span"]
            source_text = bdata["source"]
            start = source_text.find(span_text)
            end = start + len(span_text) if start >= 0 else 0

            db.add(SegmentAnnotation(
                segment_id=seg_id,
                translation_job_id=job.id,
                annotation_type="ambiguity",
                source_span_text=span_text,
                source_start=max(0, start),
                source_end=max(0, end),
                target_span_text=None,
                target_start=None,
                target_end=None,
                metadata_json={
                    "explanation": amb_details["explanation"],
                    "alternatives": amb_details["alternatives"],
                },
            ))

    db.flush()
    return job


if __name__ == "__main__":
    print("Seeding test data...")
    print()
    seed()
