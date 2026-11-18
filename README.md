# Plataforma de Gestión de Evacuaciones · Equipo 3 IPF

> PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial

Simulador de planificación de evacuaciones (Desafío 6). Esta es la **Fase 0**: esqueleto del monorepo con backend, web y app móvil que muestran la leyenda obligatoria y el estado del backend.

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
cp .env.example .env            # completar valores (nunca commitear .env)
pnpm install                    # dependencias de web, app móvil y shared

cd apps/backend
python -m venv .venv
.venv/Scripts/activate          # Windows (Git Bash); en Linux/macOS: source .venv/bin/activate
pip install -r requirements-dev.txt
```

## Arranque

**Base de datos (opcional en Fase 0)**

```bash
docker compose up -d db
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

Si el puerto 5432 ya está ocupado por un PostgreSQL local, definir `POSTGRES_PORT=5433` en `.env` y ajustar `DATABASE_URL` al mismo puerto.

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

## Pruebas y calidad

```bash
cd apps/backend && ruff check . && pytest -q
pnpm test          # vitest de la web
pnpm typecheck     # tsc --noEmit en web, móvil y shared
pnpm lint
```

## Estructura

```
apps/backend    FastAPI (app/, tests/, db/init/, Dockerfile)
apps/frontend   Web: Vite + React 18 + Chakra UI
apps/mobile     App Expo (expo-router)
packages/shared Constantes compartidas (leyenda, categorías, roles, fecha de corte)
data/kit        Kit del evento, originales SIN MODIFICAR
data/processed  Datos derivados (Fase 1)
data/simulado   Datos ficticios rotulados SIMULADO
data/geo        Capas de referencia
docs            Documentación y decisiones
```

Los datos del kit viven en `data/kit/` y no se modifican; toda transformación genera archivos nuevos en `data/processed/`.
