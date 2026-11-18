# Seguridad · Plataforma de Gestión de Evacuaciones

> PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial

Medidas implementadas en la **Fase 1** (backend) y su correspondencia con OWASP Top 10 (2021). Lo que aún no existe se indica en "Pendiente".

## Medidas

| Área | Medida | Dónde |
|---|---|---|
| Contraseñas | Hash **Argon2id** (`argon2-cffi`, parámetros por defecto). Largo mínimo 10 (configurable) y máximo 128. Se verifica un hash de relleno cuando el correo no existe, para igualar tiempos. | `app/core/seguridad.py` |
| Bloqueo por intentos | Tras `LOGIN_MAX_INTENTOS` (5) contraseñas erróneas la cuenta se bloquea `LOGIN_BLOQUEO_MINUTOS` (15) y responde **429**; el contador se reinicia con un acceso correcto. | `app/api/v1/auth.py` |
| Rate limiting | `slowapi` por IP en login, refresh y registro (`RATE_LIMIT_LOGIN`, `RATE_LIMIT_REGISTRO`). | `app/core/limitador.py` |
| Access token | JWT HS256 de 15 minutos con `sub`, `rol`, `type=access`, `jti`, `iat` y `exp` obligatorio; se rechazan tokens vencidos, de otro tipo o firmados con otra clave. | `app/core/seguridad.py` |
| Refresh token | Aleatorio de 48 bytes, guardado solo como hash SHA-256 en `sesiones_refresh`. **Rotación** en cada uso, vencimiento de 7 días y **detección de reutilización**: presentar un token ya rotado o cerrado revoca toda la familia de sesiones. | `app/core/sesiones.py` |
| Transporte del refresh | Web: cookie `HttpOnly`, `Secure` (`COOKIE_SECURE`), `SameSite=Strict`, ruta `/api/v1/auth`. Móvil: solo si envía `X-Cliente: movil` se devuelve en el cuerpo (se guardará en `expo-secure-store`). | `app/api/v1/auth.py` |
| RBAC | Dependencia `requiere_rol(...)` por endpoint (403 con evento `acceso_denegado` en la bitácora) y `exigir_propietario_o_rol(...)` por recurso. | `app/core/rbac.py` |
| Altas institucionales | Los roles `cuadrilla`, `operador`, `decisor` y `admin` no se autorregistran: los crea un `admin` en `POST /usuarios`. Un admin no puede desactivarse ni quitarse el rol a sí mismo. | `app/api/v1/usuarios.py` |
| Cifrado de campos | **AES-GCM** (`cryptography`) para salud, vulnerabilidad y teléfono de `grupos_familiares`; nonce aleatorio de 12 bytes; el nombre del campo se autentica como dato asociado (no se puede copiar un valor a otro campo). Clave de 32 bytes en `FIELD_ENCRYPTION_KEY`. | `app/core/cifrado.py` |
| Bitácora de accesos | Tabla `auditoria_accesos` con **hash SHA-256 encadenado** (cada fila incluye el hash de la anterior); se registran registro, login (correcto, fallido, bloqueado), refresh, reutilización de refresh, logout, altas y cambios de usuarios, lecturas de datos personales y accesos denegados. `verificar_cadena` detecta alteraciones y borrados intermedios. | `app/core/auditoria.py` |
| Consentimiento | El registro exige `consentimiento: true` (Ley 25.326); se guarda la fecha en `usuarios.consentimiento_en`. Sin consentimiento responde 422. | `app/api/v1/esquemas.py` |
| Validación | Pydantic v2 con `extra="forbid"`, rangos y largos; consultas parametrizadas con SQLAlchemy; error común `{ "error": { codigo, mensaje, detalle } }` sin trazas internas. | `app/api/v1/esquemas.py`, `app/main.py` |
| Cabeceras HTTP | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, `Content-Security-Policy: default-src 'none'` (excepto `/docs`) y `Cache-Control: no-store` en `/auth` y `/usuarios`. | `app/core/cabeceras.py` |
| CORS | Orígenes explícitos (`CORS_ORIGINS`), sin comodín, con credenciales; cabeceras permitidas acotadas. | `app/main.py` |
| Secretos | Solo en variables de entorno; `JWT_SECRET` y `FIELD_ENCRYPTION_KEY` no tienen valor por defecto utilizable y el backend se niega a firmar o cifrar si faltan o conservan el marcador `CAMBIAR`. `.env` está en `.gitignore`. | `app/config/settings.py` |
| Datos de demo | Usuarios, familias y teléfonos ficticios; contraseñas de demostración solo desde `DEMO_PASSWORD` / `DEMO_ADMIN_PASSWORD`. | `data/simulado/usuarios_demo.json` |

## Correspondencia con OWASP Top 10 (2021)

| Riesgo | Mitigación en esta fase |
|---|---|
| A01 Pérdida de control de acceso | RBAC por endpoint y por recurso; altas institucionales solo por admin; denegaciones auditadas. |
| A02 Fallas criptográficas | Argon2id; AES-GCM con AAD; JWT con secreto obligatorio; refresh almacenado como hash; cookies `HttpOnly`/`Secure`/`SameSite=Strict`. |
| A03 Inyección | ORM con parámetros enlazados; validación estricta de entradas; sin SQL armado con texto del usuario. |
| A04 Diseño inseguro | Bloqueo temporal, rate limiting, rotación y revocación de sesiones, consentimiento informado, mínimo de datos personales. |
| A05 Configuración de seguridad incorrecta | Cabeceras de seguridad, CORS acotado, secretos obligatorios, errores sin detalle interno. |
| A06 Componentes vulnerables | Dependencias fijadas en `requirements.txt`. Pendiente: auditoría periódica (`pip-audit`) en la CI. |
| A07 Fallas de identificación y autenticación | Política de contraseñas, bloqueo, tiempos igualados, refresh rotativo con detección de reutilización, logout que revoca la familia. |
| A08 Fallas de integridad de software y datos | Bitácora con hash encadenado verificable; migraciones versionadas con Alembic. |
| A09 Fallas de registro y monitoreo | Eventos de autenticación, administración y acceso a datos personales en la bitácora. |
| A10 Falsificación de solicitudes del lado del servidor | El backend no hace solicitudes a URLs provistas por el usuario. |

## Decisiones y límites conocidos

- **Enumeración de correos:** el registro responde 409 si el correo existe. Es un compromiso de usabilidad; el login no distingue entre correo inexistente y contraseña errónea (siempre 401, o 429 si la cuenta está bloqueada).
- **Bloqueo por cuenta:** un atacante podría bloquear temporalmente a una persona conocida. Se acepta en el prototipo; el rate limiting por IP lo acota. Alternativa a evaluar: bloqueo progresivo por par IP/cuenta.
- **Truncamiento de la bitácora:** el hash encadenado detecta alteraciones y borrados intermedios, pero no el borrado de las últimas filas; para eso haría falta anclar periódicamente el último hash fuera de la base.
- **Almacenamiento del limitador:** `slowapi` usa memoria del proceso; con varios procesos hay que pasar a Redis.
- **CSRF:** el access token viaja en `Authorization` (no en cookie) y la cookie de refresh es `SameSite=Strict` con ruta restringida, lo que cubre el riesgo en la web.

## Pendiente (fases siguientes)

Webhooks de canales firmados con HMAC (Fase 2), límites de tamaño y tipo MIME de adjuntos (Fase 2/5), cifrado de más campos al incorporar solicitudes con datos de salud, `pip-audit` y análisis estático en CI, inscripción de la base ante la AAIP (fuera del alcance del MVP).
