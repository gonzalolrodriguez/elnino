"""Modelos ORM (PostgreSQL + PostGIS, EPSG:4326). Ver CLAUDE.md §7.

Convención: las tablas con cifras llevan ``categoria`` (DATO OBSERVADO, DOCUMENTO DE REFERENCIA o
SIMULADO), ``fuente`` y ``fecha_dato``. Los campos sensibles de ``grupos_familiares`` se guardan
cifrados (AES-GCM, ver ``app.core.cifrado``).
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from geoalchemy2 import Geometry
from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import SRID, Base, ahora

_TZ = DateTime(timezone=True)


def _punto() -> Geometry:
    return Geometry("POINT", srid=SRID)


class RolOperativo(Base):
    """Catálogo de roles operativos (sin nombres de funcionarios)."""

    __tablename__ = "roles_operativos"

    codigo: Mapped[str] = mapped_column(String(60), primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120))
    descripcion: Mapped[str | None] = mapped_column(Text)
    categoria: Mapped[str] = mapped_column(String(30), default="SIMULADO")
    fuente: Mapped[str] = mapped_column(String(200), default="SUPUESTO")


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    hash_password: Mapped[str] = mapped_column(String(255))
    nombre_visible: Mapped[str] = mapped_column(String(120))
    rol: Mapped[str] = mapped_column(
        String(20)
    )  # ciudadano|productor|cuadrilla|operador|decisor|admin
    rol_operativo: Mapped[str | None] = mapped_column(ForeignKey("roles_operativos.codigo"))
    estado: Mapped[str] = mapped_column(String(20), default="activo")  # activo|inactivo
    es_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    consentimiento_en: Mapped[datetime | None] = mapped_column(_TZ)
    intentos_fallidos: Mapped[int] = mapped_column(Integer, default=0)
    bloqueado_hasta: Mapped[datetime | None] = mapped_column(_TZ)
    creado_en: Mapped[datetime] = mapped_column(_TZ, default=ahora)
    ultimo_login: Mapped[datetime | None] = mapped_column(_TZ)


class IntentoLogin(Base):
    """Intentos fallidos de login por par (cuenta, IP): un atacante no bloquea a la víctima."""

    __tablename__ = "intentos_login"
    __table_args__ = (UniqueConstraint("usuario_id", "ip", name="uq_intentos_usuario_ip"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), index=True
    )
    ip: Mapped[str] = mapped_column(String(64))
    intentos: Mapped[int] = mapped_column(Integer, default=0)
    bloqueado_hasta: Mapped[datetime | None] = mapped_column(_TZ)
    actualizado_en: Mapped[datetime] = mapped_column(_TZ, default=ahora)


class SesionRefresh(Base):
    """Refresh tokens rotativos; solo se guarda el hash SHA-256."""

    __tablename__ = "sesiones_refresh"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), index=True
    )
    familia: Mapped[str] = mapped_column(String(36), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    cliente: Mapped[str] = mapped_column(String(20), default="web")  # web|movil
    creado_en: Mapped[datetime] = mapped_column(_TZ, default=ahora)
    expira_en: Mapped[datetime] = mapped_column(_TZ)
    revocado_en: Mapped[datetime | None] = mapped_column(_TZ)
    reemplazado_por: Mapped[int | None] = mapped_column(Integer)
    # Contexto de la rotación y uso único de la gracia (ver ``sesiones.en_gracia``).
    rotada_ip: Mapped[str | None] = mapped_column(String(64))
    rotada_cliente: Mapped[str | None] = mapped_column(String(20))
    gracia_usada_en: Mapped[datetime | None] = mapped_column(_TZ)


class Sector(Base):
    """Sectores K10 tal como los armó la mesa (SIMULADO)."""

    __tablename__ = "sectores"

    id: Mapped[str] = mapped_column(String(10), primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120))
    geom = mapped_column(Geometry("POLYGON", srid=SRID))
    altura_compromiso_m: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    poblacion_simulada: Mapped[int] = mapped_column(Integer)
    acceso_simulado: Mapped[str] = mapped_column(Text)
    estacion_referencia: Mapped[str] = mapped_column(String(120))
    estado_calculado: Mapped[str | None] = mapped_column(String(20))
    categoria: Mapped[str] = mapped_column(String(30), default="SIMULADO")
    fuente: Mapped[str] = mapped_column(String(200))
    version: Mapped[str | None] = mapped_column(String(20))
    fecha_dato: Mapped[date | None] = mapped_column(Date)


class Estacion(Base):
    __tablename__ = "estaciones"

    codigo: Mapped[int] = mapped_column(Integer, primary_key=True)  # siteCode INA
    clave: Mapped[str] = mapped_column(String(30), unique=True)
    nombre: Mapped[str] = mapped_column(String(120))
    abreviatura: Mapped[str | None] = mapped_column(String(10))
    rio: Mapped[str] = mapped_column(String(60))
    geom = mapped_column(_punto())
    aguas_bajas_m: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    alerta_m: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    evacuacion_m: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    categoria: Mapped[str] = mapped_column(String(30))
    fuente: Mapped[str] = mapped_column(Text)
    fecha_dato: Mapped[date] = mapped_column(Date)


class LecturaHidrometrica(Base):
    """K1 limpio. Las horas se guardan sin zona horaria, tal como vienen del kit."""

    __tablename__ = "lecturas_hidrometricas"
    __table_args__ = (Index("ix_lecturas_hidro_estacion_tiempo", "estacion_codigo", "timestart"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    obs_id: Mapped[int] = mapped_column(BigInteger, unique=True)
    estacion_codigo: Mapped[int] = mapped_column(ForeignKey("estaciones.codigo"))
    timestart: Mapped[datetime] = mapped_column(DateTime)
    timeend: Mapped[datetime] = mapped_column(DateTime)
    valor_m: Mapped[Decimal] = mapped_column(Numeric(7, 3))
    valor_original: Mapped[str | None] = mapped_column(String(20))
    unidad_original: Mapped[str | None] = mapped_column(String(5))
    calidad: Mapped[str] = mapped_column(String(20))  # valido|cuarentena
    transformacion: Mapped[str | None] = mapped_column(String(120))
    categoria: Mapped[str] = mapped_column(String(30))
    fuente: Mapped[str] = mapped_column(String(200))
    fecha_dato: Mapped[date] = mapped_column(Date)


class PuestoPluviometrico(Base):
    __tablename__ = "puestos_pluviometricos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    codigo: Mapped[str] = mapped_column(String(40), unique=True)
    nombre: Mapped[str] = mapped_column(String(120))
    zona: Mapped[str | None] = mapped_column(String(120))
    geom = mapped_column(_punto())
    categoria: Mapped[str] = mapped_column(String(30))
    fuente: Mapped[str] = mapped_column(String(200))
    fecha_dato: Mapped[date | None] = mapped_column(Date)


class LecturaLluvia(Base):
    __tablename__ = "lecturas_lluvia"
    __table_args__ = (
        UniqueConstraint("puesto_id", "fecha", "turno", name="uq_lluvia_puesto_turno"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    puesto_id: Mapped[int] = mapped_column(ForeignKey("puestos_pluviometricos.id"))
    fecha: Mapped[date] = mapped_column(Date)
    turno: Mapped[str] = mapped_column(String(2))  # 07|17
    mm: Mapped[Decimal | None] = mapped_column(Numeric(6, 1))  # NULL = sin medición (no es 0)
    origen: Mapped[str] = mapped_column(
        String(20)
    )  # parte_policial|carga_manual|planilla_upca|simulado
    categoria: Mapped[str] = mapped_column(String(30))
    fuente: Mapped[str | None] = mapped_column(String(200))
    creado_en: Mapped[datetime] = mapped_column(_TZ, default=ahora)


class Acceso(Base):
    __tablename__ = "accesos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sector_id: Mapped[str] = mapped_column(ForeignKey("sectores.id"))
    nombre: Mapped[str] = mapped_column(String(120))
    geom = mapped_column(Geometry("LINESTRING", srid=SRID))
    superficie: Mapped[str] = mapped_column(String(20))  # pavimento|ripio|tierra
    transitable: Mapped[bool] = mapped_column(Boolean, default=True)
    motivo: Mapped[str | None] = mapped_column(Text)
    actualizado_en: Mapped[datetime] = mapped_column(_TZ, default=ahora)
    actualizado_por_rol: Mapped[str | None] = mapped_column(String(60))
    categoria: Mapped[str] = mapped_column(String(30))
    fuente: Mapped[str] = mapped_column(String(200))
    fecha_dato: Mapped[date | None] = mapped_column(Date)


class RedVial(Base):
    """Aristas para pgRouting (se carga con la red real en una fase posterior)."""

    __tablename__ = "red_vial"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    geom = mapped_column(Geometry("LINESTRING", srid=SRID))
    nombre: Mapped[str | None] = mapped_column(String(120))
    superficie: Mapped[str | None] = mapped_column(String(20))
    source: Mapped[int | None] = mapped_column(Integer)
    target: Mapped[int | None] = mapped_column(Integer)
    longitud_m: Mapped[float | None] = mapped_column(Float)
    costo: Mapped[float | None] = mapped_column(Float)
    costo_inverso: Mapped[float | None] = mapped_column(Float)
    bloqueada: Mapped[bool] = mapped_column(Boolean, default=False)
    categoria: Mapped[str] = mapped_column(String(30), default="DOCUMENTO DE REFERENCIA")
    fuente: Mapped[str | None] = mapped_column(String(200))
    fecha_dato: Mapped[date | None] = mapped_column(Date)


class RedVialNodo(Base):
    """Vértices de la red vial (los asigna ``app.ingest.red_vial`` al cargar las aristas)."""

    __tablename__ = "red_vial_nodos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    geom = mapped_column(_punto())


class CentroRecepcion(Base):
    __tablename__ = "centros_recepcion"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(160))
    tipo: Mapped[str] = mapped_column(String(40))  # escuela|predio_alto|banquina|otro
    geom = mapped_column(_punto())
    sector_id: Mapped[str | None] = mapped_column(ForeignKey("sectores.id"))
    capacidad_personas: Mapped[int] = mapped_column(Integer, default=0)
    capacidad_animales: Mapped[int] = mapped_column(Integer, default=0)
    servicios: Mapped[dict | None] = mapped_column(JSONB)
    ocupacion: Mapped[int] = mapped_column(Integer, default=0)
    nota: Mapped[str | None] = mapped_column(Text)
    categoria: Mapped[str] = mapped_column(String(30), default="SIMULADO")
    fuente: Mapped[str] = mapped_column(String(200))
    fecha_dato: Mapped[date | None] = mapped_column(Date)


class RecursoSimulado(Base):
    __tablename__ = "recursos_simulados"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tipo: Mapped[str] = mapped_column(String(40), unique=True)
    descripcion: Mapped[str] = mapped_column(String(160))
    cantidad: Mapped[int] = mapped_column(Integer)
    capacidad_unitaria: Mapped[int | None] = mapped_column(Integer)
    unidad_capacidad: Mapped[str | None] = mapped_column(String(80))
    categoria: Mapped[str] = mapped_column(String(30), default="SIMULADO")
    fuente: Mapped[str] = mapped_column(String(200))


class GrupoFamiliar(Base):
    __tablename__ = "grupos_familiares"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), unique=True
    )
    integrantes: Mapped[int] = mapped_column(Integer, default=1)
    menores: Mapped[int] = mapped_column(Integer, default=0)
    mayores: Mapped[int] = mapped_column(Integer, default=0)
    mascotas: Mapped[int] = mapped_column(Integer, default=0)
    # Cifrados con AES-GCM (base64 de nonce + texto cifrado).
    salud_cifrado: Mapped[str | None] = mapped_column(Text)
    vulnerabilidad_cifrado: Mapped[str | None] = mapped_column(Text)
    telefono_cifrado: Mapped[str | None] = mapped_column(Text)
    domicilio = mapped_column(_punto())
    sector_id: Mapped[str | None] = mapped_column(ForeignKey("sectores.id"))
    actualizado_en: Mapped[datetime] = mapped_column(_TZ, default=ahora)


class Establecimiento(Base):
    __tablename__ = "establecimientos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    productor_id: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), index=True
    )
    nombre: Mapped[str] = mapped_column(String(160))
    renspa: Mapped[str | None] = mapped_column(String(30))
    renapa: Mapped[str | None] = mapped_column(String(30))
    paippa: Mapped[str | None] = mapped_column(String(30))
    geom_tranquera = mapped_column(_punto())
    geom_loma_alta = mapped_column(Geometry("POLYGON", srid=SRID))
    superficie_albardon_m2: Mapped[float | None] = mapped_column(Float)
    acceso_habitual: Mapped[str | None] = mapped_column(String(120))
    sector_id: Mapped[str | None] = mapped_column(ForeignKey("sectores.id"))
    creado_en: Mapped[datetime] = mapped_column(_TZ, default=ahora)


class StockProductivo(Base):
    __tablename__ = "stock_productivo"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    establecimiento_id: Mapped[int] = mapped_column(
        ForeignKey("establecimientos.id", ondelete="CASCADE"), index=True
    )
    especie: Mapped[str] = mapped_column(String(40))
    categoria_animal: Mapped[str] = mapped_column(String(60))
    cantidad: Mapped[int] = mapped_column(Integer)
    actualizado_en: Mapped[datetime] = mapped_column(_TZ, default=ahora)


class SolicitudAsistencia(Base):
    __tablename__ = "solicitudes_asistencia"
    __table_args__ = (
        # Idempotencia de POST /solicitudes (Idempotency-Key) sin ventana de tiempo.
        Index(
            "uq_solicitud_idempotencia",
            "solicitante_id",
            "idempotency_key",
            unique=True,
            postgresql_where=text("idempotency_key IS NOT NULL"),
        ),
        # Duplicados de un mismo mensaje de canal (reintentos del proveedor).
        Index(
            "uq_solicitud_mensaje_externo",
            "origen",
            "mensaje_externo_id",
            unique=True,
            postgresql_where=text("mensaje_externo_id IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    solicitante_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"))
    origen: Mapped[str] = mapped_column(String(20))  # app|web|whatsapp_sim|sms_sim|ivr_sim
    tipo: Mapped[str] = mapped_column(String(40))
    personas: Mapped[int] = mapped_column(Integer, default=0)
    animales: Mapped[int] = mapped_column(Integer, default=0)
    texto: Mapped[str | None] = mapped_column(Text)
    geom = mapped_column(_punto())
    estado: Mapped[str] = mapped_column(String(20), default="recibida")
    sector_id: Mapped[str | None] = mapped_column(ForeignKey("sectores.id"))
    detalle: Mapped[dict | None] = mapped_column(JSONB)
    adjuntos: Mapped[list | None] = mapped_column(JSONB)
    idempotency_key: Mapped[str | None] = mapped_column(String(36))
    mensaje_externo_id: Mapped[str | None] = mapped_column(String(120))
    creado_en: Mapped[datetime] = mapped_column(_TZ, default=ahora)
    actualizado_en: Mapped[datetime] = mapped_column(_TZ, default=ahora)


class Cuadrilla(Base):
    __tablename__ = "cuadrillas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120))
    tipo_incidente: Mapped[str] = mapped_column(String(40))  # humana|ganadera|apicola
    estado: Mapped[str] = mapped_column(String(20), default="disponible")
    creado_en: Mapped[datetime] = mapped_column(_TZ, default=ahora)


class IntegranteCuadrilla(Base):
    __tablename__ = "integrantes_cuadrilla"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cuadrilla_id: Mapped[int] = mapped_column(
        ForeignKey("cuadrillas.id", ondelete="CASCADE"), index=True
    )
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"))
    rol_operativo: Mapped[str] = mapped_column(ForeignKey("roles_operativos.codigo"))


class Tarea(Base):
    __tablename__ = "tareas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cuadrilla_id: Mapped[int | None] = mapped_column(ForeignKey("cuadrillas.id"))
    solicitud_id: Mapped[int | None] = mapped_column(ForeignKey("solicitudes_asistencia.id"))
    orden_id: Mapped[int | None] = mapped_column(ForeignKey("ordenes.id"))
    sector_id: Mapped[str | None] = mapped_column(ForeignKey("sectores.id"))
    titulo: Mapped[str] = mapped_column(String(200))
    descripcion: Mapped[str | None] = mapped_column(Text)
    estado: Mapped[str] = mapped_column(String(20), default="pendiente")
    checklist: Mapped[list | None] = mapped_column(JSONB)
    creado_en: Mapped[datetime] = mapped_column(_TZ, default=ahora)
    actualizado_en: Mapped[datetime] = mapped_column(_TZ, default=ahora)


class Orden(Base):
    __tablename__ = "ordenes"
    __table_args__ = (
        Index(
            "uq_orden_idempotencia",
            "emitida_por",
            "idempotency_key",
            unique=True,
            postgresql_where=text("idempotency_key IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tipo: Mapped[str] = mapped_column(String(30))  # alerta|evacuacion_preventiva|evacuacion
    sectores: Mapped[list] = mapped_column(JSONB)
    emitida_por: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    rol_operativo: Mapped[str | None] = mapped_column(String(60))
    fundamento: Mapped[str] = mapped_column(Text)
    idempotency_key: Mapped[str | None] = mapped_column(String(36))
    creada_en: Mapped[datetime] = mapped_column(_TZ, default=ahora)


class Notificacion(Base):
    __tablename__ = "notificaciones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), index=True
    )
    orden_id: Mapped[int | None] = mapped_column(ForeignKey("ordenes.id"))
    mensaje: Mapped[str] = mapped_column(Text)
    leida: Mapped[bool] = mapped_column(Boolean, default=False)
    creada_en: Mapped[datetime] = mapped_column(_TZ, default=ahora)


class Alternativa(Base):
    __tablename__ = "alternativas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120))
    escenario_snapshot: Mapped[dict] = mapped_column(JSONB)
    parametros: Mapped[dict] = mapped_column(JSONB)
    metricas: Mapped[dict] = mapped_column(JSONB)
    creada_por: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"))
    creada_en: Mapped[datetime] = mapped_column(_TZ, default=ahora)


class BitacoraDecision(Base):
    """Bitácora K8: los seis campos obligatorios más el snapshot del escenario."""

    __tablename__ = "bitacora_decisiones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    decision: Mapped[str] = mapped_column(Text)
    evidencia: Mapped[str] = mapped_column(Text)
    limites: Mapped[str] = mapped_column(Text)
    riesgos: Mapped[str] = mapped_column(Text)
    gatillos: Mapped[str] = mapped_column(Text)
    responsable_rol: Mapped[str] = mapped_column(String(60))
    fecha_simulada: Mapped[date] = mapped_column(Date)
    estado: Mapped[str] = mapped_column(String(20), default="completa")  # borrador|completa
    snapshot: Mapped[dict | None] = mapped_column(JSONB)
    orden_id: Mapped[int | None] = mapped_column(ForeignKey("ordenes.id"))
    creada_por: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"))
    creada_en: Mapped[datetime] = mapped_column(_TZ, default=ahora)
    categoria: Mapped[str] = mapped_column(String(30), default="SIMULADO")


class AuditoriaAcceso(Base):
    """Bitácora de accesos con hash encadenado (SHA-256)."""

    __tablename__ = "auditoria_accesos"
    __table_args__ = (
        # Consultas del límite de login por cuenta (fallos en ventana, redes conocidas).
        Index("ix_auditoria_usuario_accion_fecha", "usuario_id", "accion", "fecha"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    usuario_id: Mapped[int | None] = mapped_column(Integer)  # sin FK: la traza sobrevive al usuario
    accion: Mapped[str] = mapped_column(String(60))
    recurso: Mapped[str] = mapped_column(String(200))
    ip: Mapped[str | None] = mapped_column(String(64))
    detalle: Mapped[str | None] = mapped_column(Text)
    fecha: Mapped[datetime] = mapped_column(_TZ)
    hash_anterior: Mapped[str] = mapped_column(String(64))
    hash: Mapped[str] = mapped_column(String(64), unique=True)
