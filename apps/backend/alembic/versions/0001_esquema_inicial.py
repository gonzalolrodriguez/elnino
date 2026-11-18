"""esquema inicial

Revision ID: 0001
Revises: 
Create Date: 2026-11-17 22:33:55.454915
"""
from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = '0001'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Defensivo: normalmente ya las crea db/init/01-extensiones.sql.
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgrouting")
    op.create_table('auditoria_accesos',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('usuario_id', sa.Integer(), nullable=True),
    sa.Column('accion', sa.String(length=60), nullable=False),
    sa.Column('recurso', sa.String(length=200), nullable=False),
    sa.Column('ip', sa.String(length=64), nullable=True),
    sa.Column('detalle', sa.Text(), nullable=True),
    sa.Column('fecha', sa.DateTime(timezone=True), nullable=False),
    sa.Column('hash_anterior', sa.String(length=64), nullable=False),
    sa.Column('hash', sa.String(length=64), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('hash')
    )
    op.create_table('cuadrillas',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('nombre', sa.String(length=120), nullable=False),
    sa.Column('tipo_incidente', sa.String(length=40), nullable=False),
    sa.Column('estado', sa.String(length=20), nullable=False),
    sa.Column('creado_en', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('estaciones',
    sa.Column('codigo', sa.Integer(), nullable=False),
    sa.Column('clave', sa.String(length=30), nullable=False),
    sa.Column('nombre', sa.String(length=120), nullable=False),
    sa.Column('abreviatura', sa.String(length=10), nullable=True),
    sa.Column('rio', sa.String(length=60), nullable=False),
    sa.Column('geom', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326, dimension=2, from_text='ST_GeomFromEWKT', name='geometry'), nullable=True),
    sa.Column('aguas_bajas_m', sa.Numeric(precision=5, scale=2), nullable=False),
    sa.Column('alerta_m', sa.Numeric(precision=5, scale=2), nullable=False),
    sa.Column('evacuacion_m', sa.Numeric(precision=5, scale=2), nullable=False),
    sa.Column('categoria', sa.String(length=30), nullable=False),
    sa.Column('fuente', sa.Text(), nullable=False),
    sa.Column('fecha_dato', sa.Date(), nullable=False),
    sa.PrimaryKeyConstraint('codigo'),
    sa.UniqueConstraint('clave')
    )
    op.create_table('puestos_pluviometricos',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('codigo', sa.String(length=40), nullable=False),
    sa.Column('nombre', sa.String(length=120), nullable=False),
    sa.Column('zona', sa.String(length=120), nullable=True),
    sa.Column('geom', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326, dimension=2, from_text='ST_GeomFromEWKT', name='geometry'), nullable=True),
    sa.Column('categoria', sa.String(length=30), nullable=False),
    sa.Column('fuente', sa.String(length=200), nullable=False),
    sa.Column('fecha_dato', sa.Date(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('codigo')
    )
    op.create_table('recursos_simulados',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('tipo', sa.String(length=40), nullable=False),
    sa.Column('descripcion', sa.String(length=160), nullable=False),
    sa.Column('cantidad', sa.Integer(), nullable=False),
    sa.Column('capacidad_unitaria', sa.Integer(), nullable=True),
    sa.Column('unidad_capacidad', sa.String(length=80), nullable=True),
    sa.Column('categoria', sa.String(length=30), nullable=False),
    sa.Column('fuente', sa.String(length=200), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('tipo')
    )
    op.create_table('red_vial',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('geom', geoalchemy2.types.Geometry(geometry_type='LINESTRING', srid=4326, dimension=2, from_text='ST_GeomFromEWKT', name='geometry'), nullable=True),
    sa.Column('nombre', sa.String(length=120), nullable=True),
    sa.Column('superficie', sa.String(length=20), nullable=True),
    sa.Column('source', sa.Integer(), nullable=True),
    sa.Column('target', sa.Integer(), nullable=True),
    sa.Column('costo', sa.Float(), nullable=True),
    sa.Column('costo_inverso', sa.Float(), nullable=True),
    sa.Column('bloqueada', sa.Boolean(), nullable=False),
    sa.Column('categoria', sa.String(length=30), nullable=False),
    sa.Column('fuente', sa.String(length=200), nullable=True),
    sa.Column('fecha_dato', sa.Date(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('roles_operativos',
    sa.Column('codigo', sa.String(length=60), nullable=False),
    sa.Column('nombre', sa.String(length=120), nullable=False),
    sa.Column('descripcion', sa.Text(), nullable=True),
    sa.Column('categoria', sa.String(length=30), nullable=False),
    sa.Column('fuente', sa.String(length=200), nullable=False),
    sa.PrimaryKeyConstraint('codigo')
    )
    op.create_table('sectores',
    sa.Column('id', sa.String(length=10), nullable=False),
    sa.Column('nombre', sa.String(length=120), nullable=False),
    sa.Column('geom', geoalchemy2.types.Geometry(geometry_type='POLYGON', srid=4326, dimension=2, from_text='ST_GeomFromEWKT', name='geometry'), nullable=True),
    sa.Column('altura_compromiso_m', sa.Numeric(precision=5, scale=2), nullable=False),
    sa.Column('poblacion_simulada', sa.Integer(), nullable=False),
    sa.Column('acceso_simulado', sa.Text(), nullable=False),
    sa.Column('estacion_referencia', sa.String(length=120), nullable=False),
    sa.Column('estado_calculado', sa.String(length=20), nullable=True),
    sa.Column('categoria', sa.String(length=30), nullable=False),
    sa.Column('fuente', sa.String(length=200), nullable=False),
    sa.Column('version', sa.String(length=20), nullable=True),
    sa.Column('fecha_dato', sa.Date(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('accesos',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('sector_id', sa.String(length=10), nullable=False),
    sa.Column('nombre', sa.String(length=120), nullable=False),
    sa.Column('geom', geoalchemy2.types.Geometry(geometry_type='LINESTRING', srid=4326, dimension=2, from_text='ST_GeomFromEWKT', name='geometry'), nullable=True),
    sa.Column('superficie', sa.String(length=20), nullable=False),
    sa.Column('transitable', sa.Boolean(), nullable=False),
    sa.Column('motivo', sa.Text(), nullable=True),
    sa.Column('actualizado_en', sa.DateTime(timezone=True), nullable=False),
    sa.Column('actualizado_por_rol', sa.String(length=60), nullable=True),
    sa.Column('categoria', sa.String(length=30), nullable=False),
    sa.Column('fuente', sa.String(length=200), nullable=False),
    sa.Column('fecha_dato', sa.Date(), nullable=True),
    sa.ForeignKeyConstraint(['sector_id'], ['sectores.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('centros_recepcion',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('nombre', sa.String(length=160), nullable=False),
    sa.Column('tipo', sa.String(length=40), nullable=False),
    sa.Column('geom', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326, dimension=2, from_text='ST_GeomFromEWKT', name='geometry'), nullable=True),
    sa.Column('sector_id', sa.String(length=10), nullable=True),
    sa.Column('capacidad_personas', sa.Integer(), nullable=False),
    sa.Column('capacidad_animales', sa.Integer(), nullable=False),
    sa.Column('servicios', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('ocupacion', sa.Integer(), nullable=False),
    sa.Column('nota', sa.Text(), nullable=True),
    sa.Column('categoria', sa.String(length=30), nullable=False),
    sa.Column('fuente', sa.String(length=200), nullable=False),
    sa.Column('fecha_dato', sa.Date(), nullable=True),
    sa.ForeignKeyConstraint(['sector_id'], ['sectores.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('lecturas_hidrometricas',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('obs_id', sa.BigInteger(), nullable=False),
    sa.Column('estacion_codigo', sa.Integer(), nullable=False),
    sa.Column('timestart', sa.DateTime(), nullable=False),
    sa.Column('timeend', sa.DateTime(), nullable=False),
    sa.Column('valor_m', sa.Numeric(precision=7, scale=3), nullable=False),
    sa.Column('valor_original', sa.String(length=20), nullable=True),
    sa.Column('unidad_original', sa.String(length=5), nullable=True),
    sa.Column('calidad', sa.String(length=20), nullable=False),
    sa.Column('transformacion', sa.String(length=120), nullable=True),
    sa.Column('categoria', sa.String(length=30), nullable=False),
    sa.Column('fuente', sa.String(length=200), nullable=False),
    sa.Column('fecha_dato', sa.Date(), nullable=False),
    sa.ForeignKeyConstraint(['estacion_codigo'], ['estaciones.codigo'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('obs_id')
    )
    op.create_index('ix_lecturas_hidro_estacion_tiempo', 'lecturas_hidrometricas', ['estacion_codigo', 'timestart'], unique=False)
    op.create_table('lecturas_lluvia',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('puesto_id', sa.Integer(), nullable=False),
    sa.Column('fecha', sa.Date(), nullable=False),
    sa.Column('turno', sa.String(length=2), nullable=False),
    sa.Column('mm', sa.Numeric(precision=6, scale=1), nullable=True),
    sa.Column('origen', sa.String(length=20), nullable=False),
    sa.Column('categoria', sa.String(length=30), nullable=False),
    sa.Column('fuente', sa.String(length=200), nullable=True),
    sa.Column('creado_en', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['puesto_id'], ['puestos_pluviometricos.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('puesto_id', 'fecha', 'turno', name='uq_lluvia_puesto_turno')
    )
    op.create_table('usuarios',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('email', sa.String(length=254), nullable=False),
    sa.Column('hash_password', sa.String(length=255), nullable=False),
    sa.Column('nombre_visible', sa.String(length=120), nullable=False),
    sa.Column('rol', sa.String(length=20), nullable=False),
    sa.Column('rol_operativo', sa.String(length=60), nullable=True),
    sa.Column('estado', sa.String(length=20), nullable=False),
    sa.Column('es_demo', sa.Boolean(), nullable=False),
    sa.Column('consentimiento_en', sa.DateTime(timezone=True), nullable=True),
    sa.Column('intentos_fallidos', sa.Integer(), nullable=False),
    sa.Column('bloqueado_hasta', sa.DateTime(timezone=True), nullable=True),
    sa.Column('creado_en', sa.DateTime(timezone=True), nullable=False),
    sa.Column('ultimo_login', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['rol_operativo'], ['roles_operativos.codigo'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_usuarios_email'), 'usuarios', ['email'], unique=True)
    op.create_table('alternativas',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('nombre', sa.String(length=120), nullable=False),
    sa.Column('escenario_snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('parametros', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('metricas', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('creada_por', sa.Integer(), nullable=True),
    sa.Column('creada_en', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['creada_por'], ['usuarios.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('establecimientos',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('productor_id', sa.Integer(), nullable=False),
    sa.Column('nombre', sa.String(length=160), nullable=False),
    sa.Column('renspa', sa.String(length=30), nullable=True),
    sa.Column('renapa', sa.String(length=30), nullable=True),
    sa.Column('paippa', sa.String(length=30), nullable=True),
    sa.Column('geom_tranquera', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326, dimension=2, from_text='ST_GeomFromEWKT', name='geometry'), nullable=True),
    sa.Column('geom_loma_alta', geoalchemy2.types.Geometry(geometry_type='POLYGON', srid=4326, dimension=2, from_text='ST_GeomFromEWKT', name='geometry'), nullable=True),
    sa.Column('superficie_albardon_m2', sa.Float(), nullable=True),
    sa.Column('acceso_habitual', sa.String(length=120), nullable=True),
    sa.Column('sector_id', sa.String(length=10), nullable=True),
    sa.Column('creado_en', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['productor_id'], ['usuarios.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['sector_id'], ['sectores.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_establecimientos_productor_id'), 'establecimientos', ['productor_id'], unique=False)
    op.create_table('grupos_familiares',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('usuario_id', sa.Integer(), nullable=False),
    sa.Column('integrantes', sa.Integer(), nullable=False),
    sa.Column('menores', sa.Integer(), nullable=False),
    sa.Column('mayores', sa.Integer(), nullable=False),
    sa.Column('mascotas', sa.Integer(), nullable=False),
    sa.Column('salud_cifrado', sa.Text(), nullable=True),
    sa.Column('vulnerabilidad_cifrado', sa.Text(), nullable=True),
    sa.Column('telefono_cifrado', sa.Text(), nullable=True),
    sa.Column('domicilio', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326, dimension=2, from_text='ST_GeomFromEWKT', name='geometry'), nullable=True),
    sa.Column('sector_id', sa.String(length=10), nullable=True),
    sa.Column('actualizado_en', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['sector_id'], ['sectores.id'], ),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('usuario_id')
    )
    op.create_table('integrantes_cuadrilla',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('cuadrilla_id', sa.Integer(), nullable=False),
    sa.Column('usuario_id', sa.Integer(), nullable=True),
    sa.Column('rol_operativo', sa.String(length=60), nullable=False),
    sa.ForeignKeyConstraint(['cuadrilla_id'], ['cuadrillas.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['rol_operativo'], ['roles_operativos.codigo'], ),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_integrantes_cuadrilla_cuadrilla_id'), 'integrantes_cuadrilla', ['cuadrilla_id'], unique=False)
    op.create_table('ordenes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('tipo', sa.String(length=30), nullable=False),
    sa.Column('sectores', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('emitida_por', sa.Integer(), nullable=False),
    sa.Column('rol_operativo', sa.String(length=60), nullable=True),
    sa.Column('fundamento', sa.Text(), nullable=False),
    sa.Column('creada_en', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['emitida_por'], ['usuarios.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('sesiones_refresh',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('usuario_id', sa.Integer(), nullable=False),
    sa.Column('familia', sa.String(length=36), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('cliente', sa.String(length=20), nullable=False),
    sa.Column('creado_en', sa.DateTime(timezone=True), nullable=False),
    sa.Column('expira_en', sa.DateTime(timezone=True), nullable=False),
    sa.Column('revocado_en', sa.DateTime(timezone=True), nullable=True),
    sa.Column('reemplazado_por', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token_hash')
    )
    op.create_index(op.f('ix_sesiones_refresh_familia'), 'sesiones_refresh', ['familia'], unique=False)
    op.create_index(op.f('ix_sesiones_refresh_usuario_id'), 'sesiones_refresh', ['usuario_id'], unique=False)
    op.create_table('solicitudes_asistencia',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('solicitante_id', sa.Integer(), nullable=True),
    sa.Column('origen', sa.String(length=20), nullable=False),
    sa.Column('tipo', sa.String(length=40), nullable=False),
    sa.Column('personas', sa.Integer(), nullable=False),
    sa.Column('animales', sa.Integer(), nullable=False),
    sa.Column('texto', sa.Text(), nullable=True),
    sa.Column('geom', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326, dimension=2, from_text='ST_GeomFromEWKT', name='geometry'), nullable=True),
    sa.Column('estado', sa.String(length=20), nullable=False),
    sa.Column('adjuntos', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('creado_en', sa.DateTime(timezone=True), nullable=False),
    sa.Column('actualizado_en', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['solicitante_id'], ['usuarios.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('bitacora_decisiones',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('decision', sa.Text(), nullable=False),
    sa.Column('evidencia', sa.Text(), nullable=False),
    sa.Column('limites', sa.Text(), nullable=False),
    sa.Column('riesgos', sa.Text(), nullable=False),
    sa.Column('gatillos', sa.Text(), nullable=False),
    sa.Column('responsable_rol', sa.String(length=60), nullable=False),
    sa.Column('fecha_simulada', sa.Date(), nullable=False),
    sa.Column('snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('orden_id', sa.Integer(), nullable=True),
    sa.Column('creada_por', sa.Integer(), nullable=True),
    sa.Column('creada_en', sa.DateTime(timezone=True), nullable=False),
    sa.Column('categoria', sa.String(length=30), nullable=False),
    sa.ForeignKeyConstraint(['creada_por'], ['usuarios.id'], ),
    sa.ForeignKeyConstraint(['orden_id'], ['ordenes.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('notificaciones',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('usuario_id', sa.Integer(), nullable=False),
    sa.Column('orden_id', sa.Integer(), nullable=True),
    sa.Column('mensaje', sa.Text(), nullable=False),
    sa.Column('leida', sa.Boolean(), nullable=False),
    sa.Column('creada_en', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['orden_id'], ['ordenes.id'], ),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_notificaciones_usuario_id'), 'notificaciones', ['usuario_id'], unique=False)
    op.create_table('stock_productivo',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('establecimiento_id', sa.Integer(), nullable=False),
    sa.Column('especie', sa.String(length=40), nullable=False),
    sa.Column('categoria_animal', sa.String(length=60), nullable=False),
    sa.Column('cantidad', sa.Integer(), nullable=False),
    sa.Column('actualizado_en', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['establecimiento_id'], ['establecimientos.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_stock_productivo_establecimiento_id'), 'stock_productivo', ['establecimiento_id'], unique=False)
    op.create_table('tareas',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('cuadrilla_id', sa.Integer(), nullable=True),
    sa.Column('solicitud_id', sa.Integer(), nullable=True),
    sa.Column('titulo', sa.String(length=200), nullable=False),
    sa.Column('estado', sa.String(length=20), nullable=False),
    sa.Column('checklist', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('creado_en', sa.DateTime(timezone=True), nullable=False),
    sa.Column('actualizado_en', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['cuadrilla_id'], ['cuadrillas.id'], ),
    sa.ForeignKeyConstraint(['solicitud_id'], ['solicitudes_asistencia.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('tareas')
    op.drop_index(op.f('ix_stock_productivo_establecimiento_id'), table_name='stock_productivo')
    op.drop_table('stock_productivo')
    op.drop_index(op.f('ix_notificaciones_usuario_id'), table_name='notificaciones')
    op.drop_table('notificaciones')
    op.drop_table('bitacora_decisiones')
    op.drop_table('solicitudes_asistencia')
    op.drop_index(op.f('ix_sesiones_refresh_usuario_id'), table_name='sesiones_refresh')
    op.drop_index(op.f('ix_sesiones_refresh_familia'), table_name='sesiones_refresh')
    op.drop_table('sesiones_refresh')
    op.drop_table('ordenes')
    op.drop_index(op.f('ix_integrantes_cuadrilla_cuadrilla_id'), table_name='integrantes_cuadrilla')
    op.drop_table('integrantes_cuadrilla')
    op.drop_table('grupos_familiares')
    op.drop_index(op.f('ix_establecimientos_productor_id'), table_name='establecimientos')
    op.drop_table('establecimientos')
    op.drop_table('alternativas')
    op.drop_index(op.f('ix_usuarios_email'), table_name='usuarios')
    op.drop_table('usuarios')
    op.drop_table('lecturas_lluvia')
    op.drop_index('ix_lecturas_hidro_estacion_tiempo', table_name='lecturas_hidrometricas')
    op.drop_table('lecturas_hidrometricas')
    op.drop_table('centros_recepcion')
    op.drop_table('accesos')
    op.drop_table('sectores')
    op.drop_table('roles_operativos')
    op.drop_table('red_vial')
    op.drop_table('recursos_simulados')
    op.drop_table('puestos_pluviometricos')
    op.drop_table('estaciones')
    op.drop_table('cuadrillas')
    op.drop_table('auditoria_accesos')
    # ### end Alembic commands ###
