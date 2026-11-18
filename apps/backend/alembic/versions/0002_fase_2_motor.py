"""fase 2 motor

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-17 23:40:50.091347
"""
from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0002'
down_revision: str | None = '0001'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('red_vial_nodos',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('geom', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326, dimension=2, from_text='ST_GeomFromEWKT', name='geometry'), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('intentos_login',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('usuario_id', sa.Integer(), nullable=False),
    sa.Column('ip', sa.String(length=64), nullable=False),
    sa.Column('intentos', sa.Integer(), nullable=False),
    sa.Column('bloqueado_hasta', sa.DateTime(timezone=True), nullable=True),
    sa.Column('actualizado_en', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('usuario_id', 'ip', name='uq_intentos_usuario_ip')
    )
    op.create_index(op.f('ix_intentos_login_usuario_id'), 'intentos_login', ['usuario_id'], unique=False)
    op.add_column('bitacora_decisiones', sa.Column('estado', sa.String(length=20), nullable=False, server_default='completa'))
    op.add_column('red_vial', sa.Column('longitud_m', sa.Float(), nullable=True))
    op.add_column('solicitudes_asistencia', sa.Column('sector_id', sa.String(length=10), nullable=True))
    op.add_column('solicitudes_asistencia', sa.Column('detalle', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.create_foreign_key('fk_solicitudes_sector', 'solicitudes_asistencia', 'sectores', ['sector_id'], ['id'])
    op.add_column('tareas', sa.Column('orden_id', sa.Integer(), nullable=True))
    op.add_column('tareas', sa.Column('sector_id', sa.String(length=10), nullable=True))
    op.add_column('tareas', sa.Column('descripcion', sa.Text(), nullable=True))
    op.create_foreign_key('fk_tareas_sector', 'tareas', 'sectores', ['sector_id'], ['id'])
    op.create_foreign_key('fk_tareas_orden', 'tareas', 'ordenes', ['orden_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_tareas_orden', 'tareas', type_='foreignkey')
    op.drop_constraint('fk_tareas_sector', 'tareas', type_='foreignkey')
    op.drop_column('tareas', 'descripcion')
    op.drop_column('tareas', 'sector_id')
    op.drop_column('tareas', 'orden_id')
    op.drop_constraint('fk_solicitudes_sector', 'solicitudes_asistencia', type_='foreignkey')
    op.drop_column('solicitudes_asistencia', 'detalle')
    op.drop_column('solicitudes_asistencia', 'sector_id')
    op.drop_column('red_vial', 'longitud_m')
    op.drop_column('bitacora_decisiones', 'estado')
    op.drop_index(op.f('ix_intentos_login_usuario_id'), table_name='intentos_login')
    op.drop_table('intentos_login')
    op.drop_table('red_vial_nodos')
