# Plataforma de Gestión de Evacuaciones · Equipo 3 IPF

> PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial

Simulador de planificación de evacuaciones (Desafío 6). Estado: **Fase 1** (datos y seguridad base) sobre el esqueleto de la Fase 0: limpieza de K1, modelo de datos con migraciones, carga de K3/K10/K1 y datos simulados, y autenticación con roles, cifrado de campos sensibles y bitácora de accesos con hash encadenado.

## Requisitos y versiones

| Herramienta | Versión probada |
|---|---|
| Node.js | 24.x |
| pnpm | 10.18 |
| Python | 3.12 o superior (probado con 3.13) |
| Docker + Compose | Opcional, para PostgreSQL/PostGIS/pgRouting |
| Expo SDK | 58 |

## Instalación

```bash
cp .env.example .env            # completar JWT_SECRET y FIELD_ENCRYPTION_KEY (nunca commitear .env)
pnpm install                    # dependencias de web, app móvil y shared

cd apps/backend
python -m venv .venv
.venv/Scripts/activate          # Windows (Git Bash); en Linux/macOS: source .venv/bin/activate
pip install -r requirements-dev.txt
```

## Arranque

**Base de datos**

```bash
docker compose up -d db
```

**Migraciones, datos y limpieza (Fase 1)**, desde `apps/backend` con el entorno virtual activo y las variables de `.env` cargadas (o pasadas en la línea de comandos):

```bash
python -m app.ingest.limpieza_k1   # K1 -> data/processed/k1_limpio.csv, k1_diario.csv y docs/registro_limpieza.md
alembic upgrade head               # crea el esquema (PostGIS, tablas de CLAUDE.md §7)
python -m app.db.seed              # K3, K10 (sin cambios), K1 limpio, datos SIMULADOS y usuarios de demo; idempotente
```

El script de limpieza solo lee `data/kit/` y escribe en `data/processed/`. Las claves se generan así:

```bash
openssl rand -hex 32                                                        # JWT_SECRET
python -c "import base64,os;print(base64.b64encode(os.urandom(32)).decode())"  # FIELD_ENCRYPTION_KEY
```

**Backend** (con Docker, junto con la base): `docker compose up backend`. Local:

```bash
cd apps/backend
uvicorn app.main:app --reload --port 8000
```

Si la base no está disponible, `/api/v1/salud` responde igualmente con `"base_de_datos": "no_disponible"`.

**Web**: `pnpm dev:web` → http://localhost:5173

**App móvil**: `pnpm dev:mobile` (Expo). En un teléfono físico, `EXPO_PUBLIC_API_URL` debe apuntar a la IP de la PC en la red local (por ejemplo `http://192.168.1.50:8000`) y el backend debe aceptar ese origen en `CORS_ORIGINS`.

**APK**: `cd apps/mobile && npx eas build --profile preview --platform android` (perfil `preview`, `buildType: apk`).

## Puertos

Si el puerto 5432 ya está ocupado por un PostgreSQL local (caso frecuente en Windows), definir `POSTGRES_PORT=5433` en `.env` y ajustar `DATABASE_URL` al mismo puerto (`...@localhost:5433/evacuaciones`). Sin `.env` se puede pasar por línea de comandos: `POSTGRES_PORT=5433 POSTGRES_PASSWORD=... docker compose up -d db`.

| Servicio | Puerto |
|---|---|
| PostgreSQL | 5432 |
| Backend (FastAPI) | 8000 |
| Web (Vite) | 5173 |
| Expo / Metro | 8081 |

## Probar el flujo de la Fase 0

1. Levantar el backend.
2. Consultar la salud:

```bash
curl http://localhost:8000/api/v1/salud
# {"estado":"ok","servicio":"backend","version":"0.1.0","base_de_datos":"ok"}
```

3. Caso inválido (ruta inexistente, devuelve el sobre de error común):

```bash
curl -i http://localhost:8000/api/v1/no-existe
# HTTP/1.1 404 ... {"error":{"codigo":"no_encontrado","mensaje":"Recurso no encontrado","detalle":null}}
```

4. Abrir la web y la app: ambas muestran la leyenda fija y "backend OK". Con el backend detenido muestran el estado de error.

## Usuarios de demostración

Los crea `python -m app.db.seed` (ficticios; `@demo.evacuaciones.invalid`). La contraseña sale de `DEMO_PASSWORD` (el admin usa `DEMO_ADMIN_PASSWORD` si está definida); los valores de ejemplo están en `.env.example`.

| Correo | Rol |
|---|---|
| `admin@demo.evacuaciones.invalid` | admin |
| `decisor@demo.evacuaciones.invalid` | decisor |
| `operador@demo.evacuaciones.invalid` | operador |
| `cuadrilla@demo.evacuaciones.invalid` | cuadrilla |
| `ciudadano1@…` y `ciudadano2@…` | ciudadano (S2 y S3) |
| `productor1@…` (en S4) y `productor2@…` (en S1) | productor |

## Probar el flujo de autenticación (Fase 1)

Con el backend en marcha (`uvicorn app.main:app --port 8000`) y la base sembrada:

```bash
API=http://localhost:8000/api/v1
# Registro (requiere consentimiento)
curl -s -X POST $API/auth/registro/ciudadano -H 'Content-Type: application/json' \
  -d '{"email":"ana@ejemplo.invalid","password":"UnaClaveLarga-2026","nombre_visible":"Ana Prueba","consentimiento":true}'
# Login y usuario actual
curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -H 'X-Cliente: movil' \
  -d '{"email":"ana@ejemplo.invalid","password":"UnaClaveLarga-2026"}'
curl -s $API/auth/yo -H "Authorization: Bearer <access_token>"
# Caso inválido: sin consentimiento -> 422
curl -s -X POST $API/auth/registro/ciudadano -H 'Content-Type: application/json' \
  -d '{"email":"b@ejemplo.invalid","password":"UnaClaveLarga-2026","nombre_visible":"B Prueba","consentimiento":false}'
```

Contrato completo en `docs/contrato_api.md`; medidas de seguridad en `docs/seguridad.md`; fuentes y categorías de cada cifra en `docs/ficha_fuentes.md`.

## Pruebas y calidad

Las pruebas del backend usan una base PostGIS separada (`evacuaciones_test`, en el mismo servidor que `DATABASE_URL`; se puede fijar otra con `TEST_DATABASE_URL`). Al iniciar, `pytest` recrea el esquema, aplica las migraciones y carga los seeds; si no hay base disponible, las pruebas que la necesitan se omiten. El usuario de la base debe poder crear bases de datos.

```bash
cd apps/backend && ruff check . && pytest -q
pnpm test          # vitest de la web
pnpm typecheck     # tsc --noEmit en web, móvil y shared
pnpm lint
```

## Estructura

```
apps/backend    FastAPI (app/, alembic/, tests/, db/init/, Dockerfile)
apps/frontend   Web: Vite + React 18 + Chakra UI
apps/mobile     App Expo (expo-router)
packages/shared Constantes compartidas (leyenda, categorías, roles, fecha de corte)
data/kit        Kit del evento, originales SIN MODIFICAR
data/processed  Datos derivados (K1 limpio y serie diaria)
data/simulado   Datos ficticios rotulados SIMULADO
data/geo        Capas de referencia
docs            Documentación y decisiones
```

Los datos del kit viven en `data/kit/` y no se modifican; toda transformación genera archivos nuevos en `data/processed/`.
