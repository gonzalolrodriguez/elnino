# Seguridad · Plataforma de Gestión de Evacuaciones

> PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial

Medidas implementadas en las Fases 1 a 5 (backend, web y app móvil) y su correspondencia con OWASP Top 10 (2021). Lo que aún no existe se indica en "Pendiente" al final. Las secciones están en orden cronológico: las medidas de las Fases 1 y 2 se completan con las de las Fases 3 a 5 (sección "Fases 3 a 5").

## Medidas

| Área | Medida | Dónde |
|---|---|---|
| Contraseñas | Hash **Argon2id** (`argon2-cffi`, parámetros por defecto). Largo mínimo 10 (configurable) y máximo 128. Se verifica un hash de relleno cuando el correo no existe, para igualar tiempos. | `app/core/seguridad.py` |
| Bloqueo por intentos | Tras `LOGIN_MAX_INTENTOS` (5) contraseñas erróneas desde una misma IP, ese par cuenta+IP se bloquea `LOGIN_BLOQUEO_MINUTOS` (15) y responde **429**; el contador se reinicia con un acceso correcto (Fase 2). | `app/api/v1/auth.py` |
| Rate limiting | `slowapi` por IP en login, refresh y registro (`RATE_LIMIT_LOGIN`, `RATE_LIMIT_REGISTRO`). **Por persona** (id del access token, no IP) en `/mi/*`, `/mi/seguimiento`, `/mi/pedidos`, `/cuadrillas/mi-posicion` y `/cuadrillas/posiciones` (`RATE_LIMIT_USUARIO`, 300/min) y en `/simulacion/*` y `/ruteo` (`RATE_LIMIT_SIMULACION`, 120/min); holgados para que la web (que consulta `/mi/pedidos` cada 20 s) y el demo nunca los toquen; 429 con `Retry-After`. `RATE_LIMIT_ACTIVO=false` los apaga a todos. | `app/core/limitador.py` |
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

## Correspondencia con OWASP Top 10:2025 (web y API)

Se usa la edición 2025 (no hay una edición 2026 oficial). Estado al 19/11/2026.

| Riesgo | Mitigación | Riesgo aceptado / pendiente |
|---|---|---|
| A01 Pérdida de control de acceso (incluye SSRF) | RBAC por endpoint y por recurso; altas institucionales solo por admin; denegaciones auditadas; el backend no hace solicitudes a URLs provistas por el usuario; las órdenes por WebSocket solo llegan a los mandos y a quienes viven o producen en los sectores alcanzados. | Los miembros de cuadrilla ven todos los eventos de mandos. |
| A02 Configuración de seguridad incorrecta | Cabeceras de seguridad, CORS acotado (con `Idempotency-Key`), secretos obligatorios, `ENTORNO=produccion` oculta `/docs` y `/openapi.json` y fuerza la cookie `Secure`, la base de datos se publica solo en `127.0.0.1`, usuarios de demo solo con `SEED_DEMO=true`, tope global de cuerpo de 1 MB. | El demo local usa `COOKIE_SECURE=false` y HTTP; en producción se exige HTTPS. |
| A03 Fallas en la cadena de suministro de software | Dependencias fijadas en `requirements.txt` y lockfiles; `maplibre-gl` llevado al parche. | Falta `pip-audit` / `pnpm audit` en la CI. |
| A04 Fallas criptográficas | Argon2id; AES-GCM con AAD; JWT con secreto obligatorio; refresh guardado como hash SHA-256; cookies `HttpOnly`/`Secure`/`SameSite=Strict`. | Tráfico HTTP sin cifrar en el demo de LAN (ver APK). |
| A05 Inyección | ORM con parámetros enlazados; SQL de ruteo armado solo con constantes e ids enteros validados; validación estricta de entradas con vocabularios cerrados (especies, categorías, sectores). | - |
| A06 Diseño inseguro | Bloqueo temporal, rate limiting por IP, cuota blanda de solicitudes (20/hora) y tope de fotos por persona, rotación y revocación de sesiones, idempotencia (solicitudes, órdenes, mensajes de canal), consentimiento informado, mínimo de datos personales, sin CAPTCHA ni pasos extra para la ciudadanía. | - |
| A07 Fallas de autenticación | Política de contraseñas; **401 genérico** para correo inexistente, contraseña errónea, cuenta inactiva o bloqueada (sin enumeración); bloqueo por par cuenta+IP y por cuenta; tiempos igualados; refresh rotativo con detección de reutilización y gracia de un solo uso ligada al cliente; logout que revoca la familia y cierra los WebSockets. | Sin MFA para usuarios institucionales (decisión de producto pendiente). El registro responde 409 si el correo existe. |
| A08 Fallas de integridad de software y datos | Bitácora con hash encadenado verificable (`/admin/resumen` informa su integridad); migraciones versionadas; firma HMAC de los webhooks de canales comparada en bytes. | El truncamiento de las últimas filas de la bitácora no se detecta. |
| A09 Fallas de registro y alertas | Eventos de autenticación, administración y acceso a datos personales en la bitácora; los correos inexistentes se auditan agregados (una fila por IP y minuto) para no serializar el sistema; `/admin/resumen` expone bloqueos y la verificación de la cadena. | No hay alertas automáticas hacia una persona. |
| A10 Manejo incorrecto de condiciones excepcionales | Manejador global que responde el sobre JSON `error_interno` sin trazas; 503 si faltan lecturas del río; serie vacía, timestamps desbordados, firmas no ASCII y marcos binarios de WebSocket ya no producen 500; tope de cuerpo por `Content-Length` y por transmisión; envíos de WebSocket concurrentes con plazo. | - |

## Correspondencia con OWASP Mobile Top 10 2024 (app React Native / Expo)

| Riesgo | Mitigación | Riesgo aceptado / pendiente |
|---|---|---|
| M1 Uso inadecuado de credenciales | Sin credenciales en el código ni en el repositorio; tokens en `expo-secure-store`; contraseñas de demo solo por variables de entorno. | - |
| M2 Seguridad insuficiente de la cadena de suministro | Dependencias con lockfile; el APK se construye con EAS Build. | Sin auditoría automática de dependencias. |
| M3 Autenticación/autorización insegura | Toda autorización se decide en el backend (RBAC); refresh rotativo con gracia de un solo uso; cierre de sesión remoto. | Sin MFA ni sesión por dispositivo. |
| M4 Validación insuficiente de entradas y salidas | Validación estricta en el backend (Pydantic, vocabularios cerrados); el SMS de emergencia se arma con límites de largo; el parser rechaza coordenadas fuera de Formosa. | - |
| M5 Comunicación insegura | HTTPS requerido para producción. | El APK de la demo habilita HTTP para la red local (ver más abajo y el aviso en pantalla). |
| M6 Controles de privacidad insuficientes | Consentimiento (Ley 25.326), campos sensibles cifrados, lecturas de datos personales auditadas, datos de demo ficticios. | Inscripción de la base ante la AAIP pendiente. |
| M7 Protecciones binarias insuficientes | - | Aceptado en el prototipo (sin ofuscación). |
| M8 Configuración de seguridad incorrecta | Permisos mínimos; la URL del servidor es configurable con confirmación de riesgo si es HTTP. | `usesCleartextTraffic` habilitado en la demo. |
| M9 Almacenamiento inseguro de datos | Nada sensible en `AsyncStorage`; la cola offline (SQLite) guarda solicitudes, no credenciales. Cuando la sesión termina por cualquier motivo (cierre manual, cambio de servidor **o refresh rechazado por el servidor con 401/403**) se borran la caché personal (pedidos, sector, confirmaciones, ayuda rápida, destinos con el centro asignado) y los ítems de la cola ya enviados o rechazados; solo queda la lista pública de centros (`apps/mobile/src/lib/limpiezaLocal.ts`). | Las solicitudes **pendientes** quedan en claro en el teléfono hasta enviarse: no se borran cuando vence la sesión para no perder un pedido de ayuda; se envían al volver a entrar con la misma cuenta y se borran si entra otra o al cerrar sesión desde Perfil. SQLite sin cifrar (SQLCipher queda para producción). |
| M10 Criptografía insuficiente | Algoritmos estándar (Argon2id, AES-GCM, HMAC-SHA256); el cifrado de campos ocurre en el servidor. | - |

## Auditoría del 19/11/2026: medidas de baja fricción

| Medida | Detalle | Dónde |
|---|---|---|
| 401 genérico | Los bloqueos por par y por cuenta también responden 401; el 429 sale solo del limitador por IP y trae `Retry-After`. | `app/api/v1/auth.py`, `app/main.py` |
| Cuota blanda de solicitudes | `SOLICITUDES_MAX_POR_HORA` (20) por persona con mensaje amable y `Retry-After`; los reintentos idempotentes no cuentan; tope `ADJUNTOS_MAX_BYTES_POR_USUARIO` de fotos. | `app/api/v1/solicitudes.py` |
| Idempotencia sin ventana | Índices únicos parciales en `solicitudes_asistencia` (solicitante, clave) y `ordenes` (decisor, clave) más `ON CONFLICT`; fotos repetidas por SHA-256 bajo bloqueo de fila; mensajes de canal por id del proveedor. | migraciones 0004 y 0005 |
| Concurrencia | Transiciones de solicitudes y tareas con `SELECT ... FOR UPDATE`; carrera de inserción de lluvia responde 409. | `app/api/v1/solicitudes.py`, `operacion.py`, `app/servicios/lluvia.py` |
| Canales | Firma comparada como bytes (no ASCII: 401), `Content-Length` antes de leer, `timestamp` inválido: 422, cada mensaje se procesa aparte. | `app/api/v1/canales.py` |
| WebSocket | Envíos concurrentes con plazo de 5 s, marcos binarios ignorados, `orden` solo a los alcanzados, logout cierra los sockets del usuario. | `app/core/eventos.py`, `app/api/v1/ws.py` |
| Despliegue | `SEED_DEMO` (apagado por defecto), `ENTORNO=produccion`, base en `127.0.0.1`. | `docker-compose.yml`, `app/config/settings.py` |

## Decisiones y límites conocidos

- **Enumeración de correos:** el registro responde 409 si el correo existe. Es un compromiso de usabilidad; el login no distingue entre correo inexistente, contraseña errónea o cuenta bloqueada (siempre el mismo 401; el 429 es solo del limitador por IP).
- **Bloqueo por cuenta:** resuelto en la Fase 2 con bloqueo por par cuenta e IP (ver más abajo).
- **Truncamiento de la bitácora:** el hash encadenado detecta alteraciones y borrados intermedios, pero no el borrado de las últimas filas; para eso haría falta anclar periódicamente el último hash fuera de la base.
- **Almacenamiento del limitador:** `slowapi` usa memoria del proceso; con varios procesos hay que pasar a Redis.
- **CSRF:** el access token viaja en `Authorization` (no en cookie) y la cookie de refresh es `SameSite=Strict` con ruta restringida, lo que cubre el riesgo en la web.

## Pendiente de la Fase 1

Resuelto: límites de tamaño y tipo de los adjuntos (ver "Fases 3 a 5"). Sigue pendiente: `pip-audit` y análisis estático en CI e inscripción de la base ante la AAIP (fuera del alcance del MVP).


## Fase 2: correcciones de la revisión de la Fase 1 y nuevas medidas

| Área | Medida | Dónde |
|---|---|---|
| Sesiones al cambiar la contraseña | `PATCH /usuarios/{id}` con `password` (o con `estado: inactivo`) **revoca todas las sesiones de refresh activas** del usuario y reinicia sus contadores de bloqueo. Un refresh token robado deja de servir al cambiar la clave. | `app/api/v1/usuarios.py`, `app/core/sesiones.py` |
| Bloqueo por cuenta e IP | Los intentos fallidos se cuentan por par (cuenta, IP) en `intentos_login`; tras `LOGIN_MAX_INTENTOS` ese par se bloquea `LOGIN_BLOQUEO_MINUTOS` y responde 429. Un atacante ya no puede dejar sin acceso a la persona titular fallando a propósito desde otra IP. Se mantiene el rate limit por IP de `slowapi`. | `app/core/bloqueo.py`, `app/api/v1/auth.py` |
| Rotación de refresh | El token se marca como usado con `UPDATE ... WHERE revocado_en IS NULL` y se verifica `rowcount == 1` **antes** de emitir el nuevo. Con dos solicitudes simultáneas con el mismo token, solo una obtiene sesión; la otra entra por la gracia de un solo uso o, si no cumple, se trata como reutilización y revoca la familia. |
| Gracia de refresh (un solo uso, ligada al cliente) | Para el reintento tras perder la respuesta, un token recién rotado admite **un único** reuso dentro de `REFRESH_GRACIA_SEGUNDOS` (30 s como máximo) si: el token no venció, viene del mismo `X-Cliente` y de la misma red (IPv4 o /64) que la rotación y su sucesor sigue activo. El uso se marca con `UPDATE ... WHERE gracia_usada_en IS NULL` (gana una sola solicitud) y el relevo **revoca al sucesor**: nunca hay ramas paralelas. Un segundo reuso, otra red u otro cliente revoca la familia y cierra los WebSockets. Riesgo aceptado: con dos pestañas que refrescan a la vez, la que pierde la carrera usa la gracia y la otra deberá iniciar sesión de nuevo. | `app/core/sesiones.py` (`en_gracia`), `app/api/v1/auth.py` | `app/core/sesiones.py` (`consumir`), `app/api/v1/auth.py` |
| Webhooks de canales | Firma HMAC SHA-256 del cuerpo crudo en `X-Hub-Signature-256` (esquema de Meta), comparación en tiempo constante, tope de 64 KB, secreto `CANAL_HMAC_SECRET` (mínimo 16 caracteres; sin él, 503). Todos los mensajes del lote se validan antes de guardar alguno. | `app/api/v1/canales.py` |
| WebSocket | El token de acceso viaja **solo en el primer mensaje** (nunca en la URL, para que no quede en registros de acceso), con plazo de 5 segundos; sin token válido se cierra con el código 1008. Cada conexión recibe solo los eventos que su rol puede ver. **La autorización se mantiene vigente:** cada conexión guarda el `exp` del token y se cierra con 1008 al vencer (temporizador por conexión y comprobación antes de cada envío); `Difusor.desconectar_usuario` cierra los sockets del usuario al cambiar su contraseña, estado o rol y al detectar reutilización de un refresh. | `app/api/v1/ws.py`, `app/core/eventos.py` |
| Órdenes | Solo el rol `decisor` emite órdenes (403 para el resto); cada orden queda con el rol del emisor, en la bitácora de accesos y con un borrador de bitácora K8. | `app/api/v1/operacion.py` |
| Datos personales | El recomendador cuenta vulnerables por edad y **no descifra** datos de salud; las solicitudes y `/mi/grupo-familiar` registran lecturas en la bitácora de accesos. Un ciudadano solo ve sus solicitudes y notificaciones (404 sobre las ajenas). | `app/servicios/recomendacion.py`, `app/api/v1/mi.py` |
| Subida de la planilla | Tope de 5 MB, comprobación de que el archivo sea un `.xlsx` (firma ZIP), máximo de 5.000 filas y lectura de solo valores (no se evalúan fórmulas). | `app/servicios/lluvia.py` |
| Ruteo | El SQL de `pgr_dijkstra` se arma solo con constantes numéricas de `supuestos.yaml` e ids de sectores validados contra una lista de caracteres; las coordenadas y los ids viajan como parámetros enlazados. | `app/servicios/ruteo.py` |

### Compromiso del bloqueo por cuenta e IP

- **Qué se gana:** la víctima no queda bloqueada por intentos ajenos desde otras IP; el bloqueo por intentos fallidos deja de ser una forma barata de denegar el servicio a una persona conocida.
- **Qué se pierde:** quien adivina contraseñas con muchas IP obtiene `LOGIN_MAX_INTENTOS` intentos por IP. Lo acotan el costo de Argon2, el rate limit por IP y la longitud mínima de contraseña.
- **Cómo se detecta:** cada bloqueo registra un evento `cuenta_bloqueada` con la IP en la bitácora de accesos; muchas IP distintas contra una misma cuenta es la señal.
- **Pendiente:** MFA para los usuarios institucionales.
- Las columnas `usuarios.intentos_fallidos` y `usuarios.bloqueado_hasta` de la Fase 1 ya no se usan en el login (quedan sin efecto; se reinician en el cambio de contraseña).

### Límite por cuenta contra fuerza bruta distribuida

Reglas exactas (`app/core/bloqueo.py`, `app/api/v1/auth.py`):

1. **Clave de red:** IPv4 tal cual; IPv6 agrupada por /64 (quien tiene IPv6 controla todo su /64 y podría rotar de dirección); `::ffff:a.b.c.d` se reduce a IPv4. Vale para el bloqueo por par y para el reconocimiento de redes conocidas.
2. **Par (cuenta, red):** sin cambios; `LOGIN_MAX_INTENTOS` (5) fallos bloquean ese par `LOGIN_BLOQUEO_MINUTOS` (15) y responde 429.
3. **Cuenta (ventana deslizante):** si la cuenta suma `LOGIN_CUENTA_MAX_FALLOS` (20) eventos `login_fallido`/`cuenta_bloqueada` en los últimos `LOGIN_CUENTA_VENTANA_MINUTOS` (15), todo intento desde una red **sin** evento `login_ok` de esa cuenta en los últimos `LOGIN_IP_CONOCIDA_DIAS` (30) recibe 429, acierte o no la contraseña (sin oráculo), se registra `login_bloqueado_cuenta` y no suma fallos. Las redes conocidas siguen el flujo normal (una contraseña correcta entra). El bloqueo cede solo al salir los fallos de la ventana.
4. Los datos salen de `auditoria_accesos` (sin tabla nueva; índice `ix_auditoria_usuario_accion_fecha`, migración 0003).

Compromisos:

- **Cota:** un atacante distribuido obtiene a lo sumo ~20 intentos por ventana de 15 minutos por cuenta (antes, 5 por IP sin tope), más lo que acote Argon2 y el rate limit por IP.
- **Disponibilidad:** quien provoca 20 fallos desde muchas IP impide el ingreso de la titular **desde una red nueva** (viaje, cambio de operador) hasta que pase la ventana; no afecta a su red habitual. Si repite el ataque sostiene el bloqueo. Es el costo elegido frente a dejar la cuenta expuesta a adivinación distribuida.
- **Historial de redes:** una red con login correcto previo (30 días) queda como conocida aunque después se cambie la contraseña; la IP se toma de la conexión TCP (no se confía en `X-Forwarded-For`; tras un proxy inverso hay que configurar la IP real del cliente).
- **Retardo progresivo:** no se implementó; el 429 temporal con ventana deslizante cumple el mismo fin con menos estado.
- **Carrera:** intentos simultáneos justo en el umbral pueden exceder levemente el límite (la lectura de la ventana no es transaccional).
- **Detección:** eventos `cuenta_bloqueada` y `login_bloqueado_cuenta` en la bitácora.

## Fases 3 a 5: panel, portal y app móvil

| Área | Medida | Dónde |
|---|---|---|
| Adjuntos de solicitudes | Solo `image/jpeg`, `image/png` y `image/webp`; el tipo se determina por los primeros bytes del archivo (no se confía en el `Content-Type` declarado; otro tipo responde 415); tope de `ADJUNTO_MAX_BYTES` (2 MB, 413) y de `ADJUNTOS_MAX_POR_SOLICITUD` (5, 409); el archivo se guarda con nombre generado (`<n>.<ext>`), nunca con el nombre del cliente; la descarga exige ser dueño de la solicitud o rol operativo. | `app/api/v1/solicitudes.py` |
| Idempotencia | `POST /solicitudes` acepta `Idempotency-Key` (UUID); un reintento tras una respuesta perdida devuelve la solicitud ya creada en lugar de duplicarla. | `app/api/v1/solicitudes.py` |
| Token en la web | El access token vive solo en memoria (nunca en `localStorage` ni `sessionStorage`); en `localStorage` solo queda una marca booleana de "hubo sesión" para intentar el refresh por cookie. El refresh viaja en cookie `HttpOnly`. | `apps/frontend/src/lib/api.ts`, `src/auth/AuthContext.tsx` |
| Token en la app | Access y refresh en `expo-secure-store`; nada sensible en `AsyncStorage` ni en SQLite (la cola offline guarda solicitudes, no credenciales). | `apps/mobile/src/lib/almacenSeguro.ts` |
| Rutas privadas | La web redirige por rol (`RutaProtegida`); el control efectivo está siempre en el backend (RBAC), no en la interfaz. | `apps/frontend/src/auth/RutaProtegida.tsx` |
| Órdenes | El formulario de órdenes se deshabilita para el operador y exige confirmación al decisor; el backend responde 403 a cualquier otro rol. | `apps/frontend/src/panel/paginas/Ordenes.tsx`, `app/api/v1/operacion.py` |
| Datos de la web sin secretos | Los JSON estáticos de `src/datos/` y `public/capas/` solo contienen datos del kit y capas oficiales; ninguna clave ni dato personal. La clave de Google Maps del APK se lee al compilar desde una variable de entorno. | `apps/frontend/scripts/preparar-datos.mjs`, `apps/mobile/app.config.ts` |

### Servidor configurable y tráfico HTTP en el APK

- La app móvil permite elegir en tiempo de ejecución la URL del backend (pantalla de bienvenida y Perfil) para que un solo APK funcione en cualquier red. La URL no es un secreto; se guarda con `expo-secure-store`. Se valida (solo `http(s)://`) y se normaliza.
- Cambiar de servidor con la sesión abierta cierra la sesión local (los tokens pertenecen al otro servidor) y la cola offline solo se conserva si el usuario lo elige.
- **Compromiso:** el backend de una red local se atiende por `http://`, por lo que el APK habilita tráfico sin cifrar (`android.usesCleartextTraffic = true`, plugin `expo-build-properties` en `apps/mobile/app.json`). En una red Wi-Fi compartida, credenciales y datos de la persona podrían ser interceptados. Es aceptable solo para el prototipo en una LAN controlada y con datos de demostración. **En producción debe usarse HTTPS** (certificado válido) y quitar `usesCleartextTraffic`; la app ya admite `https://` y `wss://`.
- El campo «Servidor» permite apuntar la app a otro host: un atacante con acceso físico al teléfono desbloqueado podría redirigirla.

#### Hallazgos de la revisión de seguridad automatizada y mitigaciones (APK)

| # | Hallazgo | Mitigación aplicada | Riesgo residual |
|---|---|---|---|
| 1 | **Tráfico sin cifrar habilitado en toda la app** (`usesCleartextTraffic = true`), necesario para el backend de la LAN de la demo. | La pantalla «Conexión» (a la que se llega desde la bienvenida, desde Perfil y desde los errores de conexión del login y el registro) muestra una advertencia (rol `alert`, anunciada por lectores de pantalla): «Conexión sin cifrar (http). Tu contraseña viaja sin protección: usala solo en la red de la demo y con datos de prueba.». Con `https://` no aparece. La misma advertencia se ve en «Servidor» al escribir una URL `http://`. | El APK sigue aceptando `http://` hacia cualquier host: la advertencia informa, no impide. |
| 2 | **El ajuste de servidor de la bienvenida permite redirigir las credenciales a cualquier host.** | (a) Por decisión de diseño del equipo (19/11/2026), login y registro ya no muestran el servidor: la configuración vive en la pantalla «Conexión», con el servidor vigente a la vista; si falta el servidor o no hay conexión, el error ofrece «Configurar conexión». (b) Guardar una URL `http://` hacia un host **público** (IP o dominio fuera de 10/8, 172.16/12, 192.168/16, 127/8 y localhost) exige confirmar «Entiendo el riesgo»; las redes privadas solo muestran la advertencia. (c) Se rechazan URL con credenciales embebidas (`http://192.168.1.1@otro.host`), que disfrazarían el host real. (d) Cambiar de servidor con sesión abierta la cierra. | Quien tenga el teléfono desbloqueado puede cambiar el servidor y confirmar el riesgo; un usuario poco atento puede ignorar la advertencia. Un host con nombre de red privada controlado por un atacante en la misma LAN no se distingue de la demo. |

Archivos: `apps/mobile/src/lib/servidor.ts` (`esHostPrivado`, `requiereConfirmarRiesgo`), `src/components/ServidorEnUso.tsx` (`AvisoHttp`), `src/components/ConfigServidor.tsx`, `src/app/conexion.tsx`, `src/components/EnlaceConexion.tsx`, `src/app/login.tsx`, `src/app/registro.tsx`. Pruebas: `src/__tests__/credenciales.test.tsx` y `servidor.test.tsx`.

**Requisito para producción (no cumplido por el prototipo):** servicio solo por HTTPS con certificado válido; quitar `usesCleartextTraffic` (y, si hace falta, restringirlo con una `network_security_config` a los dominios necesarios); fijar el servidor (o una lista cerrada) en la compilación y **ocultar el ajuste «Servidor»** en las compilaciones de producción, de modo que las credenciales solo puedan enviarse a un host autorizado.

Correspondencia adicional con OWASP: A04 (idempotencia y límites de adjuntos), A05 (tipos y tamaños de archivo acotados), A08 (nombres de archivo generados por el servidor), A02 (tráfico sin cifrar aceptado solo en el prototipo en LAN).

## Constancias de evacuación (Ley 25.326)

- **Finalidad exclusiva de emergencia.** El destino, el origen y las fotos de una evacuación se usan solo para verificar el traslado; la confirmación del evacuado se pide, no se impone, y la ausencia de respuesta no bloquea nada.
- **Acceso mínimo.** `GET /evacuaciones`, `GET /tareas/{id}/constancia` y las fotos solo los leen `operador`, `decisor`, `admin` y la cuadrilla de esa tarea (otra cuadrilla: 403). La ciudadanía solo ve su propia consulta (`/mi/confirmaciones`) con el nombre del centro, nunca ubicaciones; solicitud o código ajenos dan 404 (no se revela si existen). El bloque `evacuaciones` de `/panel/resumen` y los eventos WebSocket `constancia` y `discrepancia` llevan solo agregados e ids.
- **Bitácora de accesos.** Cada lectura de evacuaciones, constancias y fotos registra `lectura_datos_personales`; el cierre (`tarea_cerrada_con_constancia`), la subida de fotos (`adjunto_subido`) y la respuesta del evacuado (`confirmacion_evacuado`) también, con hash encadenado.
- **Fotos.** Mismas reglas que los adjuntos de solicitudes: validación por firma del contenido (JPEG, PNG, WebP), tope por archivo y por constancia, SHA-256 para no duplicar, nombre generado por el servidor y descarga con `Cache-Control: private, no-store` y `nosniff`. La guía para la cuadrilla es fotografiar el **lugar o el transporte, no caras ni menores**; el sistema no puede verificarlo automáticamente, por lo que queda como instrucción de uso. No hay tope de almacenamiento por persona para el personal operativo (sí lo hay para ciudadanía en las solicitudes).
- **Discrepancia = marca para revisar.** Una evacuación `con_discrepancia` (el evacuado dijo `no` o `problema`, o el destino queda lejos del centro) se notifica a los operadores con el texto "no es una acusación"; ninguna cuenta se sanciona ni se bloquea por ello.
- **SMS con código (ligado al teléfono).** La respuesta por SMS solo tiene efecto si el código existe, no venció (`vigencia_codigo_horas`, SUPUESTO 72 h) y el remitente coincide con el teléfono registrado del solicitante (cifrado en el grupo familiar; se descifra en el servidor y se compara por los últimos 10 dígitos). Sin teléfono registrado o con otro remitente no pasa nada. El código tiene 8 caracteres de un alfabeto sin ambigüedades (con al menos un dígito). **Sin oráculo:** la respuesta es siempre la misma ("Recibimos tu respuesta. Si corresponde a un pedido tuyo, la vamos a registrar.") exista o no el código, coincida o no el remitente. **Límites sin bloquear al titular** (conteo atómico: candado de transacción `pg_advisory_xact_lock` por clave): contra un código existente, 5 fallos por hora por (remitente, código) y 10 por código sumando remitentes, tras lo cual el código queda invalidado para SMS (`confirmacion_sms_codigo_invalidado`; la app no se afecta y el operador reabre con uno nuevo); contra códigos inexistentes, 20 por hora por remitente (`confirmacion_sms_bloqueada`), que nunca frena un código válido desde el teléfono registrado. Todos son SUPUESTO en `supuestos.yaml`. Remitente y código se registran **seudonimizados con HMAC-SHA256** (clave derivada con HKDF de `FIELD_ENCRYPTION_KEY`; nunca el número ni el código en claro) y la clave de límite usa la misma forma canónica que la comparación (últimos 10 dígitos). Una respuesta equivocada la corrige un operador con `POST /evacuaciones/{tarea_id}/confirmacion/reabrir` (auditado, genera un código nuevo). Límite conocido: el número del remitente lo informa el proveedor del canal; con el canal real hay que confiar en la autenticidad que garantice (firma del webhook) y un SMS puede suplantarse en la red móvil, por eso la respuesta no desbloquea nada sensible y las discrepancias son solo una marca para revisar.
- **Idempotencia.** El cierre exige `Idempotency-Key` (índice único parcial por usuario y clave): un reintento de la cola offline no duplica constancias ni consultas de confirmación.
- Todo dato de demostración es `SIMULADO`; no hay personas reales.

## Seguimiento de la cuadrilla (Ley 25.326)

- **Finalidad exclusiva.** La posición de la cuadrilla se comparte solo para que quien pidió ayuda sepa que viene en camino y para que el mando coordine. La app de la cuadrilla envía la posición con el interruptor "Compartiendo tu ubicación" encendido y solo con la pantalla abierta (primer plano, sin permiso de segundo plano); se puede pausar en cualquier momento.
- **Solo mientras hay una tarea en curso.** `POST /cuadrillas/mi-posicion` responde 409 si la cuadrilla no tiene una tarea `en_curso`. La tabla `posiciones_cuadrilla` guarda **una sola fila por cuadrilla** (la última posición; no hay historial ni trazas) y se borra cuando la cuadrilla cierra o cancela su última tarea en curso. Además, las lecturas solo devuelven posiciones de cuadrillas con una tarea en curso.
- **Vencimiento (auditoría del 20/11/2026).** Una posición sin actualizar por más de `posicion_vencida_minutos` (30 min, SUPUESTO) **vence**: nunca se devuelve con coordenadas, ni a quien pidió la ayuda (el pedido figura como `asignada_sin_posicion` con `posicion_vieja: true`, sin distancia ni llegada) ni al panel operativo (la cuadrilla no aparece en `GET /cuadrillas/posiciones`). La fila vencida se borra en la siguiente lectura (`/mi/seguimiento`, `/mi/pedidos`, `/cuadrillas/posiciones`) sin tarea programada; las lecturas filtran por antigüedad, así que una fila no purgada tampoco se muestra. Antes, la última posición quedaba visible mientras la tarea siguiera en curso aunque la cuadrilla hubiera dejado de compartir.
- **Primer envío simultáneo.** El alta de la fila usa `INSERT ... ON CONFLICT DO NOTHING`: si dos envíos llegan juntos, uno guarda y el otro recibe 429 (antes, un 500 por clave duplicada).
- **Saltos inverosímiles (no implementado).** El servidor no rechaza una posición que implique una velocidad imposible respecto de la anterior: el GPS de un teléfono puede saltar cientos de metros al pasar de ubicación por red a satélite y un rechazo dejaría a la cuadrilla sin poder compartir en plena demo. Como la posición solo informa (no habilita nada) y la ve solo quien pidió ayuda y los mandos, se acepta el riesgo; la mitigación futura es descartar saltos por encima de una velocidad máxima SUPUESTO y avisar a la cuadrilla.
- **Quién la ve.** Solo la persona que pidió esa ayuda (`GET /mi/seguimiento` filtra por solicitante: el pedido de otra persona no aparece) y los roles `operador`, `decisor` y `admin` (`GET /cuadrillas/posiciones`, auditado como `lectura_ubicacion_cuadrillas`). El evento WebSocket `posicion_cuadrilla` llega solo a esos tres roles y no lleva coordenadas. La cuadrilla se identifica por tipo y roles del catálogo, no por nombres de personas.
- **Límite de frecuencia.** Una posición cada 10 s por cuadrilla (429 si se excede; SUPUESTO `intervalo_min_posicion_s`), con la fila bloqueada para que envíos simultáneos no se salteen el límite.
- **Honestidad sobre la estimación.** La distancia y la llegada son una estimación (línea recta por factor de desvío y velocidad media, SUPUESTO) y se avisa cuando la posición tiene más de 5 minutos. No se presenta como promesa de llegada.
- **Límite conocido.** La posición reportada la informa el teléfono de la cuadrilla: el servidor valida el rango, no la veracidad. En la demo todo es `SIMULADO`; no hay personas reales.

## Portal web: CSP y teselas de OpenStreetMap (privacidad)

- **Teselas de terceros.** Los mapas de la web (elegir la ubicación del domicilio en el registro, «Mi cuenta» y el fondo opcional del panel) piden las imágenes a `tile.openstreetmap.org`. Cada pedido revela a la Fundación OpenStreetMap la **IP** de quien mira y la **zona** (`z/x/y`), que en el registro puede coincidir con su casa. No se envía ningún dato de la cuenta. Mitigaciones: `<meta name="referrer" content="strict-origin-when-cross-origin">` en `apps/frontend/index.html` (OSM recibe solo el origen del portal como `Referer`, nunca la ruta; no se usa `no-referrer` porque la política de uso de OSM exige un `Referer` válido) y el pie del mapa de registro lo avisa. En el panel el fondo OSM es opcional y está apagado si no hay internet. **Para producción:** servir teselas propias o de un proveedor con acuerdo de tratamiento de datos.
- **Content-Security-Policy.** El `index.html` del build (`vite build`, también `vite preview`) lleva un `<meta http-equiv="Content-Security-Policy">` generado por `vite.config.ts` con `src/lib/csp.ts`: `default-src 'self'`; scripts propios más los 4 scripts en línea de `@vitejs/plugin-legacy` **por hash** (sin `'unsafe-inline'` ni `'unsafe-eval'`); `style-src 'unsafe-inline'` (Chakra/Emotion inyecta estilos); `connect-src` limitado al backend de `VITE_API_URL` (HTTP y WebSocket) y a las teselas de OSM; `img-src` con `data:`/`blob:` y OSM; `worker-src blob:` (MapLibre); `object-src 'none'`; `base-uri` y `form-action` `'self'`. Una prueba (`csp.test.ts`) fija las directivas y en la auditoría se comprobó que los hashes cubren los scripts en línea del build. **Límites:** en `vite dev` no se aplica (el servidor de desarrollo inyecta scripts en línea para la recarga en caliente); `frame-ancestors` no puede ir en un `<meta>` y debe enviarlo el servidor web que publique el build; si el portal se compila con un `VITE_API_URL` y el backend se sirve en otro origen, hay que recompilar.

## Pendiente (documentado como hoja de ruta)

- MFA para usuarios institucionales y desbloqueo por OTP o correo (ver `docs/decisiones.md`).
- `pip-audit`, `pnpm audit` y análisis estático en la integración continua.
- Límite de conexiones WebSocket por usuario.
- Almacenamiento del limitador en Redis si se despliega con más de un proceso.
- Anclar periódicamente el último hash de la bitácora de accesos fuera de la base.
- Inscripción de la base ante la AAIP y despliegue productivo (fuera del alcance del MVP, CLAUDE.md §15).
- Push remoto (FCM): requiere development build y credenciales.
