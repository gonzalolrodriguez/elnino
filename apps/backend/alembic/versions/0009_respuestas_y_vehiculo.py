"""respuestas de confirmacion de cinco opciones y vehiculo de la cuadrilla

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-20 18:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '0009'
down_revision: str | None = '0008'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        'confirmaciones_evacuado', 'respuesta',
        existing_type=sa.String(length=10), type_=sa.String(length=20), existing_nullable=True,
    )
    # Valores anteriores -> canonicos.
    op.execute("UPDATE confirmaciones_evacuado SET respuesta = 'completa' WHERE respuesta = 'si'")
    op.execute("UPDATE confirmaciones_evacuado SET respuesta = 'no_vinieron' WHERE respuesta = 'no'")
    op.execute("UPDATE confirmaciones_evacuado SET respuesta = 'otro_problema' WHERE respuesta = 'problema'")
    op.add_column('cuadrillas', sa.Column('vehiculo', sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column('cuadrillas', 'vehiculo')
    op.execute("UPDATE confirmaciones_evacuado SET respuesta = 'si' WHERE respuesta = 'completa'")
    op.execute("UPDATE confirmaciones_evacuado SET respuesta = 'no' WHERE respuesta = 'no_vinieron'")
    op.execute(
        "UPDATE confirmaciones_evacuado SET respuesta = 'problema' "
        "WHERE respuesta IN ('otro_problema', 'parcial', 'no_encontraron')"
    )
    op.alter_column(
        'confirmaciones_evacuado', 'respuesta',
        existing_type=sa.String(length=20), type_=sa.String(length=10), existing_nullable=True,
    )
