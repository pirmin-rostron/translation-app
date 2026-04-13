"""add due_date and reminder flags to translation_jobs

Revision ID: c4e7f8a9b1d2
Revises: b3f1a2c4d5e6
Create Date: 2026-04-13 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4e7f8a9b1d2'
down_revision: Union[str, None] = 'b3f1a2c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('translation_jobs', sa.Column('due_date', sa.Date(), nullable=True))
    op.add_column('translation_jobs', sa.Column('reminder_sent_3day', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('translation_jobs', sa.Column('reminder_sent_1day', sa.Boolean(), nullable=False, server_default=sa.text('false')))


def downgrade() -> None:
    op.drop_column('translation_jobs', 'reminder_sent_1day')
    op.drop_column('translation_jobs', 'reminder_sent_3day')
    op.drop_column('translation_jobs', 'due_date')
