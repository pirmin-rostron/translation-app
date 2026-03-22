"""add waitlist_entries

Revision ID: 0009
Revises: 0008
Create Date: 2026-03-22
"""

from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "waitlist_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_waitlist_entries_id", "waitlist_entries", ["id"])
    op.create_index("ix_waitlist_entries_email", "waitlist_entries", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_waitlist_entries_email", table_name="waitlist_entries")
    op.drop_index("ix_waitlist_entries_id", table_name="waitlist_entries")
    op.drop_table("waitlist_entries")
