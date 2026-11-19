"""constancias de cierre de tareas, confirmaciones del evacuado y datos en notificaciones

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-19 23:30:00.000000
"""
from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0006'
down_revision: str | None = '0005'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('notificaciones', sa.Column('tipo', sa.String(length=30), nullable=False, server_default='orden'))
    op.add_column('notificaciones', sa.Column('datos', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.create_table(
        'constancias_tarea',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tarea_id', sa.Integer(), sa.ForeignKey('tareas.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('cerrada_por', sa.Integer(), sa.ForeignKey('usuarios.id'), nullable=False),
        sa.Column('rol_operativo', sa.String(length=60), nullable=True),
        sa.Column('geom_destino', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326, dimension=2, from_text='ST_GeomFromEWKT', name='geometry'), nullable=True),
        sa.Column('centro_id', sa.Integer(), sa.ForeignKey('centros_recepcion.id'), nullable=True),
        sa.Column('distancia_a_centro_m', sa.Float(), nullable=True),
        sa.Column('personas_trasladadas', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('animales_trasladados', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('nota', sa.Text(), nullable=True),
        sa.Column('adjuntos', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('idempotency_key', sa.String(length=36), nullable=True),
        sa.Column('categoria', sa.String(length=30), nullable=False, server_default='SIMULADO'),
        sa.Column('creada_en', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        'uq_constancia_idempotencia', 'constancias_tarea', ['cerrada_por', 'idempotency_key'],
        unique=True, postgresql_where=sa.text('idempotency_key IS NOT NULL'),
    )
    op.create_table(
        'confirmaciones_evacuado',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tarea_id', sa.Integer(), sa.ForeignKey('tareas.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('solicitud_id', sa.Integer(), sa.ForeignKey('solicitudes_asistencia.id'), nullable=True),
        sa.Column('usuario_id', sa.Integer(), sa.ForeignKey('usuarios.id'), nullable=True),
        sa.Column('canal', sa.String(length=20), nullable=True),
        sa.Column('respuesta', sa.String(length=10), nullable=True),
        sa.Column('comentario', sa.Text(), nullable=True),
        sa.Column('codigo', sa.String(length=8), nullable=False, unique=True),
        sa.Column('creada_en', sa.DateTime(timezone=True), nullable=False),
        sa.Column('respondida_en', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_confirmaciones_evacuado_solicitud_id', 'confirmaciones_evacuado', ['solicitud_id'])


def downgrade() -> None:
    op.drop_index('ix_confirmaciones_evacuado_solicitud_id', table_name='confirmaciones_evacuado')
    op.drop_table('confirmaciones_evacuado')
    op.drop_index('uq_constancia_idempotencia', table_name='constancias_tarea')
    op.drop_table('constancias_tarea')
    op.drop_column('notificaciones', 'datos')
    op.drop_column('notificaciones', 'tipo')
