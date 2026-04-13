"""add description and due_date to projects

Revision ID: b3f1a2c4d5e6
Revises: 6bb309eb1ea9
Create Date: 2026-04-13 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3f1a2c4d5e6'
down_revision: Union[str, None] = '6bb309eb1ea9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('projects', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('projects', sa.Column('due_date', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('projects', 'due_date')
    op.drop_column('projects', 'description')
