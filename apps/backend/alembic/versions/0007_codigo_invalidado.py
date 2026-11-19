"""codigo de confirmacion invalidado por intentos fallidos por SMS

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-20 00:30:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '0007'
down_revision: str | None = '0006'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('confirmaciones_evacuado', sa.Column('codigo_invalidado_en', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('confirmaciones_evacuado', 'codigo_invalidado_en')
