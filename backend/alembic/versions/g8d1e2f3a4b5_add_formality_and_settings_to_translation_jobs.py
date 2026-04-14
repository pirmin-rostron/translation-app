"""add formality, preserve_formatting, glossary_enabled to translation_jobs

Revision ID: g8d1e2f3a4b5
Revises: f7c0d1e2a3b4
Create Date: 2026-04-14 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g8d1e2f3a4b5'
down_revision: Union[str, None] = 'f7c0d1e2a3b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('translation_jobs', sa.Column('formality', sa.String(length=20), nullable=False, server_default='neutral'))
    op.add_column('translation_jobs', sa.Column('preserve_formatting', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    op.add_column('translation_jobs', sa.Column('glossary_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')))


def downgrade() -> None:
    op.drop_column('translation_jobs', 'glossary_enabled')
    op.drop_column('translation_jobs', 'preserve_formatting')
    op.drop_column('translation_jobs', 'formality')
