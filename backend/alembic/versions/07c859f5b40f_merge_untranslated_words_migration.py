"""merge untranslated_words migration

Revision ID: 07c859f5b40f
Revises: 9fe5c3ea5a26, h9e2f3a4b5c6
Create Date: 2026-05-13 22:00:32.023552

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '07c859f5b40f'
down_revision: Union[str, Sequence[str], None] = ('9fe5c3ea5a26', 'h9e2f3a4b5c6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
