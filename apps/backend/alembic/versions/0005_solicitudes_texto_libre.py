"""solicitudes por texto libre: ubicacion aproximada y verificacion del operador

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-19 23:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '0005'
down_revision: str | None = '0004'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('solicitudes_asistencia', sa.Column('ubicacion_aproximada', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('solicitudes_asistencia', sa.Column('referencia_ubicacion', sa.Text(), nullable=True))
    op.add_column('solicitudes_asistencia', sa.Column('requiere_verificacion', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column('solicitudes_asistencia', 'requiere_verificacion')
    op.drop_column('solicitudes_asistencia', 'referencia_ubicacion')
    op.drop_column('solicitudes_asistencia', 'ubicacion_aproximada')
