"""partes de las cuadrillas sobre sus tareas y marca requiere_atencion

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-20 21:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '0010'
down_revision: str | None = '0009'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'tareas',
        sa.Column('requiere_atencion', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.create_table(
        'partes_tarea',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tarea_id', sa.Integer(), sa.ForeignKey('tareas.id', ondelete='CASCADE'), nullable=False),
        sa.Column('cuadrilla_id', sa.Integer(), sa.ForeignKey('cuadrillas.id'), nullable=True),
        sa.Column('tipo', sa.String(length=12), nullable=False),
        sa.Column('resultado', sa.String(length=14), nullable=True),
        sa.Column('observacion', sa.Text(), nullable=True),
        sa.Column('autor_id', sa.Integer(), sa.ForeignKey('usuarios.id'), nullable=True),
        sa.Column('autor_rol', sa.String(length=60), nullable=True),
        sa.Column('resuelta', sa.Boolean(), nullable=True),
        sa.Column('idempotency_key', sa.String(length=36), nullable=True),
        sa.Column('categoria', sa.String(length=30), nullable=False, server_default='SIMULADO'),
        sa.Column('creado_en', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("tipo IN ('avance','dificultad','resultado')", name='ck_parte_tipo'),
        sa.CheckConstraint(
            "resultado IS NULL OR resultado IN ('completa','parcial','no_realizada','reprogramada')",
            name='ck_parte_resultado',
        ),
    )
    op.create_index('ix_partes_tarea_tarea_id', 'partes_tarea', ['tarea_id'])
    op.create_index('ix_partes_tarea_cuadrilla_id', 'partes_tarea', ['cuadrilla_id'])
    op.create_index('ix_partes_tarea_creado_en', 'partes_tarea', ['creado_en'])
    op.create_index(
        'uq_parte_idempotencia', 'partes_tarea', ['autor_id', 'idempotency_key'],
        unique=True, postgresql_where=sa.text('idempotency_key IS NOT NULL'),
    )


def downgrade() -> None:
    op.drop_index('uq_parte_idempotencia', table_name='partes_tarea')
    op.drop_index('ix_partes_tarea_creado_en', table_name='partes_tarea')
    op.drop_index('ix_partes_tarea_cuadrilla_id', table_name='partes_tarea')
    op.drop_index('ix_partes_tarea_tarea_id', table_name='partes_tarea')
    op.drop_table('partes_tarea')
    op.drop_column('tareas', 'requiere_atencion')
