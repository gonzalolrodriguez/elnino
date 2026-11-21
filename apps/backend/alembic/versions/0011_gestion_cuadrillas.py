"""gestion completa de cuadrillas: tipo operativo, equipamiento, base, profesion, avisos y adjuntos

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-20 23:00:00.000000
"""
from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0011'
down_revision: str | None = '0010'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ---- cuadrillas ------------------------------------------------------------------------
    op.add_column('cuadrillas', sa.Column('tipo_operativo', sa.String(length=30), nullable=False, server_default='personas'))
    op.add_column('cuadrillas', sa.Column('cantidad_integrantes', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('cuadrillas', sa.Column('equipamiento', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")))
    op.add_column('cuadrillas', sa.Column('base', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326, dimension=2, from_text='ST_GeomFromEWKT', name='geometry', spatial_index=False), nullable=True))
    op.add_column('cuadrillas', sa.Column('notas', sa.Text(), nullable=True))

    # ---- integrantes -----------------------------------------------------------------------
    op.add_column('integrantes_cuadrilla', sa.Column('profesion', sa.String(length=30), nullable=False, server_default='otra'))
    op.add_column('integrantes_cuadrilla', sa.Column('es_encargado', sa.Boolean(), nullable=False, server_default=sa.text('false')))

    # ---- partes: evidencia multimedia ------------------------------------------------------
    op.add_column('partes_tarea', sa.Column('adjuntos', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")))

    # ---- avisos del operativo a la cuadrilla -----------------------------------------------
    op.create_table(
        'avisos_cuadrilla',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('cuadrilla_id', sa.Integer(), sa.ForeignKey('cuadrillas.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tarea_id', sa.Integer(), sa.ForeignKey('tareas.id', ondelete='SET NULL'), nullable=True),
        sa.Column('tipo', sa.String(length=14), nullable=False),
        sa.Column('texto', sa.Text(), nullable=False),
        sa.Column('items', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column('geometria', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('creado_por', sa.Integer(), sa.ForeignKey('usuarios.id'), nullable=True),
        sa.Column('creado_por_rol', sa.String(length=60), nullable=True),
        sa.Column('creado_en', sa.DateTime(timezone=True), nullable=False),
        sa.Column('leido_en', sa.DateTime(timezone=True), nullable=True),
        sa.Column('leido_por', sa.Integer(), sa.ForeignKey('usuarios.id'), nullable=True),
        sa.Column('leido_por_rol', sa.String(length=60), nullable=True),
        sa.Column('categoria', sa.String(length=30), nullable=False, server_default='SIMULADO'),
        sa.CheckConstraint("tipo IN ('desvio','equipamiento','instruccion','seguridad')", name='ck_aviso_tipo'),
    )
    op.create_index('ix_avisos_cuadrilla_cuadrilla_id', 'avisos_cuadrilla', ['cuadrilla_id'])

    # ---- datos existentes ------------------------------------------------------------------
    # tipo operativo a partir del tipo de incidente (humana -> personas, ganadera -> productores_ganado)
    op.execute(
        "UPDATE cuadrillas SET tipo_operativo = CASE tipo_incidente "
        "WHEN 'ganadera' THEN 'productores_ganado' WHEN 'apicola' THEN 'apicola' ELSE 'personas' END"
    )
    # profesion a partir del rol operativo del catalogo (lo que no tiene equivalente queda en 'otra')
    op.execute(
        "UPDATE integrantes_cuadrilla SET profesion = CASE rol_operativo "
        "WHEN 'sipec' THEN 'medicina' "
        "WHEN 'trabajo_social' THEN 'trabajo_social' "
        "WHEN 'desarrollo_humano' THEN 'trabajo_social' "
        "WHEN 'policia' THEN 'policia' "
        "WHEN 'prefectura' THEN 'prefectura' "
        "WHEN 'defensa_civil' THEN 'defensa_civil' "
        "WHEN 'veterinario' THEN 'veterinaria' "
        "WHEN 'senasa' THEN 'veterinaria' "
        "WHEN 'inta' THEN 'zootecnia' "
        "WHEN 'paippa' THEN 'zootecnia' "
        "WHEN 'produccion' THEN 'zootecnia' "
        "WHEN 'transporte' THEN 'chofer' "
        "WHEN 'tecnico_energia' THEN 'tecnico_energia' "
        "WHEN 'vialidad' THEN 'logistica' "
        "WHEN 'coordinador_sector' THEN 'logistica' "
        "WHEN 'encargado_cuadrilla' THEN 'logistica' "
        "ELSE 'otra' END"
    )
    # un solo encargado por cuadrilla: el primer integrante con el rol encargado_cuadrilla
    op.execute(
        "UPDATE integrantes_cuadrilla SET es_encargado = true WHERE id IN ("
        "SELECT MIN(id) FROM integrantes_cuadrilla "
        "WHERE rol_operativo = 'encargado_cuadrilla' GROUP BY cuadrilla_id)"
    )
    # cantidad = integrantes que ya tiene cada cuadrilla
    op.execute(
        "UPDATE cuadrillas c SET cantidad_integrantes = ("
        "SELECT COUNT(*) FROM integrantes_cuadrilla i WHERE i.cuadrilla_id = c.id)"
    )


def downgrade() -> None:
    op.drop_index('ix_avisos_cuadrilla_cuadrilla_id', table_name='avisos_cuadrilla')
    op.drop_table('avisos_cuadrilla')
    op.drop_column('partes_tarea', 'adjuntos')
    op.drop_column('integrantes_cuadrilla', 'es_encargado')
    op.drop_column('integrantes_cuadrilla', 'profesion')
    op.drop_column('cuadrillas', 'notas')
    op.drop_column('cuadrillas', 'base')
    op.drop_column('cuadrillas', 'equipamiento')
    op.drop_column('cuadrillas', 'cantidad_integrantes')
    op.drop_column('cuadrillas', 'tipo_operativo')
