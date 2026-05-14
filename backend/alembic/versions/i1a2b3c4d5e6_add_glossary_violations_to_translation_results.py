"""add glossary_violations to translation_results

Revision ID: i1a2b3c4d5e6
Revises: 07c859f5b40f
Create Date: 2026-05-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision: str = "i1a2b3c4d5e6"
down_revision: Union[str, None] = "07c859f5b40f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "translation_results",
        sa.Column("glossary_violations", JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("translation_results", "glossary_violations")
