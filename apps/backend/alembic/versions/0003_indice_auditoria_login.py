"""indice de auditoria para el limite de login por cuenta

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-18 10:00:00.000000
"""
from collections.abc import Sequence

from alembic import op

revision: str = '0003'
down_revision: str | None = '0002'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        'ix_auditoria_usuario_accion_fecha',
        'auditoria_accesos',
        ['usuario_id', 'accion', 'fecha'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_auditoria_usuario_accion_fecha', table_name='auditoria_accesos')
