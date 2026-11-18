# Contrato API · Plataforma de Gestión de Evacuaciones

> PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial

Prefijo: `/api/v1`. Documentación interactiva generada por FastAPI en `/docs` y esquema en `/openapi.json`. Este documento cubre lo implementado hasta la **Fase 1**: meta, autenticación y usuarios. Los demás grupos del CLAUDE.md §9 se agregan en sus fases.

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
| 429 | `demasiados_intentos` | Cuenta bloqueada temporalmente o límite de solicitudes excedido |

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
- 401 para credenciales incorrectas; tras 5 fallos consecutivos la cuenta se bloquea 15 minutos y responde 429 incluso con la contraseña correcta.

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
