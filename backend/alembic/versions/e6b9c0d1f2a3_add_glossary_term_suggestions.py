"""add glossary_term_suggestions table

Revision ID: e6b9c0d1f2a3
Revises: d5a8b9c0e1f3
Create Date: 2026-04-14 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6b9c0d1f2a3'
down_revision: Union[str, None] = 'd5a8b9c0e1f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'glossary_term_suggestions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('org_id', sa.Integer(), nullable=False),
        sa.Column('job_id', sa.Integer(), nullable=False),
        sa.Column('source_term', sa.String(length=255), nullable=False),
        sa.Column('target_term', sa.String(length=255), nullable=False),
        sa.Column('source_language', sa.String(length=50), nullable=False),
        sa.Column('target_language', sa.String(length=50), nullable=False),
        sa.Column('frequency', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['org_id'], ['organisations.id']),
        sa.ForeignKeyConstraint(['job_id'], ['translation_jobs.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_glossary_term_suggestions_id', 'glossary_term_suggestions', ['id'])
    op.create_index('ix_glossary_term_suggestions_org_id', 'glossary_term_suggestions', ['org_id'])
    op.create_index('ix_glossary_term_suggestions_job_id', 'glossary_term_suggestions', ['job_id'])


def downgrade() -> None:
    op.drop_table('glossary_term_suggestions')
