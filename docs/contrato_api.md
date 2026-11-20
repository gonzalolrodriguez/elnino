# Contrato API · Plataforma de Gestión de Evacuaciones

> PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial

Prefijo: `/api/v1`. Documentación interactiva generada por FastAPI en `/docs` y esquema en `/openapi.json`. Este documento cubre la API completa de la entrega (Fases 0 a 5): meta, autenticación, usuarios, datos, simulación, producción, operación, ciudadanía y productores, solicitudes con adjuntos, lluvia, Centinela, canales simulados y tiempo real. El esquema OpenAPI exportado de la aplicación está en `docs/openapi.json` (regenerarlo con el comando de la sección "Regenerar el esquema OpenAPI", al final).

## Convenciones

- Formato JSON en UTF-8. Autenticación con `Authorization: Bearer <access_token>`.
- Cliente móvil: enviar `X-Cliente: movil` en login y refresh para recibir también el `refresh_token` en el cuerpo. La web lo recibe solo en una cookie `HttpOnly`.
- Las respuestas con datos incluirán `categoria`, `fuente` y `fecha_dato` cuando corresponda (grupos de datos; ver cada sección).

### Códigos del sobre de error

`400 solicitud_invalida`, `401 no_autenticado`, `403 prohibido`, `404 no_encontrado` (conserva el mensaje propio, p. ej. `Solicitud no encontrada`), `405`, `409 conflicto`, `413 cuerpo_demasiado_grande` (tope global 1 MB; adjuntos y planilla tienen el suyo), `415 tipo_no_soportado`, `422 validacion`, `429 demasiados_intentos` (siempre con `Retry-After`), `500 error_interno` (sin trazas) y `503 no_disponible` (p. ej. sin lecturas del río cargadas).

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

## Tableros de decisión (nuevos)

### `GET /panel/resumen` (`operador`, `decisor`, `admin`)

Un solo llamado con los indicadores de decisión. Cada bloque lleva `categoria`, `fuente` y `fecha_dato`.

```json
{
  "generado_en": "...", "leyenda": "PROTOTIPO · ...",
  "rio": { "categoria": "DATO OBSERVADO", "fuente": "...", "fecha_dato": "2026-10-31", "disponible": true,
    "altura_m": 5.6, "fecha_lectura": "2026-10-31", "umbral_alerta_m": 7.8, "umbral_evacuacion_m": 8.3,
    "distancia_a_alerta_m": 2.2, "distancia_a_evacuacion_m": 2.7,
    "tendencia_7d_m": 1.5, "tendencia_7d_m_por_dia": 0.214,
    "tiempo_a_umbrales": [ { "objetivo": "Alerta", "valor_m": 7.8, "ya_alcanzado": false, "dias_minimo": 6.1, "dias_maximo": 20.4 } ],
    "supuesto_proyeccion": "...", "categoria_proyeccion": "SIMULADO" },
  "sectores": { "categoria": "SIMULADO", "fuente": "...", "fecha_dato": "...", "altura_usada_m": 5.6,
    "items": [ { "id": "S4", "nombre": "...", "estado": "normal|en_riesgo|comprometido", "aislado": false,
      "margen_a_compromiso_m": 1.9, "altura_compromiso_m": 7.5, "personas_k10": 150, "personas_registradas": 0,
      "familias_registradas": 0, "animales_expuestos": 0, "colmenas": 0,
      "accesos": [ { "nombre": "...", "superficie": "tierra", "estado": "transitable" } ],
      "centro_sugerido": { "personas": { "id", "nombre", "tipo", "distancia_linea_recta_m", "...": "..." } | null, "animales": { } | null, "nota": "..." } } ] },
  "solicitudes": { "categoria", "fuente", "fecha_dato", "total": 0, "por_estado": {}, "por_sector": {}, "por_origen": {},
    "recibidas_mas_antigua_min": null, "a_verificar": 0 },
  "centros": { "categoria", "fuente", "fecha_dato", "items": [ { "id", "nombre", "tipo", "capacidad_personas", "capacidad_animales", "ocupacion", "ocupacion_pct" } ] },
  "cuadrillas": { "categoria", "fuente", "fecha_dato", "tareas_sin_cuadrilla": 0,
    "items": [ { "id", "nombre", "tipo_incidente", "estado", "tareas": { "pendiente": 0, "en_curso": 0, "completada": 0, "cancelada": 0 } } ] },
  "ordenes": { "categoria", "fuente", "fecha_dato", "bitacora_borradores": 0,
    "recientes": [ { "id", "tipo", "sectores", "emitida_por_rol", "creada_en" } ] },
  "evacuaciones": { "categoria": "SIMULADO", "fuente", "fecha_dato", "total": 0,
    "por_estado": { "pendiente": 0, "en_curso": 0, "cerrada_cuadrilla": 0, "verificada": 0, "con_discrepancia": 0 },
    "por_sector": { "S4": { "pendiente": 0, "en_curso": 0, "cerrada_cuadrilla": 0, "verificada": 0, "con_discrepancia": 0 } },
    "verificadas_pct": 0.0, "discrepancias_abiertas": 0, "personas_trasladadas": 0,
    "animales_trasladados": { "bovinos": 0 }, "animales_trasladados_total": 0, "distancia_max_destino_m": 500 },
  "lluvia_7d": { "categoria", "fuente", "fecha_dato", "desde": "...", "sin_dato_observado": true,
    "por_origen": { "simulado": { "lecturas": 0, "mm_total": 0.0, "sin_medicion": 0, "categoria": "SIMULADO" } } },
  "frescura": { "rio_ultima_lectura", "k10_sectores", "lluvia_ultima_lectura", "fecha_corte": "2026-10-31" },
  "categoria": "SIMULADO", "fuente": "...", "fecha_dato": "..."
}
```

Sin lecturas del río cargadas, `rio.disponible` es `false` y los sectores se calculan con altura 0. Cada lectura queda auditada.

### `GET /admin/resumen` (`admin`)

```json
{
  "generado_en": "...",
  "usuarios": { "total": 0, "por_rol": {}, "por_estado": {}, "sin_login_30_dias": 0, "cuentas_bloqueadas": 0,
    "intentos_fallidos_en_curso": 0, "bloqueos": [ { "usuario_id": 1, "ip": "...", "bloqueado_hasta": "..." } ] },
  "auditoria": { "cadena_integra": true, "primera_fila_inconsistente": null, "filas": 0 },
  "servicio": { "base_de_datos": "ok", "websockets_activos": 0, "version": "0.1.0" },
  "categoria": "SIMULADO", "fuente": "...", "fecha_dato": "..."
}
```

`GET /usuarios` (admin) suma `intentos_fallidos` y `bloqueado_hasta` a cada usuario.

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
- **401 genérico** (`Correo o contraseña incorrectos`) para correo inexistente, contraseña errónea, cuenta inactiva o bloqueada: no se distingue ninguno de esos casos (sin enumeración de cuentas). El bloqueo por par cuenta+IP (5 fallos, 15 minutos; IPv6 por /64) y el límite por cuenta (20 fallos en 15 minutos desde redes sin login previo en 30 días) siguen activos pero responden también 401. El **429** sale solo del limitador por IP (`RATE_LIMIT_LOGIN`, `RATE_LIMIT_REGISTRO`) y trae `Retry-After` (segundos).

### `POST /auth/refresh`

El token se toma del cuerpo `{ "refresh_token": "..." }` (móvil) o de la cookie (web; sin cuerpo). Devuelve una sesión nueva con el mismo formato que el login y **rota** el refresh token. **Gracia de un solo uso:** si la respuesta se perdió, el mismo token rotado puede reintentarse **una vez** en los 30 s siguientes, desde el mismo `X-Cliente` y la misma red; el relevo reemplaza al sucesor (una sola sesión viva por familia). Cualquier otra reutilización de un token ya usado o cerrado devuelve 401 y revoca toda la familia.

### `POST /auth/logout`

Mismo origen del token que `refresh`. Revoca la familia de sesiones y borra la cookie. Cierra también los WebSockets del usuario. Siempre 200 `{ "mensaje": "Sesión cerrada" }` (idempotente).

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
| GET | `/roles-operativos` | autenticado | Catálogo de roles operativos `{ "roles": [{ "codigo", "nombre", "descripcion" }] }` (`SIMULADO`, sin nombres de personas). Lo usa el panel de administración (Fase 3) |
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

Mismo cuerpo que el escenario más `prioridad` (`riesgo` o `poblacion`), `sectores` (ids, opcional) y `pronostico_lluvia` (opcional, `SIMULADO`): `{ "mm": 100, "horas": 6 }` (`mm` mayor que 0 y hasta 1000, que se suman a la lluvia del escenario; `horas` mayor que 0 y hasta 720; un campo de más, ausente o fuera de rango da 422). Devuelve una **RECOMENDACIÓN, no una orden** (campo `etiqueta`). Por cada sector comprometido o en riesgo: población (K10 más familias registradas por `ST_Intersects`, con menores y mayores; no se descifran datos de salud), producción (establecimientos y stock agregado antes de unir, sin duplicar personas), ventana en días hasta el compromiso (rango, `SUPUESTO` lineal) y momento de inicio del traslado de ganado (24 a 48 h antes), vehículo y viajes, camiones jaula, asignación a centros con `personas_sin_lugar` y `animales_sin_cupo`, y cuadrillas sugeridas.

Cómo se arma el plan:

- **Centros:** se descartan los que quedan dentro de un sector comprometido y, con el supuesto `centro_excluir_en_riesgo`, de uno en riesgo. Van en `centros_descartados` (`id`, `nombre`, `motivo`).
- **Tiempos de viaje:** por la red vial real (OpenStreetMap, `pgr_dijkstraCost` de cada sector a cada centro, con las reglas de `POST /ruteo`, incluida la lluvia). Si no hay red o ruta, línea recta × factor de desvío 1,3 a la velocidad de la superficie del acceso; un sector aislado sale en lancha (línea recta). El método va en `metodo_tiempo` de cada asignación (`red_vial`, `aproximado`, `lancha_linea_recta`, `arreo_aproximado`) y en `metricas.metodo_tiempos`.
- **Reparto:** flujo de costo mínimo. Respeta el orden de prioridad (un sector de mayor prioridad nunca queda sin lugar para dárselo a uno de menor) y, con eso fijo, minimiza personas × minutos de viaje (`metricas.personas_minuto`).
- **Familias indivisibles:** el flujo fija cuántos lugares de cada centro le tocan a cada sector. Dentro de cada sector, cada familia va entera al centro más rápido cuyo cupo la contiene: primero las que tienen menores o mayores, después las más grandes. Si no entra entera en ningún centro, se informa y **no se la separa**. Los viajes se cuentan sin repartir una familia entre viajes distintos. Las familias registradas siempre cuentan como unidad. Con `poblacion_k10_en_hogares: true` (opcional, por defecto `false`), la población de K10 se toma del set separado de hogares SIMULADOS (`data/simulado/hogares_k10.json`, tamaños `SUPUESTO`). Cada sector trae `familias` (`registradas`, `hogares_simulados`, `personas_en_familias`, `juntas`, `sin_lugar_entero`, `personas_en_familias_sin_lugar`, `tamanos_sin_lugar`). No se exponen identificadores de familias.
- **Flota:** cada tipo de vehículo tiene su línea de tiempo. Los sectores que usan el mismo tipo van en secuencia (en el orden de la alternativa) y los que usan tipos distintos, en paralelo. `traslado_personas` trae `tiempo_inicio_min`, `tiempo_para_completar_min` y `tiempo_acumulado_min` (minuto en que el sector termina, contado desde la orden). `traslado_ganado` hace lo mismo con los camiones jaula.

**Factibilidad** (`factibilidad.personas` y, si hay bovinos, `factibilidad.ganado`, `SIMULADO`):

```json
{ "veredicto": "justo", "plazo_minimo_h": 33.6, "plazo_maximo_h": 110.4, "limitante": "rio",
  "tiempo_para_completar_h": 30.0, "holgura_h": 3.6, "iniciar_antes_de_h": 3.6,
  "explicacion": "Termina en 30.0 h: no entra con holgura en el plazo más corto (33.6 h) pero sí en el más largo (110.4 h). ..." }
```

- Plazo del río: horas hasta la altura de compromiso con la tasa de ascenso más rápida (`plazo_minimo_h`) y la más lenta (`plazo_maximo_h`) observadas en K1 (proyección lineal, `SUPUESTO`).
- Ventana seca: si `pronostico_lluvia` deja intransitable el acceso que usa el sector (tierra desde 30 mm, ripio desde 80 mm), el plazo es `horas` y `limitante` pasa a `ventana_seca`.
- Veredictos: `alcanza` (termina dentro del plazo mínimo y deja libre al menos `margen_seguridad_fraccion`, 25 %, `SUPUESTO`), `justo` (entra en el plazo máximo pero no con esa holgura en el mínimo), `no_alcanza`, `ya_comprometido` (el sector ya alcanzó su altura: emergencia) y `sin_estimacion` (sin flota o sin plazo).
- Ganado: el plazo se adelanta 48 h (extremo conservador de la anticipación de 24 a 48 h).

Métricas nuevas en `metricas`: `sectores_no_alcanzan`, `sectores_justos`, `sectores_ya_comprometidos`, `veredictos`, `metodo_tiempos`, `personas_minuto`, `familias_juntas`, `familias_sin_lugar_entero` y `personas_en_familias_sin_lugar`.

### `POST /simulacion/alternativas`

Mismo cuerpo que el escenario, más `editable` opcional: `{ "nombre", "orden_sectores": ["S1","S4"], "centros_excluidos": [1] }` y `pronostico_lluvia` y `poblacion_k10_en_hogares` opcionales (como en la recomendación). Devuelve tres alternativas (`riesgo`, `poblacion` y `editable`), cada una guardada en `alternativas` (`id`), y una `comparacion` lado a lado. Cada alternativa tiene la misma forma que `recomendacion` (incluida la factibilidad por sector). Métricas comparadas: personas con lugar y sin lugar, animales con y sin cupo, viajes por tipo de vehículo, `tiempo_primer_sector_min` y `tiempo_total_min` (cada tipo de vehículo en secuencia, tipos en paralelo, velocidades `SUPUESTO`), `accesos_vulnerables_usados`, `sectores_no_alcanzan`, `sectores_justos`, `personas_minuto`, `familias_juntas`, `familias_sin_lugar_entero` y `faltantes` (vehículos, camiones jaula, cupos y roles frente a las plantillas de cuadrilla).

### `POST /ruteo`

```json
{ "perfil": "vehicular", "origen": { "lon": -58.139, "lat": -26.18 }, "destino": { "lon": -58.18, "lat": -26.185 },
  "altura_formosa_m": 7.6, "lluvia_mm": 0, "caminos_cerrados": [] }
```

`perfil`: `vehicular`, `camion_jaula` (solo pavimento y ripio) o `arreo` (penaliza los tramos dentro de sectores comprometidos). En lugar de `destino` se puede enviar `centro_id`. Con red cargada usa `pgr_dijkstra` (`"metodo": "pgrouting"`, con `geometria`, `tramos` y `capas`); las aristas bloqueadas se excluyen y, para los perfiles con ruedas, también las que cruzan sectores comprometidos (se exime el sector de origen y se advierte). Sin red, o si no hay ruta, devuelve `"metodo": "aproximado"`: distancia hasta el acceso transitable más cercano más la línea recta por el factor de desvío 1,3 (`SUPUESTO`), con `limitacion` explícita. Si el sector de origen no tiene un acceso utilizable para el perfil, `encontrada` es `false` y se indica el motivo. La superficie `desconocida` (OSM sin dato) cuesta como tierra y el camión jaula no la usa. Con lluvia, los perfiles con ruedas pierden los tramos de tierra y superficie desconocida (desde 30 mm) y de ripio (desde 80 mm), igual que los accesos de los sectores; la respuesta lo indica en `superficies_cerradas_por_lluvia`. El arreo no depende de la lluvia. El origen y el destino se enganchan al nodo más cercano que toca un tramo firme y usable (o, si no hay, cualquier tramo usable) siempre que no quede a más de `ruteo_enganche_usable_m` (500 m, `SUPUESTO`) por encima del nodo más cercano. `docker compose` carga `data/geo/red_vial.geojson` al arrancar si la tabla está vacía; a mano: `python -m app.ingest.red_vial [archivo.geojson] [--si-vacia]`.

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
| POST | `/cuadrillas` | mandos | `{ "nombre", "tipo_incidente": "humana|ganadera|apicola", "vehiculo"?: "4x4|camion_jaula|colectivo|lancha|moto", "integrantes": [{"rol_operativo"}] }` (201). `vehiculo` es opcional y `SIMULADO` (otro valor: 422); `GET /cuadrillas` lo devuelve (`null` si no tiene) |
| GET | `/tareas?estado=&limite=&offset=` | cuadrilla y mandos | La cuadrilla ve solo las de sus cuadrillas. Responde `{ "tareas", "total", "limite", "offset" }`; cada tarea trae `requiere_atencion` (bool) y `ultimo_parte` (parte o `null`, ver "Partes de las cuadrillas y panel de cuadrillas") |
| PATCH | `/tareas/{id}` | cuadrilla y mandos | `estado` (`pendiente`, `en_curso`, `completada`; 409 si la transición no corresponde), `checklist` (lista de `{ "item": texto 1-200, "hecho": boolean }`, `item` obligatorio, máx. 50), `cuadrilla_id` (solo mandos). La cuadrilla pasa a `ocupada` mientras tenga tareas abiertas y vuelve a `disponible` al cerrar la última. Si un operador (no la cuadrilla) cambia el `estado` o reasigna la tarea, se limpia `requiere_atencion`. La respuesta incluye `requiere_atencion` y `ultimo_parte` |
| POST | `/ordenes` | **solo `decisor`** (otro rol: 403) | `{ "tipo": "alerta|evacuacion_preventiva|evacuacion", "sectores": ["S4"], "fundamento": "...", "fecha_simulada": "2026-11-17" }` (201). **Idempotente** con `Idempotency-Key: <UUID>` (mismo decisor y clave: 200 con la orden original y `"repetida": true`, sin duplicar notificaciones ni tareas). Las tareas se reparten entre las cuadrillas del tipo con menos tareas abiertas |
| GET | `/ordenes` | autenticado | Mandos ven todas; ciudadanía y productores, las de su sector |
| GET | `/solicitudes` | ciudadanía y productores (las propias) y mandos | Filtros `estado`, `sector_id`; paginación `limite` (100, máx. 500) y `offset`; responde `{ "solicitudes", "total", "limite", "offset" }` |
| POST | `/solicitudes` | autenticado | `{ "tipo": "evacuacion|asistencia|ganado|logistica|otro", "personas", "animales", "lon", "lat", "texto", "referencia_ubicacion" }` (201). Hace falta **coordenadas (`lon` y `lat`, juntas) o `referencia_ubicacion`** (paraje, camino o ruta; se recorta y admite hasta 200 caracteres); ninguna de las dos, una sola coordenada o una referencia demasiado larga dan 422. Sin coordenadas el pedido queda con `ubicacion_aproximada` y `requiere_verificacion` en `true` y sin sector (lo verifica el operador); con ambas se guardan las dos. **Idempotente** con la cabecera opcional `Idempotency-Key: <UUID>`: el mismo usuario y la misma clave (sin límite de tiempo: índice único parcial + `ON CONFLICT`) devuelven la solicitud original con **200** (clave que no es UUID: 422). **Cuota blanda:** `SOLICITUDES_MAX_POR_HORA` (20) por persona; al superarla, 429 con mensaje en español y `Retry-After` (los reintentos idempotentes no cuentan). La respuesta incluye `ubicacion_aproximada`, `referencia_ubicacion` y `requiere_verificacion` (siempre presentes; `false`/`null` en los pedidos con coordenadas de la app) |
| GET | `/solicitudes/{id}` | dueño o mandos | 404 si es ajena. Incluye `adjuntos: [{ "n", "mime", "bytes" }]` |
| POST | `/solicitudes/{id}/adjuntos` | dueño o mandos | `multipart/form-data`, campo `archivo`: imagen `image/jpeg`, `image/png` o `image/webp` (segundo tiempo del envío: primero el JSON mínimo, después la foto). Se valida el **contenido** (firma del archivo) además del `Content-Type`: tipo no permitido o contenido que no es imagen → 415; vacío → 422; más de `ADJUNTO_MAX_BYTES` (2 MB por defecto) → 413; más de `ADJUNTOS_MAX_POR_SOLICITUD` (5) → 409; solicitud ajena → 404. Responde 201 `{ "n", "mime", "bytes", "solicitud_id" }`; la misma foto reenviada (SHA-256 repetido) responde 200 con el `n` original y `"duplicado": true`; tope de almacenamiento por persona `ADJUNTOS_MAX_BYTES_POR_USUARIO` (413). Se guarda en `ADJUNTOS_DIR` (por defecto `<raíz>/uploads/`, fuera de `data/` e ignorada por git) con nombre generado por el servidor; los metadatos van en `solicitudes_asistencia.adjuntos` |
| GET | `/solicitudes/{id}/adjuntos/{n}` | dueño o mandos | Devuelve los bytes de la imagen con su `Content-Type`, `Cache-Control: private, no-store` y `X-Content-Type-Options: nosniff`. Cada lectura queda auditada. 404 si la solicitud es ajena o el adjunto no existe |
| PATCH | `/solicitudes/{id}` | mandos | Siguiente estado: `verificada`, `asignada` (con `cuadrilla_id` opcional, crea la tarea), `en_curso`, `resuelta`; saltar estados da 409 |

`POST /ordenes` registra al emisor (rol), crea notificaciones para quienes viven o producen en los sectores, tareas por cuadrilla (no en una simple `alerta`) y un **borrador** de bitácora K8; responde `{ "id", "notificaciones_creadas", "tareas_creadas", "bitacora_borrador_id", ... }`.

## Partes de las cuadrillas y panel de cuadrillas

La cuadrilla informa al sistema cómo va cada tarea con **partes**: `avance`, `dificultad` o `resultado`. El autor figura por su **rol operativo** (`autor_rol`), nunca por nombre. Todo es `SIMULADO` en la demo. Estos endpoints llevan el mismo tope por persona que `/mi/*` (`RATE_LIMIT_USUARIO`, 429 con `Retry-After`).

Parte (`ParteTarea`):

```json
{ "id": 7, "tarea_id": 12, "cuadrilla_id": 1, "tipo": "dificultad", "resultado": null,
  "observacion": "El camino de tierra hacia el cargadero está anegado.",
  "autor_rol": "encargado_cuadrilla", "creado_en": "2026-11-20T21:14:09.512847+00:00", "resuelta": false }
```

- `tipo`: `avance | dificultad | resultado`. `resultado` solo se informa con `tipo=resultado` (`completa | parcial | no_realizada | reprogramada`); en otro tipo: 422.
- `observacion`: de 3 a 1000 caracteres; **obligatoria** si `tipo` es `dificultad` o si es `resultado` distinto de `completa` (422). En `avance` y en `completa` es opcional.
- `resuelta`: solo en `dificultad` (nace en `false`); en los demás tipos es `null`.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/tareas/{id}/partes` | `cuadrilla`, solo integrantes de la cuadrilla de esa tarea | `{ "tipo", "resultado"?, "observacion"? }` (cuerpo estricto: un campo extra da 422). 201 con el parte. **Idempotente** con la cabecera opcional `Idempotency-Key: <UUID>` (cola sin conexión de la app): el mismo usuario y la misma clave devuelven el parte original con **200**, sin duplicarlo ni repetir sus efectos (la misma clave en otra tarea: 409; clave que no es UUID: 422). Otra cuadrilla, mandos o ciudadanía: 403; tarea inexistente: 404; tarea `completada` o `cancelada`: 409 |
| GET | `/tareas/{id}/partes` | mandos e integrantes de esa cuadrilla | `{ "items": [parte...] }`, más nuevo primero (máx. 200). Otra cuadrilla o ciudadanía: 403 |
| PATCH | `/partes/{id}` | mandos | `{ "resuelta": true }`: marca la dificultad como resuelta (otro tipo de parte: 409; `false` u otro campo: 422) |
| GET | `/partes/recientes?limite=20` | mandos | `{ "items": [parte + { "sector_id", "solicitud_id", "cuadrilla_nombre", "tarea_estado" }] }` (`limite` 1 a 100). Primero lo que pide atención (dificultades sin resolver y resultados no completos de tareas con `requiere_atencion`), después por fecha |
| GET | `/cuadrillas/resumen` | mandos | Cuadrillas con sus designados, la tarea actual y el último parte (abajo) |
| POST | `/cuadrillas/{id}/integrantes` | `operador`, `admin` | `{ "usuario_id", "rol_operativo" }` (201 con el ítem de resumen de la cuadrilla). Solo usuarios **activos con rol `cuadrilla`** y roles del catálogo (422); ya integrante: 409; cuadrilla inexistente: 404. Si la cuadrilla tiene una vacante sin persona con ese rol, se cubre |
| DELETE | `/cuadrillas/{id}/integrantes/{usuario_id}` | `operador`, `admin` | Quita al integrante; 200 con el ítem de resumen actualizado; 404 si no integraba la cuadrilla |

**Efectos sobre la tarea**

| Parte | Efecto |
|---|---|
| `resultado=completa` | La tarea pasa a `completada` y se limpia `requiere_atencion`. Si la tarea es de evacuación (nace de una orden o de un pedido `evacuacion`/`ganado`) responde **409** `"Cerrá la tarea con constancia"`: se cierra con `POST /tareas/{id}/cierre`, que además deja su propio parte `resultado=completa` |
| `parcial`, `no_realizada`, `reprogramada` | La tarea vuelve a `pendiente` con `requiere_atencion=true`; si el pedido figuraba `en_curso` o `resuelta`, vuelve a `asignada` |
| `avance`, `dificultad` | No cambian el estado de la tarea |

`requiere_atencion` se limpia cuando un operador cambia el estado o reasigna la tarea (`PATCH /tareas/{id}`), o cuando llega un parte `completa`.

`GET /cuadrillas/resumen` devuelve `{ "items": [...] }`, un ítem por cuadrilla (sin nombres de personas, solo `usuario_id` y rol operativo):

```json
{ "id": 1, "nombre": "Cuadrilla humana SIMULADA 1", "tipo_incidente": "humana", "vehiculo": "4x4",
  "estado": "ocupada",
  "integrantes": [
    { "usuario_id": 4, "rol_operativo": "encargado_cuadrilla", "es_encargado": true },
    { "usuario_id": null, "rol_operativo": "sipec", "es_encargado": false } ],
  "tarea_actual": { "id": 12, "estado": "pendiente", "solicitud_id": null, "sector_id": "S4", "requiere_atencion": true },
  "ultimo_parte": { "id": 8, "tarea_id": 12, "cuadrilla_id": 1, "tipo": "resultado", "resultado": "parcial",
    "observacion": "Se trasladaron dos de tres familias; la tercera quedó pendiente por el acceso.",
    "autor_rol": "encargado_cuadrilla", "creado_en": "2026-11-20T21:14:09.512847+00:00", "resuelta": null },
  "dificultades_abiertas": 0 }
```

`tarea_actual` es la tarea abierta más relevante (en curso, luego las que requieren atención, luego la última) o `null`. `usuario_id: null` es un rol del catálogo todavía sin persona designada.

**Mis pedidos:** cada ítem de `GET /mi/pedidos` agrega `"novedad": null | { "tipo": "demora|dificultad|parcial|no_realizada|reprogramada", "en": "<ISO>" }`: la última novedad relevante, **sin el texto de la observación**. `dificultad` mientras no esté resuelta; `parcial`/`no_realizada`/`reprogramada` mientras la tarea siga con `requiere_atencion`; `demora` cuando la tarea está en curso y la última posición compartida venció (`posicion_vencida_minutos`). Los avances no se informan a la ciudadanía.

**Tiempo real:** el evento `parte_tarea` `{ "tarea_id", "cuadrilla_id", "tipo", "resultado" }` llega solo a `operador`, `decisor` y `admin` (nunca la observación; el panel la consulta con `GET /partes/recientes`). Se emite al crear un parte, al resolver una dificultad y al cerrar con constancia.

Auditoría: `parte_tarea_creado`, `parte_tarea_resuelto`, `cuadrilla_integrante_agregado` y `cuadrilla_integrante_quitado` quedan en la bitácora de accesos (el detalle del parte guarda solo `tipo[:resultado]`, no la observación).

```bash
# La cuadrilla informa una dificultad en su tarea 12 (H_CUADRILLA = cabecera Authorization de un integrante)
curl -s -X POST $API/tareas/12/partes -H "$H_CUADRILLA" -H 'Content-Type: application/json' \
  -d '{"tipo":"dificultad","observacion":"El camino de tierra hacia el cargadero está anegado."}'

# Reintento seguro desde la cola sin conexión: misma Idempotency-Key -> 200 con el parte original
curl -s -X POST $API/tareas/12/partes -H "$H_CUADRILLA" -H "Idempotency-Key: $(uuidgen)" -H 'Content-Type: application/json' \
  -d '{"tipo":"avance","observacion":"En camino"}'

# Resultado parcial: la tarea vuelve a pendiente y queda con requiere_atencion
curl -s -X POST $API/tareas/12/partes -H "$H_CUADRILLA" -H 'Content-Type: application/json' \
  -d '{"tipo":"resultado","resultado":"parcial","observacion":"Quedó una familia sin trasladar."}'

# El operador ve lo que pide atención, resuelve la dificultad y mira el panel de cuadrillas
curl -s "$API/partes/recientes?limite=20" -H "$H_OPERADOR"
curl -s -X PATCH $API/partes/7 -H "$H_OPERADOR" -H 'Content-Type: application/json' -d '{"resuelta":true}'
curl -s $API/cuadrillas/resumen -H "$H_OPERADOR"

# Designar a un usuario con rol cuadrilla (cubre la vacante del rol si existe) y quitarlo
curl -s -X POST $API/cuadrillas/1/integrantes -H "$H_OPERADOR" -H 'Content-Type: application/json' \
  -d '{"usuario_id":9,"rol_operativo":"sipec"}'
curl -s -X DELETE $API/cuadrillas/1/integrantes/9 -H "$H_OPERADOR"

# Casos inválidos: dificultad sin observación -> 422; completa en una tarea de evacuación -> 409 "Cerrá la tarea con constancia";
# parte de una cuadrilla ajena o de un ciudadano -> 403; tarea inexistente -> 404; PATCH de un avance -> 409
```

Prueba automática: `tests/test_partes.py`.

## Ciudadanía y productores (`/mi/*`)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET / PUT | `/mi/grupo-familiar` | ciudadano, productor | Grupo familiar y domicilio; teléfono, salud y vulnerabilidad se guardan cifrados y cada lectura queda auditada |
| GET / POST | `/mi/establecimientos` | productor | Lista y alta (tranquera, albardón, stock) |
| PUT | `/mi/establecimientos/{id}` | productor | Actualiza (404 si es de otro productor) |
| PUT | `/mi/establecimientos/{id}/stock` | productor | Reemplaza el stock |
| POST | `/mi/solicitudes-logistica` | productor | `{ "establecimiento_id", "texto" }`; adjunta el cálculo de Arca Productiva |
| GET | `/mi/sector` | autenticado | Sector propio con estado a la última altura observada, alertas y centro sugerido (`SIMULADO`). Cada sector trae `geometria` (GeoJSON `Polygon`, EPSG:4326, K10 sin cambios) y cada centro sugerido (`centro_asignado.personas` y `.animales`) trae `lon` y `lat` además de la distancia en línea recta |
| GET | `/mi/notificaciones?solo_no_leidas=` | autenticado | Notificaciones propias. Cada una trae `tipo` (`orden`, `confirmacion_evacuacion` o `discrepancia`) y `datos` (objeto o `null`; ver "Constancias de evacuación") |
| GET | `/mi/confirmaciones` | ciudadanía y productores | Consultas de confirmación propias (`pendientes`; por ítem `id`, `tarea_id`, `solicitud_id`, `codigo`, `centro_nombre`, `respondida`, `respuesta`, `comentario`, `solicitada_en`, `respondida_en`); nunca ubicaciones |
| POST | `/mi/confirmaciones` | ciudadanía y productores | Responde la consulta del traslado (ver "Constancias de evacuación") |
| PATCH | `/mi/notificaciones/{id}/leida` | autenticado | Marca una notificación propia como leída |

## Constancias de evacuación y confirmación del evacuado

Una **evacuación** es una tarea de cuadrilla (de una orden o de una solicitud asignada). La cuadrilla la cierra con una **constancia** (destino GPS, centro, personas, animales, nota y fotos) y el evacuado puede confirmarla. Todo es `SIMULADO`. El estado se **deriva**, no se guarda:

| Estado | Cuándo |
|---|---|
| `pendiente`, `en_curso` | La tarea no se cerró |
| `cerrada_cuadrilla` | Cerrada con constancia, sin respuesta del evacuado (no bloquea) |
| `verificada` | El evacuado respondió `si` y el destino está a menos de `distancia_max_destino_m` (SUPUESTO: 500 m, en `supuestos.yaml`) del centro elegido |
| `con_discrepancia` | El evacuado respondió `no` o `problema`, o el destino queda a más de `distancia_max_destino_m` del centro. Es una **marca para revisar, no una acusación**; avisa a los operadores (notificación `discrepancia`) |

Las tareas canceladas no cuentan como evacuaciones. Una tarea cerrada por `PATCH /tareas/{id}` con `completada` (sin constancia) figura como `cerrada_cuadrilla` con `constancia: null`.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/tareas/{id}/cierre` | cuadrilla de la tarea u `operador` | Cierra con constancia. **Requiere** `Idempotency-Key: <UUID>` (falta o no es UUID: 422). 201 la primera vez; el reintento con la misma clave: 200 con `"repetida": true`; otra clave sobre una tarea ya cerrada, o la misma clave sobre otra tarea: 409. Tarea cancelada: 409. Cuadrilla ajena: 403. Tarea inexistente: 404 |
| POST | `/tareas/{id}/cierre/adjuntos` | cuadrilla de la tarea u `operador` | `multipart/form-data`, campo `archivo` (JPEG, PNG o WebP). Mismas reglas que los adjuntos de solicitudes (firma del contenido, `ADJUNTO_MAX_BYTES`, máximo `ADJUNTOS_MAX_POR_SOLICITUD` por constancia: 409; sin constancia: 404; SHA-256 repetido: 200 con `"duplicado": true`). Se piden fotos del lugar o del transporte, **no de caras ni de menores** |
| GET | `/tareas/{id}/cierre/adjuntos/{n}` | cuadrilla de la tarea y mandos | Bytes de la foto (`private, no-store`); auditado |
| GET | `/tareas/{id}/constancia` | cuadrilla de la tarea y mandos | Devuelve el mismo objeto que un ítem de `GET /evacuaciones`; 404 si no hay constancia; auditado |
| GET | `/evacuaciones?estado=&sector_id=&limite=&offset=` | mandos | Listado con estado derivado. `estado` fuera de la lista: 422. Responde `{ "evacuaciones", "total", "limite", "offset", "categoria", "fuente", "fecha_dato" }`; auditado. Ciudadanía, productores y cuadrilla: 403 |
| POST | `/mi/confirmaciones` | ciudadanía y productores | Responde la consulta propia (el código de la app no vence; el de SMS sí, ver abajo). Indicar `solicitud_id` **o** `codigo` (ambos o ninguno: 422). Solicitud o código ajenos o inexistentes: 404. 201 la primera vez; misma respuesta de nuevo: 200 con `"repetida": true`; otra respuesta distinta: 409 (la respuesta es una sola, para conservar la traza) |

**Confirmación por SMS.** Los canales simulados (`sms-sim`, `whatsapp-sim`; el IVR no trae remitente) resuelven `SI <codigo>`, `NO <codigo>` y `PROBLEMA <codigo> <texto>` (mayúsculas, minúsculas y tildes indistintas). El código tiene **8 caracteres** (consonantes y dígitos 2-9, siempre con al menos un dígito); llega en la notificación y **vence a las `vigencia_codigo_horas` (SUPUESTO: 72 h)**. Un texto libre como `no quedan víveres` no se toma como confirmación.

La respuesta **solo tiene efecto** si (1) el código existe, (2) no venció y (3) el remitente (`remitente` de `sms-sim`; `from` del mensaje de `whatsapp-sim`) coincide con el teléfono registrado del solicitante en su grupo familiar (se compara por los últimos 10 dígitos; sin teléfono registrado no hay efecto). **En todos los casos** (código inexistente, vencido, remitente distinto, ya respondida, remitente bloqueado o éxito) la API devuelve lo mismo, para no revelar qué códigos existen: `{ "tipo": "confirmacion", "estado": "recibido", "respuesta": "Recibimos tu respuesta. Si corresponde a un pedido tuyo, la vamos a registrar. Si estás en peligro, llamá al 103. [PROTOTIPO: no es una herramienta oficial]" }`. **Límites** (no bloquean a quien presenta un código válido desde su teléfono registrado): contra un código existente, `confirmacion_sms_invalidos_por_hora` (SUPUESTO: 5) fallos por hora por (remitente, código) y `confirmacion_sms_fallos_por_codigo` (10) por código sumando remitentes, tras lo cual el código queda invalidado para SMS (el operador lo repone con `reabrir`, que también sirve si nunca se respondió); contra códigos inexistentes, `confirmacion_sms_desconocidos_por_hora` (20) por remitente. Los fallos se auditan con remitente y código seudonimizados (HMAC); un éxito, como `confirmacion_evacuado`. La app (titular autenticado) no cambia.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/evacuaciones/{tarea_id}/confirmacion/reabrir` | mandos | Reabre una confirmación **ya respondida** para corregirla: borra la respuesta, genera un **código nuevo** (vigencia renovada) y notifica de nuevo al solicitante. Cuerpo opcional `{ "motivo": "hasta 200 caracteres" }`. 200 `{ "tarea_id", "estado", "respuesta_previa", "reabierta": true, "nota" }`; sin confirmación: 404; todavía sin responder y con el código vigente: 409; otros roles: 403. Queda en la bitácora (`confirmacion_reabierta`, con la respuesta previa). |

`POST /tareas/{id}/cierre`, cuerpo (`extra` prohibido):

```json
{ "lat": -26.18, "lon": -58.139, "centro_id": 3, "personas_trasladadas": 3,
  "animales_trasladados": { "bovinos": 12 }, "nota": "Llegaron por la ruta de ripio." }
```

`lat` -90 a 90 y `lon` -180 a 180 (fuera de rango: 422); `centro_id` opcional (inexistente: 422); `personas_trasladadas` 0 a 5000; `animales_trasladados` `{especie: cantidad}`; `nota` hasta 1000 caracteres, obligatoria si no se trasladaron personas ni animales. Respuesta (201):

```json
{ "constancia": { "id": 1, "tarea_id": 7, "rol_operativo": "encargado_cuadrilla",
    "destino": { "lat": -26.18, "lon": -58.139, "centro_id": 3, "centro_nombre": "...", "distancia_a_centro_m": 0 },
    "personas_trasladadas": 3, "animales_trasladados": { "bovinos": 12 }, "nota": "...",
    "adjuntos": [ { "n": 1, "mime": "image/jpeg", "bytes": 1234 } ], "creada_en": "...", "categoria": "SIMULADO" },
  "tarea": { "id": 7, "estado": "completada", "...": "..." },
  "evacuacion": { "estado": "cerrada_cuadrilla", "motivos_discrepancia": [], "confirmacion_solicitada": true },
  "repetida": false, "categoria": "SIMULADO" }
```

Ítem de `GET /evacuaciones` (y respuesta de `GET /tareas/{id}/constancia`):

```json
{ "tarea_id": 7, "tarea_estado": "completada", "estado": "verificada", "titulo": "...", "sector_id": "S4",
  "cuadrilla_id": 1, "cuadrilla_nombre": "...", "solicitud_id": 12, "orden_id": null,
  "origen": { "lat": -26.18, "lon": -58.139, "tipo": "solicitud" },
  "constancia": { "...": "como arriba" },
  "confirmacion": { "respuesta": "si", "canal": "app", "comentario": null, "solicitada_en": "...", "respondida_en": "..." },
  "discrepancia": null,
  "actualizado_en": "...", "categoria": "SIMULADO", "fuente": "..." }
```

`origen.tipo` es `solicitud` (coordenadas del pedido) o `sector` (centro del sector, para tareas de una orden o pedidos sin coordenadas). `constancia`, `confirmacion` y `origen` pueden ser `null`. `discrepancia` es `{ "motivos": ["evacuado_dice_no" | "evacuado_reporta_problema" | "evacuado_parcial" | "evacuado_no_encontraron" | "destino_lejos_del_centro"] }` o `null`.

**Respuestas del evacuado.** Valores canónicos (los únicos que se guardan y se devuelven): `completa` (verifica el traslado), `parcial`, `no_encontraron` (la cuadrilla no lo encontró), `no_vinieron` y `otro_problema` (cualquiera de estas cuatro marca la evacuación `con_discrepancia`; `parcial` y `no_encontraron` agregan los motivos `evacuado_parcial` y `evacuado_no_encontraron`). Por compatibilidad con SMS y datos viejos se siguen aceptando `si` → `completa`, `no` → `no_vinieron` y `problema` → `otro_problema` (se normalizan al recibirlas; la migración `0009` convirtió las filas existentes). Por SMS: `SI|PARCIAL|NO|PROBLEMA <código> [texto]`. Repetir la misma respuesta (aunque sea con el alias anterior) es 200; una distinta, 409.

`POST /mi/confirmaciones`, cuerpo `{ "solicitud_id": 12 | "codigo": "K7M2QXV4", "respuesta": "completa|parcial|no_encontraron|no_vinieron|otro_problema", "comentario"?: "hasta 500 caracteres" }`; respuesta `{ "id", "tarea_id", "solicitud_id", "respuesta", "comentario", "canal": "app", "respondida_en", "repetida", "nota" }`. No revela el estado derivado ni ubicaciones. `GET /mi/confirmaciones` lista las consultas propias.

**Notificación que recibe el solicitante** al cerrarse la tarea (solo si el pedido tiene solicitante), en `GET /mi/notificaciones`:

```json
{ "id": 9, "orden_id": null, "tipo": "confirmacion_evacuacion", "leida": false, "creada_en": "...",
  "mensaje": "¿Llegaste a <centro>? ... Respondé en la app o por SMS desde tu teléfono registrado: SI K7M2QXV4, NO K7M2QXV4 o PROBLEMA K7M2QXV4 y el detalle. [PROTOTIPO: no es una herramienta oficial]",
  "datos": { "tarea_id": 7, "solicitud_id": 12, "codigo": "K7M2QXV4", "centro_nombre": "...", "respuestas": ["completa", "parcial", "no_encontraron", "no_vinieron", "otro_problema"] } }
```

Los operadores reciben `tipo: "discrepancia"` con `datos: { "tarea_id", "sector_id", "motivos" }`. Eventos WebSocket `constancia` (`{ "tarea_id", "sector_id", "estado", "personas_trasladadas"?, "motivo": "cierre|confirmacion" }`) y `discrepancia` (`{ "tarea_id", "sector_id", "motivos" }`): solo para mandos y cuadrilla, sin ubicaciones.

Ejemplo reproducible (con `$H_CUADRILLA` y `$H_CIUDADANO` con su `Authorization`):

```bash
curl -s -X POST $API/tareas/7/cierre -H "$H_CUADRILLA" -H "Idempotency-Key: $(uuidgen)" -H 'Content-Type: application/json' \
  -d '{"lat":-26.18,"lon":-58.139,"centro_id":1,"personas_trasladadas":3,"nota":"Llegaron al centro."}'
curl -s -X POST $API/mi/confirmaciones -H "$H_CIUDADANO" -H 'Content-Type: application/json' -d '{"solicitud_id":12,"respuesta":"completa"}'
# Casos inválidos: sin Idempotency-Key -> 422; "lat": 95 -> 422; ciudadano en /tareas/7/cierre -> 403; cuadrilla ajena -> 403
```

## Seguimiento de la cuadrilla ("Cuadrilla en camino")

Cuando una tarea ligada a un pedido de asistencia está `en_curso`, la cuadrilla comparte su posición y la persona que pidió ayuda ve la distancia y una llegada **estimada**. Todo es `SIMULADO` en la demo y la llegada es una estimación con supuestos explícitos (`supuestos.yaml`), no una promesa.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/cuadrillas/mi-posicion` | `cuadrilla` | Cuerpo `{ "lat": -90..90, "lon": -180..180, "precision_m"?: >= 0 }`. Guarda (pisa) la última posición de las cuadrillas del usuario que tengan alguna tarea `en_curso`. Sin tarea en curso: 409 "No tenés ninguna tarea en curso...". Menos de `intervalo_min_posicion_s` (10 s, SUPUESTO) desde la anterior: 429 con `Retry-After`. Coordenadas fuera de rango o `precision_m` negativa: 422. Otros roles: 403. Respuesta `{ "cuadrillas": [id], "categoria": "SIMULADO" }`. Emite el evento WebSocket `posicion_cuadrilla` |
| GET | `/mi/seguimiento` | `ciudadano`, `productor` | Un ítem por cada pedido **propio** con tarea en curso (los de otras personas nunca aparecen). Otros roles: 403 |
| GET | `/mi/pedidos` | `ciudadano`, `productor` | Pedidos **propios** (máximo 100, del más nuevo al más viejo) con línea de tiempo, tarea, cuadrilla por rol y vehículo, seguimiento, confirmación y centro. Otros roles: 403; sin sesión: 401 |
| GET | `/cuadrillas/posiciones` | `operador`, `decisor`, `admin` | Última posición de cada cuadrilla con tarea en curso. Auditado (`lectura_ubicacion_cuadrillas`) |

Ítem de `GET /mi/seguimiento` (`seguimientos[]`):

```json
{ "solicitud_id": 12, "tarea_id": 7, "tipo_cuadrilla": "humana", "roles": ["encargado_cuadrilla", "salud_sipec"],
  "estado": "en_camino",
  "posicion": { "lat": -26.18, "lon": -58.14, "precision_m": 12.5 },
  "actualizada_en": "2026-11-20T15:02:11-03:00", "posicion_vieja": false,
  "distancia_m": 3450, "llegada_estimada_min": 6,
  "categoria": "SIMULADO", "fuente": "...",
  "supuestos": { "factor_desvio": 1.3, "velocidad_cuadrilla_kmh": 40, "posicion_vieja_minutos": 5, "fuente": "SUPUESTO (ver supuestos.yaml)" },
  "nota": "Es una estimación: ..." }
```

- `estado`: `en_camino` (hay posición) o `asignada_sin_posicion` (todavía no llegó ninguna; `posicion`, `distancia_m` y `llegada_estimada_min` son `null`).
- `distancia_m` y `llegada_estimada_min` salen de la `ruta` (ver "Recorrido animado"): metros y minutos que **faltan**; la llegada es distancia / `velocidad_cuadrilla_kmh` (40 km/h), redondeada hacia arriba. Sin red vial equivalen a la recta por `factor_desvio` (1,3). Si el pedido no tiene coordenadas, ambos son `null`.
- `posicion_vieja` es `true` si pasaron más de `posicion_vieja_minutos` (5 min) desde `actualizada_en`.
- La cuadrilla se identifica por tipo y roles del catálogo, nunca por personas.

#### Recorrido animado (`seguimiento.ruta`)

Cada ítem de seguimiento (en `GET /mi/seguimiento` y dentro de `seguimiento` de `GET /mi/pedidos`) suma `ruta` y `simulada`. `ruta` es `null` si todavía no hay posición (y el modo demostración está apagado) o el pedido no tiene coordenadas.

```json
{ "solicitud_id": 12, "tarea_id": 7, "tipo_cuadrilla": "ganadera", "roles": ["encargado_cuadrilla", "veterinario"],
  "estado": "en_camino",
  "posicion": { "lat": -26.1884, "lon": -58.1752, "precision_m": null },
  "actualizada_en": "2026-11-20T15:05:11-03:00", "posicion_vieja": false,
  "distancia_m": 3120, "llegada_estimada_min": 5,
  "ruta": {
    "coordenadas": [[-58.176, -26.2], [-58.1752, -26.1884], [-58.1811, -26.1703], [-58.1875, -26.156]],
    "distancia_km": 3.12, "llegada_estimada_min": 5, "metodo": "red_vial", "simulada": true,
    "progreso": 0.2814, "velocidad_kmh": 40, "calculada_en": "2026-11-20T15:02:12-03:00" },
  "simulada": true, "categoria": "SIMULADO", "fuente": "Posición SIMULADA por el servidor (modo demostración): ...",
  "supuestos": { "...": "..." }, "nota": "Modo demostración (SIMULADO): ..." }
```

- `coordenadas`: `[[lon, lat], ...]` (hasta 300 puntos) desde la posición de la cuadrilla (o la base simulada) hasta el pedido, en el sentido del viaje. `distancia_km` y `llegada_estimada_min`: lo que **falta** (a `velocidad_kmh`). `progreso` 0..1: fracción ya recorrida de la ruta (con posición real la ruta parte del vehículo y vale 0; con la simulada llega a 1 y la llegada a 0). `calculada_en`: cuándo se calculó el trazado (se reusa ~60 s por origen redondeado a ~50 m).
- `metodo`: `red_vial` (pgRouting sobre `red_vial`, perfil del vehículo de la cuadrilla: el camión jaula solo pavimento y ripio; excluye los caminos que el operador marcó no transitables y los tramos dentro de sectores comprometidos según la última lectura de Puerto Formosa) o `aproximado` (sin red o sin ruta: recta por `factor_desvio`; la lancha va siempre en recta a `velocidad_lancha_kmh`). La ruta es una guía de demostración, no un recorrido garantizado.
- `simulada: true` (en `ruta` y en el ítem): la posición la puso el servidor (**modo demostración**). Con `seguimiento_demo: true` (`supuestos.yaml`, SIMULADO), la tarea `en_curso` y **ninguna posición real vigente**, el vehículo sale de `base_cuadrillas_simulada` (SUPUESTO) en el instante de inicio de la tarea y avanza por la ruta a `velocidad_kmh`; en `posicion` va el punto simulado (`precision_m: null`). Una posición real siempre gana: si la cuadrilla comparte la suya, `simulada` es `false`. Para apagarlo: `seguimiento_demo: false`.
- Control de acceso sin cambios: solo quien hizo el pedido lo ve; la ruta no revela más que el punto de ese pedido y la posición de su cuadrilla.
- Los mandos (`GET /cuadrillas/posiciones`) ven también las posiciones simuladas, marcadas `simulada: true`.

Ítem de `GET /cuadrillas/posiciones` (`posiciones[]`): `{ "cuadrilla_id", "nombre", "tipo_incidente", "roles", "lat", "lon", "precision_m", "actualizada_en", "posicion_vieja", "tareas_en_curso", "simulada", "categoria" }`, más `supuestos` y `fecha_dato` en el nivel superior.

Evento WebSocket `posicion_cuadrilla` (`{ "cuadrillas": [id] }`): solo `operador`, `decisor` y `admin`; lleva ids sin coordenadas y el panel consulta `GET /cuadrillas/posiciones`.

```bash
curl -s -X POST $API/cuadrillas/mi-posicion -H "$H_CUADRILLA" -H 'Content-Type: application/json' -d '{"lat":-26.18,"lon":-58.14,"precision_m":12}'
curl -s $API/mi/seguimiento -H "$H_CIUDADANO"
# Casos inválidos: "lat": 95 -> 422; sin tarea en curso -> 409; dos envíos en menos de 10 s -> 429; ciudadano en /cuadrillas/mi-posicion -> 403
```

### Mis pedidos (`GET /mi/pedidos`)

Respuesta `{ "categoria": "SIMULADO", "items": [...] }`, hasta 100 pedidos **propios** del más nuevo al más viejo (nunca los de otra persona). Cada ítem:

```json
{ "id": 4, "tipo": "evacuacion", "personas": 3, "estado": "asignada", "origen": "web",
  "creada_en": "2026-11-20T18:01:13.169859+00:00", "lat": -26.18, "lon": -58.139, "sector_id": "S4",
  "linea_tiempo": [
    { "estado": "recibida",  "en": "2026-11-20T18:01:13.169859+00:00", "alcanzado": true },
    { "estado": "verificada", "en": "2026-11-20T18:01:14.158137+00:00", "alcanzado": true },
    { "estado": "asignada",  "en": "2026-11-20T18:01:14.560747+00:00", "alcanzado": true },
    { "estado": "en_curso",  "en": null, "alcanzado": true },
    { "estado": "resuelta",  "en": "2026-11-20T18:01:15.823719+00:00", "alcanzado": true } ],
  "tarea": { "id": 4, "estado": "completada",
    "cuadrilla": { "id": 1, "tipo_incidente": "humana", "rol_encargado": "encargado_cuadrilla", "vehiculo": "4x4" },
    "iniciada_en": null, "cerrada_en": "2026-11-20T18:01:15.823719+00:00" },
  "seguimiento": null,
  "confirmacion": { "solicitud_id": 4, "codigo": "K7M2Q9XA", "respondida": true, "respuesta": "parcial", "comentario": null },
  "centro": { "id": 1, "nombre": "Centro de recepción SIMULADO 1", "lat": -26.17, "lon": -58.165 } }
```

- `linea_tiempo` siempre trae los 5 estados en orden. `alcanzado` dice si el estado ya se cumplió; `en` es la hora **solo si el sistema la registró** (si no, `null`, también con `alcanzado: true`). Se toma de: alta del pedido (`recibida`); la bitácora de cambios de estado de la solicitud (`verificada`, `asignada`, `en_curso`, `resuelta`); la hora de creación de la tarea (`asignada`, de respaldo); la última actualización de la tarea mientras está `en_curso`; y la constancia de cierre o el cierre de la tarea (`resuelta`, de respaldo). Si la tarea va más adelantada que la solicitud (p. ej. tarea `completada`), esos estados cuentan como alcanzados.
- `tarea` es la tarea vigente (la más nueva no cancelada) o `null`. `cuadrilla` se identifica por tipo, `rol_encargado` (rol del catálogo si la cuadrilla tiene encargado; nunca un nombre) y `vehiculo` (`SIMULADO`, puede ser `null`). `iniciada_en` y `cerrada_en` son `null` si no hay hora registrada.
- `seguimiento`: el mismo ítem que devuelve `GET /mi/seguimiento` para ese pedido (solo con la tarea `en_curso`), si no `null`. Una posición de más de `posicion_vencida_minutos` (30 min, SUPUESTO) no se devuelve: el ítem queda `asignada_sin_posicion` con `posicion_vieja: true`.
- `confirmacion`: la consulta del traslado (`respuesta` canónica, ver "Respuestas del evacuado") o `null` si todavía no se pidió. Incluye `codigo` (el mismo que `GET /mi/confirmaciones`) para que la persona también pueda responder por SMS (`SI <código>`, `PARCIAL <código>`, `NO <código>` o `PROBLEMA <código> <texto>`); solo lo ve la dueña del pedido.
- `centro`: el centro de recepción registrado en la constancia de cierre (`null` antes del cierre o sin centro). No es la sugerencia de `GET /mi/sector`.
- Otros roles: 403; sin sesión: 401. No se registra en la bitácora de accesos (son datos propios de quien consulta, igual que `/mi/seguimiento`).

```bash
curl -s $API/mi/pedidos -H "$H_CIUDADANO"
```

Prueba automática: `tests/test_seguimiento.py`, `tests/test_ruta_seguimiento.py` y `tests/test_pedidos.py`.

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
| GET | `/verificador/k7` | público | Las 7 relaciones de K7. Las 3 y 6 se calculan con K3 (`verificado_con: "K3 (calculado)"`). Las 1, 2 y 5 se miden sobre la capa de cursos de agua del IGN y de localidades de BAHRA (`data/geo/`; `verificado_con: "IGN cursos de agua (calculado)"`, con el campo `evidencia_cartografica` y las distancias en km). Las 4 y 7 involucran al Paraná y a Corrientes, que la capa de Formosa no incluye: `veredicto: "NO VERIFICABLE CON LA CAPA DISPONIBLE"` y el conocimiento general queda solo como nota a confirmar. Sin la capa cargada, todas las cartográficas quedan en ese veredicto |
| GET | `/bitacora?estado=` | mandos | Entradas K8 |
| POST | `/bitacora` | `decisor` | Campos obligatorios: `decision`, `evidencia`, `limites`, `riesgos`, `gatillos` y `fecha_simulada`; `responsable_rol` por defecto es el rol operativo del usuario. Un campo vacío o ausente responde 422 |
| PATCH | `/bitacora/{id}` | `decisor` | Completa un borrador generado por una orden |
| GET | `/bitacora/{id}/export` | mandos | Markdown (`text/markdown`) |

## Canales simulados

`POST /canales/whatsapp-sim`, `/canales/sms-sim` y `/canales/ivr-sim`. Exigen la cabecera `X-Hub-Signature-256: sha256=<HMAC-SHA256 del cuerpo crudo con CANAL_HMAC_SECRET>` (401 si falta o no coincide; 503 si el secreto no está configurado).

- `whatsapp-sim`: payload de la Meta Cloud API (`entry[].changes[].value.messages[].text.body`; `id` y `timestamp` por mensaje; `timestamp` inválido o fuera de rango: 422; un datetime sin zona se interpreta como hora de Argentina).
- `sms-sim`: `{ "remitente": "+54...", "texto": "...", "recibido_en"?: datetime, "mensaje_id"?: "..." }`.
- `ivr-sim`: `{ "llamada_id": "...", "transcripcion"?: "...", "turnos"?: ["línea 1", "línea 2"] }` (al menos uno; los turnos se unen en un guion y pasan por el normalizador).
- Cuerpo máximo 64 KB (413 por `Content-Length` o al transmitirse); firma comparada en bytes (cualquier carácter no ASCII: 401).
- **Cada mensaje se procesa por separado.** Respuesta 201 `{ "canal", "categoria": "SIMULADO", "resultados": [ ... ] }`; cada resultado trae `tipo` (`lluvia`, `solicitud`, `menu`, `no_entendido`, `error`) y `estado` (`creado`, `duplicado`, `respuesta`, `error`). Un mensaje inválido o repetido no tira a los demás; solo si **ningún** mensaje es válido responde 422 con el primer error. Deduplicación: por id de mensaje del proveedor (`id` de WhatsApp, `mensaje_id` o hash de remitente+texto+hora en SMS, `llamada_id` en IVR); una lectura de lluvia repetida es `duplicado`, no error.
- Formatos estrictos (sin cambios): `LLUVIA <CODIGO_PUESTO> <MM>` y `SOS-FSA|lat,lon|PERFIL|FAM:n|BOV:n(detalle)|ACC:texto|texto libre`. Las coordenadas deben caer en la provincia de Formosa (0,0, lat/lon invertidas o de otro país: 422).
- **Menú por palabras clave** (mensaje completo `AYUDA`, `INFO` o `SOS`): `resultados[0] = { "tipo": "menu", "estado": "respuesta", "palabra", "respuesta": "<texto fijo en español>", "categoria_respuesta": "DOCUMENTO DE REFERENCIA", "fuente_respuesta" }`. La respuesta lista 103 Defensa Civil, 106 Prefectura Naval, 911 Policía y emergencias y 105 Emergencias ambientales (fuente https://www.argentina.gob.ar/tema/emergencias, consultada el 19/11/2026) y explica cómo enviar un SOS.
- **Texto libre** (cualquier otro texto): el normalizador extrae con reglas (cifras y números en palabras, "somos cinco", "40 vacas", "el camino está cortado") personas, animales y especie, estado del acceso y una referencia de ubicación (paraje, camino, ruta, barrio). **No inventa lo que falta.** Si hay algo registrable crea una solicitud `tipo: "sos_texto"`, estado `recibida`, sin coordenadas, con `ubicacion_aproximada: true`, `referencia_ubicacion` y `requiere_verificacion: true` ("a verificar por operador"); el resultado trae `extraido { personas, animales, especie, acceso, referencia_ubicacion, faltantes }` y una `respuesta` para quien escribió. Si no hay nada registrable: `tipo: "no_entendido"` con la guía, sin crear nada.

Ejemplo de guion IVR simulado (la transcripción la entregaría el proveedor de voz; acá se simula):

```bash
CUERPO='{"llamada_id":"call-0001","turnos":["Estamos en el barrio Norte","somos tres personas","tenemos 12 cabras"]}'
FIRMA="sha256=$(printf %s "$CUERPO" | openssl dgst -sha256 -hmac "$CANAL_HMAC_SECRET" -hex | sed 's/^.* //')"
curl -s -X POST $API/canales/ivr-sim -H "X-Hub-Signature-256: $FIRMA" -H 'Content-Type: application/json' -d "$CUERPO"
# -> resultados[0]: tipo "solicitud", estado "creado", requiere_verificacion true,
#    extraido { personas: 3, animales: 12, especie: "caprino", referencia_ubicacion: "barrio Norte..." }
```

Para conectar la Meta Cloud API real: registrar la ruta como URL de webhook de la app de Meta, usar el secreto de la app como `CANAL_HMAC_SECRET` y agregar el `GET` de verificación (`hub.challenge`); el formato del payload y la firma son los mismos.

## Tiempo real

`WS /api/v1/ws`. El token de acceso **no** va en la URL: se envía como **primer mensaje** `{"token": "<access_token>"}` dentro de los 5 segundos siguientes a la conexión; si falta, es inválido o vence el plazo, el servidor cierra con el código **1008**. Luego el servidor envía `{"tipo": "conectado"}` y los eventos `{"tipo": "escenario|solicitud|orden|tarea|posicion_cuadrilla|parte_tarea", "datos": {...}}`: los mandos y la cuadrilla reciben todos (salvo `posicion_cuadrilla` y `parte_tarea`, solo para operador, decisor y admin); ciudadanía y productores reciben `orden` **solo si viven o producen en los sectores de la orden** y sus propios `solicitud`. Cada envío tiene plazo de 5 s: un cliente lento se desconecta sin demorar a los demás.

La conexión **no sobrevive a la autorización con la que se abrió**: el servidor la cierra con **1008** cuando vence el `exp` del token de acceso (el cliente debe renovar el token con `/auth/refresh` y reconectar) y cuando un admin cambia la contraseña, el estado o el rol del usuario (`PATCH /usuarios/{id}`) o se detecta reutilización de un refresh token.

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

Pruebas automáticas: `tests/test_escenario.py`, `test_recomendacion.py`, `test_motor_evacuacion.py`, `test_ruteo.py`, `test_ganaderia_y_parser.py`, `test_lluvia_y_canales.py`, `test_operacion.py` y `test_seguridad_fase2.py`.

## Regenerar el esquema OpenAPI

`docs/openapi.json` se exporta de la aplicación (70 rutas y 81 operaciones HTTP bajo `/api/v1`, todas documentadas en este archivo; el WebSocket `WS /ws` no figura en OpenAPI y está en "Tiempo real"). Desde `apps/backend`, con el entorno virtual activo y las variables de `.env` cargadas:

```bash
python -c "import json; from app.main import app; open('../../docs/openapi.json','w',encoding='utf-8',newline='\n').write(json.dumps(app.openapi(), ensure_ascii=False, indent=2)+'\n')"
```

Con el backend en marcha, el mismo esquema se sirve en `GET /openapi.json` y la interfaz interactiva en `GET /docs`.
