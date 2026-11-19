"""idempotencia de solicitudes y ordenes, y deduplicacion de mensajes de canal

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-19 22:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '0004'
down_revision: str | None = '0003'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('solicitudes_asistencia', sa.Column('idempotency_key', sa.String(length=36), nullable=True))
    op.add_column('solicitudes_asistencia', sa.Column('mensaje_externo_id', sa.String(length=120), nullable=True))
    op.add_column('ordenes', sa.Column('idempotency_key', sa.String(length=36), nullable=True))
    op.add_column('sesiones_refresh', sa.Column('rotada_ip', sa.String(length=64), nullable=True))
    op.add_column('sesiones_refresh', sa.Column('rotada_cliente', sa.String(length=20), nullable=True))
    op.add_column('sesiones_refresh', sa.Column('gracia_usada_en', sa.DateTime(timezone=True), nullable=True))
    # Las claves que hasta ahora vivian en detalle->idempotency_key pasan a la columna (la primera
    # solicitud de cada par solicitante/clave; las repetidas, si las hubiera, quedan sin clave).
    op.execute(
        """
        UPDATE solicitudes_asistencia s
           SET idempotency_key = s.detalle->>'idempotency_key'
         WHERE s.detalle ? 'idempotency_key'
           AND s.id = (
                SELECT MIN(t.id) FROM solicitudes_asistencia t
                 WHERE t.solicitante_id IS NOT DISTINCT FROM s.solicitante_id
                   AND t.detalle->>'idempotency_key' = s.detalle->>'idempotency_key')
        """
    )
    op.create_index(
        'uq_solicitud_idempotencia', 'solicitudes_asistencia', ['solicitante_id', 'idempotency_key'],
        unique=True, postgresql_where=sa.text('idempotency_key IS NOT NULL'),
    )
    op.create_index(
        'uq_solicitud_mensaje_externo', 'solicitudes_asistencia', ['origen', 'mensaje_externo_id'],
        unique=True, postgresql_where=sa.text('mensaje_externo_id IS NOT NULL'),
    )
    op.create_index(
        'uq_orden_idempotencia', 'ordenes', ['emitida_por', 'idempotency_key'],
        unique=True, postgresql_where=sa.text('idempotency_key IS NOT NULL'),
    )


def downgrade() -> None:
    op.drop_index('uq_orden_idempotencia', table_name='ordenes')
    op.drop_index('uq_solicitud_mensaje_externo', table_name='solicitudes_asistencia')
    op.drop_index('uq_solicitud_idempotencia', table_name='solicitudes_asistencia')
    op.drop_column('sesiones_refresh', 'gracia_usada_en')
    op.drop_column('sesiones_refresh', 'rotada_cliente')
    op.drop_column('sesiones_refresh', 'rotada_ip')
    op.drop_column('ordenes', 'idempotency_key')
    op.drop_column('solicitudes_asistencia', 'mensaje_externo_id')
    op.drop_column('solicitudes_asistencia', 'idempotency_key')
