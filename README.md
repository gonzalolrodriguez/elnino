# Plataforma de Gestión de Evacuaciones · Equipo 3 IPF

> PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial

Simulador de planificación de evacuaciones (Desafío 06 · AI LAB Misión: Código Formosa, Operación Agua). Estado: **entrega v1.0** (Fases 0 a 6). Monorepo con backend FastAPI + PostgreSQL/PostGIS/pgRouting (`apps/backend`), portal y panel web React (`apps/frontend`) y app móvil Expo (`apps/mobile`). Todo lo que calcula la herramienta es `SIMULADO`; los datos del kit conservan su categoría.

Documentación: contrato de la API (`docs/contrato_api.md`, `docs/openapi.json`), arquitectura (`docs/arquitectura.md`), seguridad (`docs/seguridad.md`), decisiones (`docs/decisiones.md`) y fichas de entrega (`docs/ficha_tecnica.md`, `docs/ficha_fuentes.md`, `docs/registro_limpieza.md`).

## Requisitos y versiones

| Herramienta | Versión probada | Para qué |
|---|---|---|
| Node.js | 24.x | Web y app móvil |
| pnpm | 10.18 (`packageManager` del `package.json`) | Workspaces |
| Python | 3.12 o superior (probado con 3.13) | Backend local, pruebas y scripts de datos |
| Docker + Compose v2 | Recomendado | PostgreSQL 16 + PostGIS + pgRouting y backend en contenedor |
| Expo SDK | 58 | App móvil |

## Instalación

```bash
cp .env.example .env            # y completar los secretos (ver abajo); nunca commitear .env
pnpm install                    # dependencias de web, app móvil y shared (la primera vez tarda varios minutos)

cd apps/backend
python -m venv .venv
.venv/Scripts/activate          # Windows (Git Bash); en Linux/macOS: source .venv/bin/activate
pip install -r requirements-dev.txt
```

`pnpm install` puede mostrar el aviso "Ignored build scripts"; es inofensivo para este proyecto.

**Variables de entorno (`.env`).** Reemplazar todos los valores `CAMBIAR...` y `cambiar_esta_clave`; el backend se niega a firmar o cifrar con los marcadores.

| Variable | Obligatoria | Uso |
|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | sí (la contraseña) | Base de datos de `docker compose` (puerto del anfitrión, por defecto 5432) |
| `DATABASE_URL` | sí | Conexión del backend local y de las pruebas; **debe usar el mismo puerto y contraseña que `POSTGRES_*`** |
| `JWT_SECRET` | sí | Firma de los tokens, mínimo 32 caracteres |
| `FIELD_ENCRYPTION_KEY` | sí | Clave AES-GCM de 32 bytes en base64 |
| `CANAL_HMAC_SECRET` | sí | Firma HMAC de los canales simulados, mínimo 16 caracteres |
| `DEMO_PASSWORD`, `DEMO_ADMIN_PASSWORD` | sí (seed y pruebas) | Contraseñas de los usuarios de demostración |
| `COOKIE_SECURE` | no | `false` solo en desarrollo con `http://localhost` |
| `CORS_ORIGINS` | no | Orígenes permitidos (por defecto `http://localhost:5173,http://localhost:8081`) |
| `BACKEND_PORT` | no | Puerto del anfitrión para el backend en Docker (por defecto 8000) |
| `COMPOSE_PROJECT_NAME` | no | Nombre del proyecto de Compose; permite tener dos copias a la vez |
| `VITE_API_URL`, `EXPO_PUBLIC_API_URL` | no | URL del backend para la web y valor por defecto de la app (la app permite cambiarla en «Servidor»; por defecto `http://localhost:8000` en la web) |
| `VITE_APK_URL` | no | Enlace de descarga del APK que muestra la web en `/app` |

Las claves se generan así:

```bash
openssl rand -hex 32                                                           # JWT_SECRET
python -c "import base64,os;print(base64.b64encode(os.urandom(32)).decode())"  # FIELD_ENCRYPTION_KEY
openssl rand -hex 24                                                           # CANAL_HMAC_SECRET
```

## Arranque

### Opción A (recomendada): base de datos y backend con Docker

```bash
docker compose up -d --build     # db + backend; el backend aplica las migraciones y carga los datos de demostración al iniciar
curl http://localhost:8000/api/v1/salud
# {"estado":"ok","servicio":"backend","version":"0.1.0","base_de_datos":"ok"}
```

El servicio monta `./data` en `/data` (solo lectura). Esperar unos 20 segundos a que termine el seed antes de usar la API. Detener: `docker compose stop` (conserva los datos); `docker compose down -v` los borra.

### Opción B: backend local (desde `apps/backend`, con el entorno virtual activo)

```bash
docker compose up -d db            # solo la base (ejecutar en la raíz del repo)
set -a; . ../../.env; set +a       # carga .env en el entorno (también lo necesitan las pruebas)
python -m app.ingest.limpieza_k1   # K1 -> data/processed/k1_limpio.csv, k1_diario.csv y docs/registro_limpieza.md (reproduce los archivos versionados)
alembic upgrade head               # crea el esquema (PostGIS y tablas de CLAUDE.md §7)
python -m app.db.seed              # K3, K10 (sin cambios), K1 limpio, datos SIMULADOS y usuarios de demo; idempotente
uvicorn app.main:app --reload --port 8000
```

El script de limpieza solo lee `data/kit/` y escribe en `data/processed/`. Si la base no está disponible, `/api/v1/salud` responde igualmente con `"base_de_datos": "no_disponible"`.

### Web y app móvil

```bash
pnpm dev:web       # Vite en http://localhost:5173 (equivale a pnpm --filter @evacuaciones/frontend dev)
pnpm dev:mobile    # Expo / Metro en el puerto 8081 (ver "App móvil")
```

## Puertos

| Servicio | Puerto | Cómo cambiarlo |
|---|---|---|
| PostgreSQL | 5432 | `POSTGRES_PORT` en `.env` y el mismo puerto en `DATABASE_URL`. Si hay un PostgreSQL local en 5432 (frecuente en Windows), usar 5433 |
| Backend (FastAPI) | 8000 | `BACKEND_PORT` con Docker; `--port` con Uvicorn |
| Web (Vite) | 5173 | `pnpm --filter @evacuaciones/frontend dev --port <n>` (y agregar el origen a `CORS_ORIGINS`) |
| Expo / Metro | 8081 | `--port` de Expo |

## Usuarios de demostración

Los crea `python -m app.db.seed` (ficticios; `@demo.evacuaciones.invalid`). La contraseña sale de `DEMO_PASSWORD`; el admin usa `DEMO_ADMIN_PASSWORD` si está definida (los valores de ejemplo están en `.env.example`).

| Correo | Rol |
|---|---|
| `admin@demo.evacuaciones.invalid` | admin |
| `decisor@demo.evacuaciones.invalid` | decisor |
| `operador@demo.evacuaciones.invalid` | operador |
| `cuadrilla@demo.evacuaciones.invalid` | cuadrilla |
| `ciudadano1@…` y `ciudadano2@…` | ciudadano (S2 y S3) |
| `productor1@…` (en S4) y `productor2@…` (en S1) | productor |

## Probar el flujo principal y una entrada inválida

Con el backend en marcha, la base sembrada y las variables de `.env` en el entorno (`set -a; . ./.env; set +a`, desde la raíz):

```bash
API=http://localhost:8000/api/v1
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"operador@demo.evacuaciones.invalid","password":"'"$DEMO_PASSWORD"'"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# Flujo principal: con 7,60 m y 40 mm, S4 queda comprometido y aislado; S1 y S3 en riesgo; S2 normal
curl -s -X POST $API/simulacion/escenario -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"altura_formosa_m":7.6,"lluvia_mm":40,"caminos_cerrados":[]}'

# Entrada inválida: altura fuera de 0 a 12 m -> 422 con el sobre de error común
curl -s -X POST $API/simulacion/escenario -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"altura_formosa_m":13}'
# {"error":{"codigo":"validacion","mensaje":"Datos de entrada inválidos","detalle":[{"campo":"body.altura_formosa_m","mensaje":"Input should be less than or equal to 12"}]}}

# Ruta inexistente -> 404 {"error":{"codigo":"no_encontrado",...}}
curl -i $API/no-existe
```

Registro y login (el caso inválido es el consentimiento ausente):

```bash
curl -s -X POST $API/auth/registro/ciudadano -H 'Content-Type: application/json' \
  -d '{"email":"ana@ejemplo.invalid","password":"UnaClaveLarga-2026","nombre_visible":"Ana Prueba","consentimiento":true}'
curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -H 'X-Cliente: movil' \
  -d '{"email":"ana@ejemplo.invalid","password":"UnaClaveLarga-2026"}'
# Caso inválido: sin consentimiento -> 422
curl -s -X POST $API/auth/registro/ciudadano -H 'Content-Type: application/json' \
  -d '{"email":"b@ejemplo.invalid","password":"UnaClaveLarga-2026","nombre_visible":"B Prueba","consentimiento":false}'
```

En la web, el mismo flujo está en `/comando/mapa` (simulador). La web y la app muestran la leyenda fija y "backend OK"; con el backend detenido muestran el estado de error. Casos inválidos en la interfaz: enviar vacío el formulario de la bitácora o el motivo de un acceso (se rechaza antes de llamar al servidor).

## Contrato frontend–backend

El frontend y la app consumen la API REST `/api/v1` y un WebSocket. Rutas, entradas, salidas y errores: `docs/contrato_api.md` (con ejemplos `curl` reproducibles) y `docs/openapi.json` (esquema exportado de la aplicación; con el backend en marcha, también en http://localhost:8000/docs). Ejemplo de la operación principal: `POST /simulacion/escenario`, en la sección anterior.

## Guion de demo (3 minutos, CLAUDE.md §14)

Preparación: backend y base sembrados, `pnpm dev:web`; la contraseña de todos los usuarios de demostración es `DEMO_PASSWORD` del `.env` (la del admin, `DEMO_ADMIN_PASSWORD`).

| Paso | Qué hacer | Usuario y ruta |
|---|---|---|
| 1. Landing | Abrir `/`: el agua baja desde el Pantanal hasta Formosa y se ve el dato del corte (5,60 m, `DATO OBSERVADO`). Ir a `/registro/productor`, pulsar "Usar el ejemplo del sector S4", completar los datos y la hacienda, aceptar el consentimiento y registrar | Público |
| 2. Monitor y simulador | Iniciar sesión como `decisor@demo.evacuaciones.invalid`. En `/comando` ver la serie K1 con umbrales y "¿cuánto tiempo queda?". En `/comando/mapa` subir la altura a 7,60 m: S4 queda comprometido antes de la alerta | `decisor` · `/comando`, `/comando/mapa` |
| 3. Lluvia y caminos | En el simulador poner 40 mm de lluvia: el camino de tierra de S4 queda intransitable y S4, aislado. Marcar un acceso de ripio de S1 como no transitable con su motivo. Opcional: cargar un parte simulado en `/comando/lluvia` | `decisor` u `operador` · `/comando/mapa`, `/comando/lluvia` |
| 4. Recomendador | En `/comando/recomendacion` generar la recomendación (familias y rodeo del productor registrado, camiones, dormidero, raciones, centro receptor) y comparar dos alternativas. Opcional: `/comando/produccion` con el caso de control | `decisor` · `/comando/recomendacion` |
| 5. Orden | En `/comando/ordenes` emitir una evacuación preventiva para S4 (con confirmación): se crean las notificaciones, la tarea de la cuadrilla (`/comando/operacion`) y un borrador de bitácora. En la app, iniciar sesión como `productor1@demo.evacuaciones.invalid`: la orden llega como notificación local (con la app abierta) | `decisor` · `/comando/ordenes`; app móvil |
| 6. Bitácora y Centinela | Completar el borrador en `/comando/bitacora` (seis campos de K8). En `/comando/centinela` ver refutadas "10,7 m en 2016" y "superó la evacuación en octubre" | `decisor` · `/comando/bitacora`, `/comando/centinela` |

Caso inválido de la demo: ingresar como `operador@demo.evacuaciones.invalid` en `/comando/ordenes` (formulario deshabilitado; el backend responde 403 a cualquier rol que no sea `decisor`).

## Verificación rápida

Las pruebas del backend usan una base PostGIS separada (`evacuaciones_test`, en el mismo servidor que `DATABASE_URL`; otra con `TEST_DATABASE_URL`). Al iniciar, `pytest` la recrea, aplica las migraciones y carga los seeds; el usuario de la base debe poder crear bases de datos. Si no hay base, las pruebas que la necesitan se omiten (no cuentan como aprobadas). Requieren las variables de `.env` en el entorno.

```bash
# Backend (desde apps/backend, entorno virtual activo, base levantada)
set -a; . ../../.env; set +a
ruff check . && pytest -q                    # 311 pruebas

# Web y app (desde la raíz)
pnpm -r typecheck                            # tsc --noEmit en web, app y shared
pnpm --filter @evacuaciones/frontend test    # vitest: 194 pruebas (pnpm test hace lo mismo)
pnpm --filter @evacuaciones/frontend lint
pnpm --filter @evacuaciones/frontend build
pnpm --filter @evacuaciones/mobile test      # jest-expo: 220 pruebas
```

## App móvil (`apps/mobile`)

Expo SDK 58 + expo-router. Pantallas: registro y login, perfil, pedido de asistencia (GPS, foto, texto), mis solicitudes, alertas, mi sector y modo cuadrilla. La cola offline usa `expo-sqlite` y envía en dos tiempos: primero el JSON de la solicitud (con `Idempotency-Key`, un UUID generado al encolar y reutilizado en cada reintento) y después la foto comprimida a `POST /solicitudes/{id}/adjuntos`, con reintento propio. Un reintento tras una respuesta perdida no duplica la solicitud.

**Expo Go o development build.** Expo Go alcanza para probar registro, login, perfil, solicitudes, cola offline y alertas. El mapa del sector con `react-native-maps` y el push remoto necesitan un development build o el APK; en Expo Go el mapa puede no mostrarse. El push remoto (FCM) está fuera del alcance: las alertas llegan como notificaciones locales mientras la app está abierta.

**Servidor configurable en la app.** Un mismo APK sirve en cualquier red: la URL del backend se elige dentro de la app y no está fija en la compilación. Está en «Servidor» en la pantalla de bienvenida (antes de ingresar) y en el Perfil (después de ingresar):

1. Averiguar la IP de la PC con `ipconfig` y poner el teléfono en la misma red Wi-Fi.
2. Levantar el backend escuchando en todas las interfaces (el de Docker ya lo hace; local: `uvicorn app.main:app --host 0.0.0.0 --port 8000`).
3. Permitir el puerto 8000 en el firewall de Windows. Ejecutar **una vez, en una consola como administrador**: `netsh advfirewall firewall add rule name="Evacuaciones backend 8000" dir=in action=allow protocol=TCP localport=8000`
4. En la app, escribir `http://<IP-de-la-PC>:8000` (ej.: `http://192.168.1.50:8000`), tocar «Probar conexión» (consulta `GET /api/v1/salud`, con tiempo máximo de 5 s) y «Guardar». La app quita una barra final o un `/api/v1` escrito por error. «Restablecer valor por defecto» vuelve al valor de compilación.
5. Si se cambia el servidor con la sesión abierta, la app avisa que la sesión se cierra (el token pertenece al otro servidor) y, si hay solicitudes sin enviar, permite conservarlas o descartarlas. Cada solicitud en cola guarda el servidor para el que se creó y solo se envía a ese servidor y con la misma cuenta; las de otro servidor figuran como «Pendientes para otro servidor (host)» en Mis solicitudes, con opción de descartarlas.

La URL vigente se lee en cada llamada (HTTP, cola offline, fotos y WebSocket `ws://`/`wss://`), así que el cambio aplica sin reiniciar. La app nativa no está sujeta a CORS: no hace falta tocar `CORS_ORIGINS` (solo si se prueba la web desde otro equipo). El APK permite tráfico HTTP sin cifrar (`usesCleartextTraffic`, vía `expo-build-properties`) para poder hablar con un backend de la red local; ver el compromiso en `docs/seguridad.md`.

| Variable | Dónde | Uso |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | app móvil (compilación, opcional) | Valor por defecto del servidor. Si falta, la app arranca sin servidor y pide configurarlo |
| `EXPO_PUBLIC_SMS_DESTINO` | app móvil | Número al que se dirige el SMS de respaldo `SOS-FSA`; si falta, el usuario elige el destinatario. La app solo abre la app de mensajes: nunca envía sola |
| `GOOGLE_MAPS_API_KEY` | compilación del APK | Clave de Google Maps SDK for Android para ver el mapa. Se lee en `app.config.ts` al compilar; no se guarda en el repositorio |
| `VITE_APK_URL` | web (compilación) | Enlace de descarga del APK; con ella la ruta `/app` muestra el botón de descarga |

**APK con EAS Build** (requiere la cuenta de Expo del equipo):

```bash
cd apps/mobile
npx eas login
npx eas build --profile preview --platform android   # perfil preview, buildType apk
# con mapa: GOOGLE_MAPS_API_KEY=<clave> npx eas build --profile preview --platform android
```

En EAS la clave se define como secreto del proyecto (`npx eas secret:create`) en lugar de pasarla por la línea de comandos. Al terminar, EAS entrega un enlace de descarga del `.apk`. Para distribuirlo: adjuntar el archivo a la release `v1.0-entrega` de GitHub y poner la URL del asset en `VITE_APK_URL` al compilar la web.

**Adjuntos en el backend.** Las fotos se guardan en disco con estas variables (todas opcionales):

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `ADJUNTOS_DIR` | `<raíz del repo>/uploads` | Carpeta de los adjuntos; está fuera de `data/` y ignorada por git (con Docker queda dentro del contenedor y se pierde al recrearlo) |
| `ADJUNTO_MAX_BYTES` | `2097152` (2 MB) | Tamaño máximo por foto; si se supera, responde 413 |
| `ADJUNTOS_MAX_POR_SOLICITUD` | `5` | Máximo de adjuntos por solicitud; si se supera, responde 409 |

## Portal web (`apps/frontend`)

```bash
pnpm --filter @evacuaciones/frontend dev        # Vite en http://localhost:5173
pnpm --filter @evacuaciones/frontend datos      # regenera los JSON estáticos de src/datos/ (K1 diario y K10)
```

- `VITE_API_URL` define la URL del backend (por defecto `http://localhost:8000`; el prefijo `/api/v1` se agrega solo). El origen del portal debe figurar en `CORS_ORIGINS`; por defecto se admiten `http://localhost:5173` y `http://localhost:8081`. El refresh token viaja en una cookie `HttpOnly` (`SameSite=Strict`, ruta `/api/v1/auth`), por lo que el portal y el backend deben compartir sitio (por ejemplo, ambos en `localhost`).
- La serie de Puerto Formosa de la página Información se pide a `GET /serie/formosa`; si el backend no responde, se usa el JSON estático (`src/datos/k1_diario.json`, generado con el comando `datos`).
- Rutas públicas: `/` (landing), `/informacion` (antes `/el-nino`, que redirige), `/registro/ciudadania`, `/registro/productor`, `/login`, `/app`.
- Rutas privadas: `/mi-cuenta` (ciudadano y productor), `/cuadrilla` (cuadrilla y admin: tareas asignadas, checklist, alertas y tiempo real), `/comando/*` (operador, decisor y admin; ver "Panel operativo"), `/admin` (admin). Cualquier otra ruta vuelve a `/`.
- Pruebas y calidad: `pnpm --filter @evacuaciones/frontend test`, `lint` y `build`.
- Navegadores admitidos (`browserslist` de `apps/frontend/package.json`): Chrome 70+, Edge 79+, Safari y iOS 12+, Firefox 78+, Samsung Internet 10+. `vite build` genera un paquete moderno y otro heredado (`@vitejs/plugin-legacy`, con polyfills de core-js) que el navegador elige solo. El 3D de la landing y el mapa operativo exigen WebGL 2: sin él (o en equipos de 2 núcleos o 2 GB de memoria o menos, solo la landing) se usa el esquema 2D, y el mapa muestra un aviso con el simulador y las listas disponibles.
- Adaptable de 320 px a 2560 px: el menú se pliega bajo 768 px, las páginas de formulario muestran un panel de apoyo a la derecha desde 992 px, las tablas anchas se desplazan dentro de su propia región (enfocable con el teclado), y se respetan `prefers-reduced-motion`, `prefers-contrast: more`, `forced-colors` y los objetivos táctiles de 44 px (`pointer: coarse`).

## Panel operativo

Disponible en `/comando/*` para `operador`, `decisor` y `admin` (la ciudadanía y los productores son redirigidos a su cuenta) y en `/admin` para `admin`. Se carga bajo demanda (chunk aparte; el mapa, con MapLibre GL y Deck.gl, en otro).

| Ruta | Qué hace |
|---|---|
| `/comando` | Monitor: serie K1 con umbrales y picos, ascenso y "¿cuánto tiempo queda?" (proyección lineal, SUPUESTO), lluvia por origen |
| `/comando/mapa` | Mapa con sectores K10, accesos, centros, estaciones y capas oficiales (cada una con fuente y fecha de actualización); simulador (altura 0 a 12 m, lluvia, caminos cerrados, ISAD SIMULADO); marcar un camino como no transitable con su motivo (`PATCH /accesos/{id}`); ruteo vehicular, de camión jaula y de arreo |
| `/comando/recomendacion` | Recomendador por sector (una recomendación, no una orden) con veredicto "¿alcanza el tiempo?" (río y, opcionalmente, lluvia prevista SIMULADA para la ventana seca), tiempos por la red vial y centros descartados; comparador de tres alternativas |
| `/comando/produccion` | Arca Productiva: calculadora ganadera con sus supuestos |
| `/comando/operacion`, `/comando/lluvia` | Solicitudes, tareas y cuadrillas; parte de lluvia, importación y exportación de la planilla UPCA |
| `/comando/ordenes` | Emisión de órdenes (solo `decisor`, con confirmación; el operador ve el formulario deshabilitado); abre el borrador de bitácora |
| `/comando/bitacora`, `/comando/centinela`, `/comando/limites` | Bitácora K8 (seis campos obligatorios, exporta Markdown); auditoría de K1 y verificadores K6 y K7; límites de los datos |
| `/admin` | Alta, cambio de rol operativo y baja de usuarios institucionales |

- El mapa funciona sin internet y sin claves: fondo liso y capas oficiales recortadas en `apps/frontend/public/capas/` (las genera `pnpm --filter @evacuaciones/frontend datos` desde `data/geo/`; el `build` las regenera). El fondo OpenStreetMap es opcional y requiere conexión.
- Los avisos en tiempo real usan `WS /api/v1/ws`: el token viaja solo como primer mensaje y la conexión se reabre al renovarse el token.

## Capas territoriales oficiales (`data/geo/`)

Lugares reales de fuentes oficiales (IGN, BAHRA/Georef, Mapa Educativo, REFES, OSM), rotulados `DOCUMENTO DE REFERENCIA`. Ya están versionadas, así que la demo funciona sin internet. Detalle, licencias y limitaciones en `data/geo/LEEME.md`.

```bash
python apps/backend/scripts/descargar_capas.py                       # regenera todas las capas (~3 min, requiere internet)
python apps/backend/scripts/descargar_capas.py --solo vial,escuelas  # solo algunas
python apps/backend/scripts/descargar_relieve.py                     # relieve, curvas de nivel y río Paraguay (~1 min, requiere internet)
(cd apps/frontend && node scripts/preparar-datos.mjs)                # copia las capas a public/ para la web (también corre en `pnpm build`)
```

## Motor de simulación y canales (Fase 2)

El resto de los endpoints (recomendador, alternativas, ruteo, Arca Productiva, lluvia, canales con HMAC, órdenes, bitácora, verificadores y WebSocket) está en `docs/contrato_api.md` con ejemplos `curl`.

**Red vial para el ruteo y el recomendador.** Con Docker (opción A), el contenedor carga la red real de OpenStreetMap (`data/geo/red_vial.geojson`, 12.987 tramos, unos 10 s la primera vez) si la tabla está vacía. Con el backend local (opción B) hay que cargarla a mano. Sin red cargada, `POST /ruteo` y el recomendador usan una estimación aproximada con su limitación explícita.

```bash
cd apps/backend
python -m app.ingest.red_vial --si-vacia      # carga data/geo/red_vial.geojson (o pasar otra ruta; --agregar la suma)
```

Propiedades reconocidas del GeoJSON de `LineString`: `nombre`, `superficie` (`pavimento`, `ripio`, `tierra` o `desconocida`; si falta se infiere de `surface` o `highway`) y, si la red ya está partida en nodos, `nodo_ini` y `nodo_fin`.

**Canales simulados.** `CANAL_HMAC_SECRET` (mínimo 16 caracteres) es obligatorio en `.env`; cada petición debe llevar `X-Hub-Signature-256: sha256=<HMAC-SHA256 del cuerpo>` (ver `docs/contrato_api.md`).

**WebSocket.** `ws://localhost:8000/api/v1/ws`: el primer mensaje debe ser `{"token": "<access_token>"}`; el token no va en la URL.

## Estructura

```
apps/backend    FastAPI (app/, alembic/, tests/, db/init/, scripts/, Dockerfile)
apps/frontend   Web: Vite + React 18 + Chakra UI (landing, mi cuenta, panel /comando, /admin)
apps/mobile     App Expo (expo-router)
packages/shared Constantes compartidas (leyenda, categorías, roles, fecha de corte)
data/kit        Kit del evento, originales SIN MODIFICAR
data/processed  Datos derivados (K1 limpio y serie diaria)
data/simulado   Datos ficticios rotulados SIMULADO
data/geo        Capas de referencia oficiales
docs            Fichas, contrato, arquitectura, seguridad y decisiones
odd             Seguimiento de tareas por fase
```

Los datos del kit viven en `data/kit/` y no se modifican; toda transformación genera archivos nuevos en `data/processed/`.

## Entrega

Repositorio: https://github.com/gonzalolrodriguez/elnino. El commit evaluable es el tag `v1.0-entrega` sobre `main`.
