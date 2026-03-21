"""add org_webhooks table

Revision ID: 0007
Revises: 0006
Create Date: 2026-03-21

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "org_webhooks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("org_id", sa.Integer(), sa.ForeignKey("organisations.id"), nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("secret", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_org_webhooks_id", "org_webhooks", ["id"], unique=False)
    op.create_index("ix_org_webhooks_org_id", "org_webhooks", ["org_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_org_webhooks_org_id", table_name="org_webhooks")
    op.drop_index("ix_org_webhooks_id", table_name="org_webhooks")
    op.drop_table("org_webhooks")
