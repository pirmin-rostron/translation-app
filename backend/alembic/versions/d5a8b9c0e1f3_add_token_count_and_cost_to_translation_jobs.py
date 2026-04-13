"""add token count and cost fields to translation_jobs

Revision ID: d5a8b9c0e1f3
Revises: c4e7f8a9b1d2
Create Date: 2026-04-14 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5a8b9c0e1f3'
down_revision: Union[str, None] = 'c4e7f8a9b1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('translation_jobs', sa.Column('token_count_input', sa.Integer(), nullable=True))
    op.add_column('translation_jobs', sa.Column('token_count_output', sa.Integer(), nullable=True))
    op.add_column('translation_jobs', sa.Column('estimated_api_cost_usd', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('translation_jobs', 'estimated_api_cost_usd')
    op.drop_column('translation_jobs', 'token_count_output')
    op.drop_column('translation_jobs', 'token_count_input')
