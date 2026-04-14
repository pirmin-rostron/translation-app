"""add lifetime stats to organisations

Revision ID: f7c0d1e2a3b4
Revises: e6b9c0d1f2a3
Create Date: 2026-04-14 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7c0d1e2a3b4'
down_revision: Union[str, None] = 'e6b9c0d1f2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('organisations', sa.Column('words_translated_lifetime', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('organisations', sa.Column('jobs_completed_lifetime', sa.Integer(), nullable=False, server_default='0'))

    # Backfill from existing usage events and completed jobs
    conn = op.get_bind()

    # Backfill jobs_completed_lifetime: count completed/exported jobs per org
    conn.execute(sa.text("""
        UPDATE organisations SET jobs_completed_lifetime = sub.cnt
        FROM (
            SELECT org_id, COUNT(*) as cnt
            FROM translation_jobs
            WHERE deleted_at IS NULL
              AND status IN ('exported', 'completed', 'ready_for_export', 'review_complete', 'in_review')
            GROUP BY org_id
        ) sub
        WHERE organisations.id = sub.org_id
    """))

    # Backfill words_translated_lifetime: sum word_count from usage events per org
    conn.execute(sa.text("""
        UPDATE organisations SET words_translated_lifetime = sub.total_words
        FROM (
            SELECT org_id, SUM(COALESCE((meta->>'word_count')::int, 0)) as total_words
            FROM usage_events
            WHERE event_type = 'words_translated'
              AND org_id IS NOT NULL
            GROUP BY org_id
        ) sub
        WHERE organisations.id = sub.org_id
    """))


def downgrade() -> None:
    op.drop_column('organisations', 'jobs_completed_lifetime')
    op.drop_column('organisations', 'words_translated_lifetime')
