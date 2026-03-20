"""add org model

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-21

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "organisations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_organisations_id"), "organisations", ["id"], unique=False)

    op.create_table(
        "org_memberships",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("org_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(), nullable=False, server_default="member"),
        sa.Column("joined_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["org_id"], ["organisations.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_org_memberships_id"), "org_memberships", ["id"], unique=False)
    op.create_index(op.f("ix_org_memberships_org_id"), "org_memberships", ["org_id"], unique=False)
    op.create_index(op.f("ix_org_memberships_user_id"), "org_memberships", ["user_id"], unique=False)

    op.add_column("documents", sa.Column("org_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_documents_org_id"), "documents", ["org_id"], unique=False)
    op.create_foreign_key(None, "documents", "organisations", ["org_id"], ["id"])

    op.add_column("translation_jobs", sa.Column("org_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_translation_jobs_org_id"), "translation_jobs", ["org_id"], unique=False)
    op.create_foreign_key(None, "translation_jobs", "organisations", ["org_id"], ["id"])

    op.add_column("glossary_terms", sa.Column("org_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_glossary_terms_org_id"), "glossary_terms", ["org_id"], unique=False)
    op.create_foreign_key(None, "glossary_terms", "organisations", ["org_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint(None, "glossary_terms", type_="foreignkey")
    op.drop_index(op.f("ix_glossary_terms_org_id"), table_name="glossary_terms")
    op.drop_column("glossary_terms", "org_id")

    op.drop_constraint(None, "translation_jobs", type_="foreignkey")
    op.drop_index(op.f("ix_translation_jobs_org_id"), table_name="translation_jobs")
    op.drop_column("translation_jobs", "org_id")

    op.drop_constraint(None, "documents", type_="foreignkey")
    op.drop_index(op.f("ix_documents_org_id"), table_name="documents")
    op.drop_column("documents", "org_id")

    op.drop_index(op.f("ix_org_memberships_user_id"), table_name="org_memberships")
    op.drop_index(op.f("ix_org_memberships_org_id"), table_name="org_memberships")
    op.drop_index(op.f("ix_org_memberships_id"), table_name="org_memberships")
    op.drop_table("org_memberships")

    op.drop_index(op.f("ix_organisations_id"), table_name="organisations")
    op.drop_table("organisations")
