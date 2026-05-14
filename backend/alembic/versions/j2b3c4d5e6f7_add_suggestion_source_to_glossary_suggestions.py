"""add suggestion_source to glossary_term_suggestions

Revision ID: j2b3c4d5e6f7
Revises: i1a2b3c4d5e6
Create Date: 2026-05-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "j2b3c4d5e6f7"
down_revision: Union[str, None] = "i1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "glossary_term_suggestions",
        sa.Column("suggestion_source", sa.String(50), nullable=False, server_default="ai_extraction"),
    )


def downgrade() -> None:
    op.drop_column("glossary_term_suggestions", "suggestion_source")
