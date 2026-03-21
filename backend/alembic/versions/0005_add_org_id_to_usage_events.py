"""add org_id to usage_events

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-21

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("usage_events", sa.Column("org_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_usage_events_org_id",
        "usage_events",
        "organisations",
        ["org_id"],
        ["id"],
    )
    op.create_index(op.f("ix_usage_events_org_id"), "usage_events", ["org_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_usage_events_org_id"), table_name="usage_events")
    op.drop_constraint("fk_usage_events_org_id", "usage_events", type_="foreignkey")
    op.drop_column("usage_events", "org_id")
