"""add untranslated_words to translation_results

Revision ID: h9e2f3a4b5c6
Revises: g8d1e2f3a4b5
Create Date: 2026-05-13 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision: str = 'h9e2f3a4b5c6'
down_revision: Union[str, None] = 'g8d1e2f3a4b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add untranslated_words JSONB column to track English words detected in translated output."""
    op.add_column('translation_results', sa.Column('untranslated_words', JSONB, nullable=True))


def downgrade() -> None:
    """Remove untranslated_words column."""
    op.drop_column('translation_results', 'untranslated_words')
