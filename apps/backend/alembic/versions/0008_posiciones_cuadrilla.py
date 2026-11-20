"""posiciones de cuadrilla (ultima posicion compartida, sin historial)

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-20 12:00:00.000000
"""
from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa
from alembic import op

revision: str = '0008'
down_revision: str | None = '0007'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'posiciones_cuadrilla',
        sa.Column('cuadrilla_id', sa.Integer(), sa.ForeignKey('cuadrillas.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('geom', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326, dimension=2, from_text='ST_GeomFromEWKT', name='geometry'), nullable=True),
        sa.Column('precision_m', sa.Float(), nullable=True),
        sa.Column('registrada_en', sa.DateTime(timezone=True), nullable=False),
        sa.Column('categoria', sa.String(length=30), nullable=False, server_default='SIMULADO'),
    )


def downgrade() -> None:
    op.drop_table('posiciones_cuadrilla')
