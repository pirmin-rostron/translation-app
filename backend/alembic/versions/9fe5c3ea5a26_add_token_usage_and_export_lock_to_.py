"""add token usage and export lock to translation_jobs

Revision ID: 9fe5c3ea5a26
Revises: g8d1e2f3a4b5
Create Date: 2026-04-24 23:34:17.514336

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9fe5c3ea5a26'
down_revision: Union[str, Sequence[str], None] = 'g8d1e2f3a4b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('translation_jobs', sa.Column('tokens_last_updated', sa.DateTime(), nullable=True))
    op.add_column('translation_jobs', sa.Column('exported_at', sa.DateTime(), nullable=True))
    op.add_column('translation_jobs', sa.Column('locked', sa.Boolean(), nullable=False, server_default=sa.text('false')))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('translation_jobs', 'locked')
    op.drop_column('translation_jobs', 'exported_at')
    op.drop_column('translation_jobs', 'tokens_last_updated')
