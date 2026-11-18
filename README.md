# Plataforma de Gestión de Evacuaciones · Equipo 3 IPF

> PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial

Simulador de planificación de evacuaciones (Desafío 6). Estado: **Fase 3** (panel operativo web) sobre la **Fase 2** (motor), capas territoriales oficiales y portal público (Fase 4) sobre las fases 0 y 1: limpieza de K1, modelo de datos con migraciones, carga de K3/K10/K1 y datos simulados, autenticación con roles, cifrado de campos sensibles, bitácora de accesos con hash encadenado, y el motor de simulación (escenario, ISAD, recomendador, alternativas, ruteo con pgRouting, Arca Productiva, cuadrillas, lluvia, canales simulados, órdenes, bitácora K8, verificadores K6/K7 y WebSocket).

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

**Backend** (con Docker, junto con la base): `docker compose up -d --build backend` (aplica migraciones y seed; ver más abajo). Local:

```bash
cd apps/backend
uvicorn app.main:app --reload --port 8000
```

Si la base no está disponible, `/api/v1/salud` responde igualmente con `"base_de_datos": "no_disponible"`.

**Web**: `pnpm dev:web` (equivale a `pnpm --filter @evacuaciones/frontend dev`) → http://localhost:5173. Ver la sección siguiente.

## App móvil (`apps/mobile`)

Expo SDK 58 + expo-router. Pantallas: registro y login, perfil, pedido de asistencia (GPS, foto, texto), mis solicitudes, alertas, mi sector y modo cuadrilla. La cola offline usa `expo-sqlite` y envía en dos tiempos: primero el JSON de la solicitud (con `Idempotency-Key`, un UUID generado al encolar y reutilizado en cada reintento) y después la foto comprimida a `POST /solicitudes/{id}/adjuntos`, con reintento propio. Un reintento tras una respuesta perdida no duplica la solicitud.

```bash
pnpm dev:mobile        # equivale a pnpm --filter @evacuaciones/mobile start
```

**Expo Go o development build.** Expo Go alcanza para probar registro, login, perfil, solicitudes, cola offline y alertas. El mapa del sector con `react-native-maps` y el push remoto necesitan un development build o el APK; en Expo Go el mapa puede no mostrarse. El push remoto (FCM) está fuera del alcance: las alertas llegan como notificaciones locales mientras la app está abierta.

**Conexión con el backend desde un teléfono físico.** `localhost` no sirve en el teléfono:

1. Averiguar la IP de la PC en la red local (`ipconfig`) y poner el teléfono en la misma red.
2. Levantar el backend escuchando en todas las interfaces: `uvicorn app.main:app --host 0.0.0.0 --port 8000` (y permitir el puerto 8000 en el firewall de Windows).
3. Definir `EXPO_PUBLIC_API_URL=http://<IP-de-la-PC>:8000` antes de `pnpm dev:mobile`.
4. Agregar ese origen a `CORS_ORIGINS` del backend si se prueba la versión web desde otro equipo. La app nativa no está sujeta a CORS.

| Variable | Dónde | Uso |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | app móvil | URL base del backend (por defecto `http://localhost:8000`) |
| `EXPO_PUBLIC_SMS_DESTINO` | app móvil | Número al que se dirige el SMS de respaldo `SOS-FSA`; si falta, el usuario elige el destinatario. La app solo abre la app de mensajes: nunca envía sola |
| `GOOGLE_MAPS_API_KEY` | compilación del APK | Clave de Google Maps SDK for Android para ver el mapa. Se lee en `app.config.ts` al compilar; no se guarda en el repositorio |

**APK con EAS Build** (requiere la cuenta de Expo del equipo):

```bash
cd apps/mobile
npx eas login
GOOGLE_MAPS_API_KEY=<clave> npx eas build --profile preview --platform android   # perfil preview, buildType apk
```

En EAS la clave se define como secreto del proyecto (`npx eas secret:create`) en lugar de pasarla por la línea de comandos.

**Adjuntos en el backend.** Las fotos se guardan en disco con estas variables (todas opcionales):

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `ADJUNTOS_DIR` | `<raíz del repo>/uploads` | Carpeta de los adjuntos; está fuera de `data/` y ignorada por git |
| `ADJUNTO_MAX_BYTES` | `2097152` (2 MB) | Tamaño máximo por foto; si se supera, responde 413 |
| `ADJUNTOS_MAX_POR_SOLICITUD` | `5` | Máximo de adjuntos por solicitud; si se supera, responde 409 |

## Portal web (`apps/frontend`)

```bash
pnpm --filter @evacuaciones/frontend dev        # Vite en http://localhost:5173
pnpm --filter @evacuaciones/frontend datos      # regenera los JSON estáticos de src/datos/ (K1 diario y K10)
```

- `VITE_API_URL` define la URL del backend (por defecto `http://localhost:8000`; el prefijo `/api/v1` se agrega solo). El origen del portal debe figurar en `CORS_ORIGINS` del backend; por defecto se admiten `http://localhost:5173` y `http://localhost:8081`. El refresh token viaja en una cookie `HttpOnly` (`SameSite=Strict`, ruta `/api/v1/auth`), por lo que el portal y el backend deben compartir sitio (por ejemplo, ambos en `localhost`).
- La serie de Puerto Formosa de la página El Niño se pide a `GET /serie/formosa`; si el backend no responde, se usa el JSON estático (`src/datos/k1_diario.json`, generado con el comando `datos`).
- Rutas públicas: `/` (landing), `/el-nino`, `/registro/ciudadania`, `/registro/productor`, `/login`, `/app`.
- Rutas privadas: `/mi-cuenta` (ciudadano y productor), `/cuadrilla` (cuadrilla y admin: tareas asignadas, checklist, alertas y tiempo real), `/comando/*` (operador, decisor y admin; ver "Panel operativo"), `/admin` (admin). Cualquier otra ruta vuelve a `/`.
- Pruebas y calidad: `pnpm --filter @evacuaciones/frontend test`, `lint` y `build`.

## Panel operativo (Fase 3)

Disponible en `/comando/*` para `operador`, `decisor` y `admin` (la ciudadanía y los productores son redirigidos a su cuenta) y en `/admin` para `admin`. Se carga bajo demanda (chunk aparte; el mapa, con MapLibre GL y Deck.gl, en otro).

| Ruta | Qué hace |
|---|---|
| `/comando` | Monitor: serie K1 con umbrales y picos, ascenso y "¿cuánto tiempo queda?" (proyección lineal, SUPUESTO), lluvia por origen |
| `/comando/mapa` | Mapa con sectores K10, accesos, centros, estaciones y capas oficiales (cada una con fuente y fecha de actualización); simulador (altura 0 a 12 m, lluvia, caminos cerrados, ISAD SIMULADO); marcar un camino como no transitable con su motivo (`PATCH /accesos/{id}`); ruteo vehicular, de camión jaula y de arreo |
| `/comando/recomendacion` | Recomendador por sector (una recomendación, no una orden) y comparador de tres alternativas |
| `/comando/produccion` | Arca Productiva: calculadora ganadera con sus supuestos |
| `/comando/operacion`, `/comando/lluvia` | Solicitudes, tareas y cuadrillas; parte de lluvia, importación y exportación de la planilla UPCA |
| `/comando/ordenes` | Emisión de órdenes (solo `decisor`, con confirmación; el operador ve el formulario deshabilitado); abre el borrador de bitácora |
| `/comando/bitacora`, `/comando/centinela`, `/comando/limites` | Bitácora K8 (seis campos obligatorios, exporta Markdown); auditoría de K1 y verificadores K6 y K7; límites de los datos |
| `/admin` | Alta, cambio de rol operativo y baja de usuarios institucionales |

- El mapa funciona sin internet y sin claves: fondo liso y capas oficiales recortadas en `apps/frontend/public/capas/` (las genera `pnpm --filter @evacuaciones/frontend datos` desde `data/geo/`; el `build` las regenera). El fondo OpenStreetMap es opcional y requiere conexión.
- Los avisos en tiempo real usan `WS /api/v1/ws`: el token viaja solo como primer mensaje y la conexión se reabre al renovarse el token.
- Prueba del flujo (guion de demo, pasos 2 a 6): ingresar como `decisor@demo.evacuaciones.invalid`; en `/comando/mapa` subir la altura a 7,60 m y la lluvia a 40 mm y calcular (S4 queda comprometido y aislado); marcar un acceso de S1 como no transitable; en `/comando/recomendacion` generar la recomendación y comparar alternativas; en `/comando/ordenes` emitir una evacuación preventiva para S4 y completar el borrador de bitácora; en `/comando/centinela` ver refutadas las afirmaciones de "10,7 m" y de "superó la evacuación en octubre". Caso inválido: enviar el formulario de la bitácora o el motivo del acceso vacíos (se rechaza antes de llamar al servidor), o ingresar como `operador` en `/comando/ordenes` (formulario deshabilitado).

## Capas territoriales oficiales (`data/geo/`)

Lugares reales de fuentes oficiales (IGN, BAHRA/Georef, Mapa Educativo, REFES, OSM), rotulados `DOCUMENTO DE REFERENCIA`. Ya están versionadas, así que la demo funciona sin internet. Detalle, licencias y limitaciones en `data/geo/LEEME.md`.

```bash
python apps/backend/scripts/descargar_capas.py                       # regenera todas las capas (~3 min, requiere internet)
python apps/backend/scripts/descargar_capas.py --solo vial,escuelas  # solo algunas

cd apps/backend
python -m app.ingest.red_vial                                        # carga data/geo/red_vial.geojson para pgRouting
```

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
cd apps/backend && ruff check . && pytest -q   # 190+ pruebas, incluidas las de las Fases 2 y 3
pnpm test          # vitest de la web
pnpm typecheck     # tsc --noEmit en web, móvil y shared
pnpm lint
```


## Probar el motor de simulación (Fase 2)

Con el backend en marcha y la base sembrada (el seed crea además dos cuadrillas de demostración):

```bash
API=http://localhost:8000/api/v1
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"operador@demo.evacuaciones.invalid","password":"'"$DEMO_PASSWORD"'"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# Flujo principal: con 7,60 m y 40 mm, S4 queda comprometido y aislado; S1 y S3 en riesgo; S2 normal
curl -s -X POST $API/simulacion/escenario -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"altura_formosa_m":7.6,"lluvia_mm":40,"caminos_cerrados":[]}'

# Entrada inválida: altura fuera de 0 a 12 m -> 422
curl -s -X POST $API/simulacion/escenario -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"altura_formosa_m":13}'
```

El resto de los endpoints (recomendador, alternativas, ruteo, Arca Productiva, lluvia, canales con HMAC, órdenes, bitácora, verificadores y WebSocket) está en `docs/contrato_api.md` con ejemplos `curl`.

**Red vial para el ruteo.** Sin red cargada, `POST /ruteo` usa una estimación aproximada con su limitación explícita. Para usar pgRouting con la red real (OpenStreetMap, ya partida en nodos):

```bash
cd apps/backend
python -m app.ingest.red_vial                 # carga data/geo/red_vial.geojson (o pasar otra ruta)
```

El archivo es un GeoJSON de `LineString`; propiedades reconocidas: `nombre`, `superficie` (`pavimento`, `ripio`, `tierra` o `desconocida`; si falta se infiere de `surface` o `highway` de OSM) y, si la red ya está partida en nodos, `nodo_ini` y `nodo_fin`. Reemplaza la red anterior (`--agregar` la suma).

**Canales simulados.** `CANAL_HMAC_SECRET` (mínimo 16 caracteres) es obligatorio en `.env` para usar los canales simulados; cada petición debe llevar `X-Hub-Signature-256: sha256=<HMAC-SHA256 del cuerpo>` (ver `docs/contrato_api.md`).

**WebSocket.** `ws://localhost:8000/api/v1/ws`: el primer mensaje debe ser `{"token": "<access_token>"}`; el token no va en la URL.

## Backend con Docker

```bash
docker compose up -d --build backend     # levanta db y backend; aplica migraciones y seed al iniciar
curl http://localhost:8000/api/v1/salud
docker compose stop
```

El servicio monta `./data` en `/data` (solo lectura; variable `DATA_DIR`). Requiere `JWT_SECRET`, `FIELD_ENCRYPTION_KEY`, `DEMO_PASSWORD` y `CANAL_HMAC_SECRET` en `.env`.

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
