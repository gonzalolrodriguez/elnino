# Contrato API · Plataforma de Gestión de Evacuaciones

> PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial

Prefijo: `/api/v1`. Documentación interactiva generada por FastAPI en `/docs` y esquema en `/openapi.json`. Este documento cubre lo implementado hasta la **Fase 2** (motor): meta, autenticación, usuarios, datos, simulación, producción, operación, Centinela, canales simulados y tiempo real.

## Convenciones

- Formato JSON en UTF-8. Autenticación con `Authorization: Bearer <access_token>`.
- Cliente móvil: enviar `X-Cliente: movil` en login y refresh para recibir también el `refresh_token` en el cuerpo. La web lo recibe solo en una cookie `HttpOnly`.
- Las respuestas con datos incluirán `categoria`, `fuente` y `fecha_dato` cuando corresponda (grupos de datos de fases siguientes).

### Sobre de error común

```json
{ "error": { "codigo": "validacion", "mensaje": "Datos de entrada inválidos", "detalle": [ { "campo": "body.password", "mensaje": "Value error, La contraseña debe tener al menos 10 caracteres" } ] } }
```

| HTTP | `codigo` | Cuándo |
|---|---|---|
| 401 | `no_autenticado` | Falta el token, es inválido o venció; credenciales o refresh incorrectos |
| 403 | `prohibido` | El rol no alcanza para la operación |
| 404 | `no_encontrado` | El recurso o la ruta no existen |
| 409 | `conflicto` | Correo ya registrado; un admin intenta desactivarse |
| 422 | `validacion` | Entrada inválida (campos faltantes, rangos, consentimiento ausente, contraseña corta, rol desconocido) |
| 429 | `demasiados_intentos` | Bloqueo temporal por intentos fallidos (por cuenta e IP) o límite de solicitudes excedido |

## Meta (público)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/salud` | Estado del servicio y de la base (`base_de_datos`: `ok` o `no_disponible`) |
| GET | `/meta` | Leyenda, categorías, límites, fecha de corte y flags |

## Auth

### `POST /auth/registro/ciudadano` (público, 201)

| Campo | Tipo | Reglas |
|---|---|---|
| `email` | string | Correo válido, único |
| `password` | string | 10 a 128 caracteres |
| `nombre_visible` | string | 2 a 120 |
| `consentimiento` | boolean | **Debe ser `true`** (Ley 25.326) o responde 422 |
| `integrantes`, `menores`, `mayores`, `mascotas` | entero | Opcionales (1–40, 0–40, 0–40, 0–100) |
| `telefono` | string | Opcional, máx. 30; se guarda cifrado |
| `lon`, `lat` | número | Opcionales; si vienen, se calcula el sector K10 del domicilio |

Respuesta 201:

```json
{ "id": 9, "email": "ana@ejemplo.invalid", "nombre_visible": "Ana Prueba", "rol": "ciudadano", "rol_operativo": null, "estado": "activo", "creado_en": "2026-11-17T22:41:03.512Z", "ultimo_login": null }
```

### `POST /auth/registro/productor` (público, 201)

Mismos campos de acceso y `consentimiento`, más:

```json
{ "establecimiento": { "nombre": "Establecimiento de prueba", "renspa": null, "lon": -58.139, "lat": -26.18,
    "stock": [ { "especie": "bovino", "categoria_animal": "vaca con cría", "cantidad": 5 } ] } }
```

La ubicación de la tranquera determina el sector K10 (en el ejemplo, S4). Respuesta igual al registro de ciudadano.

### `POST /auth/login`

Cuerpo `{ "email", "password" }`. Respuesta 200:

```json
{ "access_token": "<jwt>", "token_type": "bearer", "expires_in": 900,
  "usuario": { "id": 9, "email": "ana@ejemplo.invalid", "nombre_visible": "Ana Prueba", "rol": "ciudadano", "rol_operativo": null, "estado": "activo", "creado_en": "...", "ultimo_login": "..." } }
```

- Web: además `Set-Cookie: refresh_token=...; HttpOnly; SameSite=Strict; Path=/api/v1/auth` (`Secure` según `COOKIE_SECURE`).
- Con `X-Cliente: movil` el cuerpo incluye `"refresh_token"`.
- 401 para credenciales incorrectas; tras 5 fallos consecutivos **desde la misma IP** ese par cuenta+IP se bloquea 15 minutos y responde 429 incluso con la contraseña correcta; el titular que entra desde otra IP no se ve afectado.

### `POST /auth/refresh`

El token se toma del cuerpo `{ "refresh_token": "..." }` (móvil) o de la cookie (web; sin cuerpo). Devuelve una sesión nueva con el mismo formato que el login y **rota** el refresh token. Presentar un token ya usado o cerrado devuelve 401 y revoca toda la familia de sesiones.

### `POST /auth/logout`

Mismo origen del token que `refresh`. Revoca la familia de sesiones y borra la cookie. Siempre 200 `{ "mensaje": "Sesión cerrada" }` (idempotente).

### `GET /auth/yo` (autenticado)

Devuelve el usuario del token (mismo objeto `usuario`). 401 sin token válido.

## Usuarios (solo `admin`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/usuarios?limite=50&desplazamiento=0` | Lista usuarios (límite 1–200). Queda auditada como lectura de datos personales |
| POST | `/usuarios` | Crea un usuario institucional (201) |
| PATCH | `/usuarios/{id}` | Modifica `nombre_visible`, `rol`, `rol_operativo`, `estado` o `password` |

`POST /usuarios`:

```json
{ "email": "operador2@ejemplo.invalid", "password": "UnaClaveLarga-2026", "nombre_visible": "Operador Dos",
  "rol": "operador", "rol_operativo": "coordinador_sector" }
```

`rol` admite `cuadrilla`, `operador`, `decisor` o `admin` (los ciudadanos y productores se autorregistran). `rol_operativo` debe existir en el catálogo (`roles_operativos`) o responde 422. Un ciudadano o un token ausente reciben 403 y 401 respectivamente.

## Ejemplos reproducibles (curl)

Requisitos: backend en `http://localhost:8000` con la base migrada y sembrada (ver README) y los usuarios de demostración cargados.

```bash
API=http://localhost:8000/api/v1

# 1. Registro de un ciudadano
curl -s -X POST $API/auth/registro/ciudadano -H 'Content-Type: application/json' \
  -d '{"email":"ana@ejemplo.invalid","password":"UnaClaveLarga-2026","nombre_visible":"Ana Prueba","consentimiento":true}'

# 2. Login (cliente móvil: devuelve también el refresh token en el cuerpo)
curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -H 'X-Cliente: movil' \
  -d '{"email":"ana@ejemplo.invalid","password":"UnaClaveLarga-2026"}'

# 3. Usuario actual (reemplazar TOKEN por access_token)
curl -s $API/auth/yo -H "Authorization: Bearer $TOKEN"

# 4. Rotar el refresh token
curl -s -X POST $API/auth/refresh -H 'Content-Type: application/json' -H 'X-Cliente: movil' \
  -d "{\"refresh_token\":\"$REFRESH\"}"

# 5. Cerrar sesión
curl -s -X POST $API/auth/logout -H 'Content-Type: application/json' -d "{\"refresh_token\":\"$REFRESH\"}"
```

Casos inválidos:

```bash
# Sin consentimiento -> 422 validacion
curl -s -X POST $API/auth/registro/ciudadano -H 'Content-Type: application/json' \
  -d '{"email":"b@ejemplo.invalid","password":"UnaClaveLarga-2026","nombre_visible":"B Prueba","consentimiento":false}'

# Sin token -> 401 no_autenticado
curl -s -i $API/auth/yo

# Un ciudadano en /usuarios -> 403 prohibido
curl -s $API/usuarios -H "Authorization: Bearer $TOKEN"
```

## Pruebas automáticas relacionadas

`apps/backend/tests/test_auth.py` cubre estos flujos (registro con y sin consentimiento, contraseña corta, login, bloqueo con 429, rotación y reutilización del refresh, `/auth/yo` con y sin token, `/usuarios` con ciudadano y con admin).

---

# Fase 2 · Motor

Convenciones: las respuestas con cifras llevan `categoria` (`DATO OBSERVADO`, `DOCUMENTO DE REFERENCIA` o `SIMULADO`), `fuente` y `fecha_dato`. "Mandos" = `operador`, `decisor` o `admin`.

## Datos

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/estaciones` | público | Estaciones K3 con umbrales (`DATO OBSERVADO`) |
| GET | `/sectores` | público | Sectores K10 como GeoJSON (`SIMULADO`) |
| GET | `/accesos` | autenticado | Accesos como GeoJSON con `transitable`, `motivo`, `actualizado_por_rol` |
| PATCH | `/accesos/{id}` | mandos | Marca un acceso transitable o no: `{"transitable": false, "motivo": "..."}`. 404 si no existe |
| GET | `/centros` | autenticado | Centros de recepción con capacidad, ocupación y cupo libre (`SIMULADO`) |
| GET | `/serie/formosa?desde=&hasta=` | público | Serie diaria K1 (máximo del día), umbrales K3, picos 2016 y 2019, máximo y última lectura. No interpola huecos |
| GET | `/serie/ascenso?altura_actual_m=` | público | Velocidades de ascenso (2015-16, 2019, oct-2026), cruces, tasas m/día y **tiempo restante** a alerta, evacuación y cada compromiso K10 como rango (de la tasa más alta a la más baja). La proyección es lineal (`SUPUESTO`), no un pronóstico |

`GET /serie/ascenso` (extracto):

```json
{ "altura_actual_m": 5.6, "fecha_altura": "2026-10-31",
  "tasas_m_dia": { "2019: mayor suba diaria": 0.36, "oct-2026: promedio del mes": 0.1077 },
  "tiempo_restante": [ { "objetivo": "Alerta (K3)", "valor_m": 7.8, "dias_minimo": 6.1, "dias_maximo": 20.4, "ya_alcanzado": false } ],
  "supuesto": "Proyección lineal a tasa constante: es un SUPUESTO, no un pronóstico ...", "categoria_proyeccion": "SIMULADO" }
```

## Simulación (mandos)

### `POST /simulacion/escenario`

| Campo | Reglas |
|---|---|
| `altura_formosa_m` | 0 a 12 (si no, 422) |
| `lluvia_mm` | 0 o más (si no, 422); `lluvia_origen`: `simulado` (por defecto), `manual`, `parte_policial`, `planilla_upca` |
| `caminos_cerrados` | ids de `accesos`; uno inexistente responde **404** |
| `humedad_suelo` | opcional, 0 a 1 (solo para el ISAD) |

Respuesta para `{"altura_formosa_m": 7.6, "lluvia_mm": 40, "caminos_cerrados": []}` (resumen):

```json
{ "rio": { "estado": "normal", "altura_m": 7.6, "distancia_a_alerta_m": 0.2, "distancia_a_evacuacion_m": 0.7 },
  "sectores": [
    { "id": "S1", "estado": "en_riesgo", "aislado": false },
    { "id": "S2", "estado": "normal", "aislado": false },
    { "id": "S3", "estado": "en_riesgo", "aislado": false },
    { "id": "S4", "estado": "comprometido", "aislado": true,
      "accesos": [ { "superficie": "tierra", "estado": "intransitable_lluvia" } ],
      "isad": { "valor": 0.7, "categoria": "SIMULADO" } } ],
  "resumen": { "comprometidos": ["S4"], "en_riesgo": ["S1", "S3"], "normales": ["S2"], "aislados": ["S4"] },
  "categoria": "SIMULADO" }
```

Estados de acceso: `cerrado_operador`, `intransitable_lluvia` (tierra con 30 mm o más, ripio con 80 mm o más: supuestos), `anegado` (sector comprometido y acceso de tierra) y `transitable`. Un sector es `aislado` si ninguno de sus accesos es transitable. El `isad` es un índice relativo de 0 a 1, `SIMULADO`, que **no reemplaza** el criterio de compromiso de K10.

### `POST /simulacion/recomendacion`

Mismo cuerpo que el escenario más `prioridad` (`riesgo` o `poblacion`) y `sectores` (ids, opcional). Devuelve una **RECOMENDACIÓN, no una orden** (campo `etiqueta`). Por cada sector comprometido o en riesgo: población (K10 más familias registradas por `ST_Intersects`, con menores y mayores; no se descifran datos de salud), producción (establecimientos y stock agregado antes de unir, sin duplicar personas), ventana en días hasta el compromiso (rango, `SUPUESTO` lineal) y momento de inicio del traslado de ganado (24 a 48 h antes), vehículo y viajes, camiones jaula, asignación a centros con `personas_sin_lugar` y `animales_sin_cupo`, y cuadrillas sugeridas.

### `POST /simulacion/alternativas`

Mismo cuerpo que el escenario, más `editable` opcional: `{ "nombre", "orden_sectores": ["S1","S4"], "centros_excluidos": [1] }`. Devuelve tres alternativas (`riesgo`, `poblacion` y `editable`), cada una guardada en `alternativas` (`id`), y una `comparacion` lado a lado. Métricas: personas con lugar y sin lugar, animales con y sin cupo, viajes por tipo de vehículo, `tiempo_primer_sector_min` y `tiempo_total_min` (flota compartida, sectores en secuencia, velocidades `SUPUESTO`), `accesos_vulnerables_usados` y `faltantes` (vehículos, camiones jaula, cupos y roles frente a las plantillas de cuadrilla).

### `POST /ruteo`

```json
{ "perfil": "vehicular", "origen": { "lon": -58.139, "lat": -26.18 }, "destino": { "lon": -58.18, "lat": -26.185 },
  "altura_formosa_m": 7.6, "lluvia_mm": 0, "caminos_cerrados": [] }
```

`perfil`: `vehicular`, `camion_jaula` (solo pavimento y ripio) o `arreo` (penaliza los tramos dentro de sectores comprometidos). En lugar de `destino` se puede enviar `centro_id`. Con red cargada usa `pgr_dijkstra` (`"metodo": "pgrouting"`, con `geometria`, `tramos` y `capas`); las aristas bloqueadas se excluyen y, para los perfiles con ruedas, también las que cruzan sectores comprometidos (se exime el sector de origen y se advierte). Sin red, o si no hay ruta, devuelve `"metodo": "aproximado"`: distancia hasta el acceso transitable más cercano más la línea recta por el factor de desvío 1,3 (`SUPUESTO`), con `limitacion` explícita. Si el sector de origen no tiene un acceso utilizable para el perfil, `encontrada` es `false` y se indica el motivo. La superficie `desconocida` (OSM sin dato) cuesta como tierra y el camión jaula no la usa. La red se carga con `python -m app.ingest.red_vial [archivo.geojson]` (por defecto `data/geo/red_vial.geojson`).

## Producción

### `POST /ganaderia/calculo` (autenticado)

```json
{ "bovinos": [ {"categoria": "vaca preñada", "cantidad": 8}, {"categoria": "vaca con cría", "cantidad": 10},
               {"categoria": "ternero al pie", "cantidad": 10}, {"categoria": "vaquillona", "cantidad": 1}, {"categoria": "toro", "cantidad": 1} ],
  "otros": [ {"especie": "caprino", "cantidad": 20} ], "colmenas": { "vivas": 5, "muertas": 0, "traslado": "vehicular" },
  "superficie_albardon_m2": 200 }
```

Respuesta del caso de control: dormidero 150 m², 1 camión jaula con divisiones, ración diaria `maiz_kg` 58,4 y `pellet_girasol_kg` 5,5, lotes en destino de hasta 200 cabezas y checklist. Categoría bovina desconocida o cantidad negativa: 422. Todo `SIMULADO` (supuestos de INTA a verificar).

## Operación

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/cuadrillas` | mandos | Cuadrillas con integrantes, plantilla sugerida y `roles_faltantes` |
| POST | `/cuadrillas` | mandos | `{ "nombre", "tipo_incidente": "humana|ganadera|apicola", "integrantes": [{"rol_operativo"}] }` (201) |
| GET | `/tareas?estado=` | cuadrilla y mandos | La cuadrilla ve solo las de sus cuadrillas |
| PATCH | `/tareas/{id}` | cuadrilla y mandos | `estado` (`pendiente`, `en_curso`, `completada`; 409 si la transición no corresponde), `checklist`, `cuadrilla_id` (solo mandos) |
| POST | `/ordenes` | **solo `decisor`** (otro rol: 403) | `{ "tipo": "alerta|evacuacion_preventiva|evacuacion", "sectores": ["S4"], "fundamento": "...", "fecha_simulada": "2026-11-17" }` (201) |
| GET | `/ordenes` | autenticado | Mandos ven todas; ciudadanía y productores, las de su sector |
| GET | `/solicitudes` | ciudadanía y productores (las propias) y mandos | Filtros `estado`, `sector_id` |
| POST | `/solicitudes` | autenticado | `{ "tipo": "evacuacion|asistencia|ganado|logistica|otro", "personas", "animales", "lon", "lat", "texto" }` (201) |
| GET | `/solicitudes/{id}` | dueño o mandos | 404 si es ajena |
| PATCH | `/solicitudes/{id}` | mandos | Siguiente estado: `verificada`, `asignada` (con `cuadrilla_id` opcional, crea la tarea), `en_curso`, `resuelta`; saltar estados da 409 |

`POST /ordenes` registra al emisor (rol), crea notificaciones para quienes viven o producen en los sectores, tareas por cuadrilla (no en una simple `alerta`) y un **borrador** de bitácora K8; responde `{ "id", "notificaciones_creadas", "tareas_creadas", "bitacora_borrador_id", ... }`.

## Ciudadanía y productores (`/mi/*`)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET / PUT | `/mi/grupo-familiar` | ciudadano, productor | Grupo familiar y domicilio; teléfono, salud y vulnerabilidad se guardan cifrados y cada lectura queda auditada |
| GET / POST | `/mi/establecimientos` | productor | Lista y alta (tranquera, albardón, stock) |
| PUT | `/mi/establecimientos/{id}` | productor | Actualiza (404 si es de otro productor) |
| PUT | `/mi/establecimientos/{id}/stock` | productor | Reemplaza el stock |
| POST | `/mi/solicitudes-logistica` | productor | `{ "establecimiento_id", "texto" }`; adjunta el cálculo de Arca Productiva |
| GET | `/mi/sector` | autenticado | Sector propio con estado a la última altura observada, alertas y centro sugerido (`SIMULADO`) |
| GET | `/mi/notificaciones?solo_no_leidas=` | autenticado | Notificaciones propias |
| PATCH | `/mi/notificaciones/{id}/leida` | autenticado | Marca una notificación propia como leída |

## Lluvia

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/lluvia` | público | Lecturas con `origen`, `categoria` y `fuente`; `sin_dato_observado` indica si solo hay datos simulados. Filtros `desde`, `hasta`, `puesto`, `origen`, `limite` |
| GET | `/lluvia/puestos` | público | Puestos pluviométricos |
| POST | `/lluvia` | mandos | `{ "puesto": "PLUV-SIM-A", "fecha": "2026-11-16", "turno": "07", "mm": 12.5, "origen": "carga_manual" }`; `mm: null` = sin medición (no es 0) |
| POST | `/lluvia/importar-planilla` | mandos | `multipart/form-data`, campo `archivo` (.xlsx, 5 MB como máximo): hoja `CARGA DIARIA`, filas desde la 4 (A fecha, B estación, D mm). Celda vacía = sin medición; se guarda como turno `DI` |
| GET | `/lluvia/exportar?anio_hidrologico=2026&departamento=` | mandos | Excel con el formato de la hoja `CARGA DIARIA` (año hidrológico sep 2026 a ago 2027) |

Errores de `POST /lluvia`: mm fuera de 0 a 500, turno distinto de 07/17 o fecha futura (422); puesto inexistente (404); duplicado de puesto, fecha y turno (409). Un parte real posterior al corte (31/10/2026) se rechaza con 422 salvo `PERMITIR_DATOS_POST_CORTE`. La respuesta trae `advertencias` si el valor difiere más de 40 mm de la mediana de los puestos vecinos (a menos de 30 km).

## Centinela

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/verificador/k6` | público | Las 8 afirmaciones de K6 con veredicto y evidencia calculada desde K1/K3: refuta "10,7 m en 2016" (K1: 9,81 m) y "superó la evacuación en octubre" (máximo 5,60 m) |
| GET | `/verificador/k7` | público | Las 7 relaciones de K7. Las relaciones 3 y 6 se calculan con K3; las demás indican `verificado_con: requiere_cartografia` hasta contrastarlas con el IGN |
| GET | `/bitacora?estado=` | mandos | Entradas K8 |
| POST | `/bitacora` | `decisor` | Campos obligatorios: `decision`, `evidencia`, `limites`, `riesgos`, `gatillos` y `fecha_simulada`; `responsable_rol` por defecto es el rol operativo del usuario. Un campo vacío o ausente responde 422 |
| PATCH | `/bitacora/{id}` | `decisor` | Completa un borrador generado por una orden |
| GET | `/bitacora/{id}/export` | mandos | Markdown (`text/markdown`) |

## Canales simulados

`POST /canales/whatsapp-sim`, `/canales/sms-sim` y `/canales/ivr-sim`. Exigen la cabecera `X-Hub-Signature-256: sha256=<HMAC-SHA256 del cuerpo crudo con CANAL_HMAC_SECRET>` (401 si falta o no coincide; 503 si el secreto no está configurado).

- `whatsapp-sim`: payload de la Meta Cloud API (`entry[].changes[].value.messages[].text.body`).
- `sms-sim`: `{ "remitente": "+54...", "texto": "..." }`. `ivr-sim`: `{ "llamada_id": "...", "transcripcion": "..." }`.
- Mensajes: `LLUVIA <CODIGO_PUESTO> <MM>` (crea una lectura `simulado`; turno 07 si es antes del mediodía, si no 17) y `SOS-FSA|lat,lon|PERFIL|FAM:n|BOV:n(detalle)|ACC:texto|texto libre` (crea una solicitud con origen `*_sim`). Un mensaje mal formado o un puesto inexistente responde 422 y no se guarda ninguno de los mensajes del lote.

Para conectar la Meta Cloud API real: registrar la ruta como URL de webhook de la app de Meta, usar el secreto de la app como `CANAL_HMAC_SECRET` y agregar el `GET` de verificación (`hub.challenge`); el formato del payload y la firma son los mismos.

## Tiempo real

`WS /api/v1/ws`. El token de acceso **no** va en la URL: se envía como **primer mensaje** `{"token": "<access_token>"}` dentro de los 5 segundos siguientes a la conexión; si falta, es inválido o vence el plazo, el servidor cierra con el código **1008**. Luego el servidor envía `{"tipo": "conectado"}` y los eventos `{"tipo": "escenario|solicitud|orden|tarea", "datos": {...}}`: los mandos y la cuadrilla reciben todos; ciudadanía y productores reciben `orden` y sus propios `solicitud`.

## Ejemplos reproducibles (Fase 2)

Requisitos: backend en `http://localhost:8000` con migraciones y seed (usuarios de demostración, contraseña `DEMO_PASSWORD`).

```bash
API=http://localhost:8000/api/v1
login() { curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$1@demo.evacuaciones.invalid\",\"password\":\"$DEMO_PASSWORD\"}" \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])"; }
OP="Authorization: Bearer $(login operador)"
DEC="Authorization: Bearer $(login decisor)"
CIU="Authorization: Bearer $(login ciudadano1)"

# Escenario de CLAUDE.md §8.1: S4 comprometido y aislado; S1 y S3 en riesgo; S2 normal
curl -s -X POST $API/simulacion/escenario -H "$OP" -H 'Content-Type: application/json' \
  -d '{"altura_formosa_m":7.6,"lluvia_mm":40,"caminos_cerrados":[]}'

# Casos inválidos: altura fuera de 0 a 12 -> 422; acceso inexistente -> 404
curl -s -X POST $API/simulacion/escenario -H "$OP" -H 'Content-Type: application/json' -d '{"altura_formosa_m":13}'
curl -s -X POST $API/simulacion/escenario -H "$OP" -H 'Content-Type: application/json' -d '{"altura_formosa_m":7,"caminos_cerrados":[999999]}'

# Arca Productiva (caso de control: 150 m2, 1 camión, 58,4 kg de maíz, 5,5 kg de pellet)
curl -s -X POST $API/ganaderia/calculo -H "$OP" -H 'Content-Type: application/json' \
  -d '{"bovinos":[{"categoria":"vaca preñada","cantidad":8},{"categoria":"vaca con cría","cantidad":10},{"categoria":"ternero al pie","cantidad":10},{"categoria":"vaquillona","cantidad":1},{"categoria":"toro","cantidad":1}]}'

# Verificador de K6 (público)
curl -s $API/verificador/k6

# Un ciudadano intenta emitir una orden -> 403
curl -s -X POST $API/ordenes -H "$CIU" -H 'Content-Type: application/json' \
  -d '{"tipo":"alerta","sectores":["S4"],"fundamento":"Prueba de permisos del ciudadano."}'
# El decisor emite una evacuación preventiva para S4 (notificaciones, tareas y borrador de bitácora)
curl -s -X POST $API/ordenes -H "$DEC" -H 'Content-Type: application/json' \
  -d '{"tipo":"evacuacion_preventiva","sectores":["S4"],"fundamento":"Compromiso previsto de S4 antes de la alerta."}'

# Canal simulado: SMS de lluvia firmado con HMAC
CUERPO='{"remitente":"+5493700000001","texto":"LLUVIA PLUV-SIM-C 18,5"}'
FIRMA="sha256=$(printf '%s' "$CUERPO" | openssl dgst -sha256 -hmac "$CANAL_HMAC_SECRET" | sed 's/^.* //')"
curl -s -X POST $API/canales/sms-sim -H "X-Hub-Signature-256: $FIRMA" -H 'Content-Type: application/json' -d "$CUERPO"
# Con el texto "LLUVIA PLUV-SIM-C" (sin mm) y su propia firma -> 422
```

Pruebas automáticas: `tests/test_escenario.py`, `test_recomendacion.py`, `test_ruteo.py`, `test_ganaderia_y_parser.py`, `test_lluvia_y_canales.py`, `test_operacion.py` y `test_seguridad_fase2.py`.
