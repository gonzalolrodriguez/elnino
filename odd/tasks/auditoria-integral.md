# Auditoría integral · bugs, UX, seguridad y canales sin datos

**Objetivo:** corregir los defectos y riesgos que encontraron las 5 auditorías de solo lectura del 19/11/2026, sin sumar fricción para la ciudadanía (que tiene poca o ninguna conectividad). Además, sumar lo que entra antes de la entrega del sábado 21/11 10:00:
- tablero de decisión para mandos y admin con datos existentes;
- reporte sin datos, simulado de punta a punta;
- guía offline estática.

**Autorización del usuario (19/11, noche):** "andá aplicando los cambios siempre que pasen los tests; si te quedás sin tokens, seguimos luego".
**Límite de esa autorización:**
- Commits locales en `rediseno-v2`.
- Sin merge, sin tag y sin push hasta que el usuario revise.
- Quedan sin tocar las decisiones de producto: IA en la nube o local, STT real, canales reales, recuperación de contraseña, MFA y sesión por dispositivo.

**Flujo:** ODD, sin TDD (memoria `flujo-odd-tests-al-final`). Cada escritor corre las verificaciones de su área y solo se commitea lo que queda en verde.

## Tareas

| ID | Tarea | Ruta | Estado |
|---|---|---|---|
| A1 | Web: bugs de sesión. Doble refresh en StrictMode o con varias pestañas; logout por errores de red o 5xx; 401 sin renovar y reintentar. | escritor web | Hecho |
| A2 | Web: bugs del panel. Simulador desactualizado, borrador de bitácora, idempotencia de órdenes, toasts, backoff del WS, guardarArchivo, admin que se desactiva a sí mismo, fallback 2D si falla la malla, bucle del hero. | escritor web | Hecho |
| A3 | Web: UX. "Usted" a voseo; códigos crudos a etiquetas legibles; "Pedir ayuda" y "Mi sector" en `/mi-cuenta`; copy de `/app`; login automático tras registrarse; botón de ubicación primero. | escritor web | Hecho |
| A4 | Web: `maplibre-gl` al parche (crítico de `pnpm audit`); revisar los avisos de react-router. | escritor web | Hecho |
| A5 | Web: hero 3D interactivo. Arrastrar, zoom y giro acotados; recorrido del río con barra, reproducir y atajos a los hitos; volver a la vista inicial; sin secuestrar el scroll. | escritor web | Hecho |
| B1 | App: cola offline. Foto inexistente, `hayRed` en LAN sin internet, duplicado al encolar, máximo de intentos, purga de enviadas, segunda pasada del vaciado, límites de personas y animales. | escritor mobile | Hecho |
| B2 | App: otros bugs. FormGrupoFamiliar que pisa datos, Solicitudes desactualizadas, orden servidor/sesión en ConfigServidor, especie en el SMS, `&body=` de iOS, cámara cancelada, WS (try/catch y reconexión), checklist de canceladas, categoría en el mapa. | escritor mobile | Hecho |
| B3 | App: UX sin conectividad. En bienvenida, "Pedir ayuda sin cuenta" (SMS armado) y "Llamar al 103"; "¿Sin datos? Enviar por SMS" visible en Asistencia; aviso a mandos de que su panel está en la web; guía offline estática (qué hacer y a quién llamar). | escritor mobile | Hecho |
| C1 | Backend: seguridad de baja fricción. Gracia de refresh, 401 genérico, cuota blanda de solicitudes, `compare_digest` en bytes, tope de cuerpo y de largo del checklist, auditoría de correos inexistentes, seed demo por variable, DB en 127.0.0.1. | escritor backend | Hecho (1819569, 950b58d, 6f65f49) |
| C2 | Backend: bugs de la auditoría de backend. | escritor backend | Hecho (d882998) |
| C3 | Backend: `GET /panel/resumen` y `GET /admin/resumen`; normalizador de texto libre para el SOS, ubicación por referencia, menú de palabras clave por SMS, guion de IVR. | escritor backend | Hecho (d882998) |
| D1 | Web: tablero de decisión (decisor/operador) y tablero de admin con esos endpoints. | escritor web (después de C3) | Hecho (e3ea6dc) |
| E1 | Docs: `seguridad.md` a OWASP 2025 y Mobile 2024; ficha de fuentes y contrato API actualizados. | inline/escritor | Hecho para backend (1c55bfc); falta ficha_fuentes |

## Evidencia

- Auditorías (solo lectura) recibidas: UX/IA, seguridad (OWASP 2025, sin edición 2026 oficial), bugs web/mobile (31 confirmados), canales/IA (MVP y decisiones del equipo). Bugs de backend: en curso.
- App B1-B3 hechos (commits a12f7d8 y 243c68e); B4 (5793f4e y b2d16cb): etiquetas, Estado de tu sector con caché SQLite, pestaña Monitor (operador/decisor, solo lectura, `GET /panel/resumen` con caché offline y categorías), `referencia_ubicacion` enviada como campo propio (omitida si está vacía), banderas `ubicacion_aproximada`/`requiere_verificacion` en Mis solicitudes y ayuda por SMS libre (AYUDA/INFO). Pendiente de verificar contra el backend: `SolicitudIn` (extra=forbid) aún no declara `referencia_ubicacion`, por lo que enviarla da 422 hasta que se agregue; el GPS sigue siendo obligatorio (lon/lat requeridos). Verificación en apps/mobile: tsc sin errores, jest 193/193, expo export android correcto. Sin copia de la foto al directorio de documentos (expo-file-system no es dependencia directa).
- Web A1-A5 hechos (commits 54223e2, 47f2592, db53917, 6b927fa y el de A5). Verificación en apps/frontend: tsc sin errores, eslint sin avisos, vitest 14 archivos en verde, build correcto. A4: maplibre-gl 6.16.0 (la versión parcheada es 6.4.1 o superior; la 6.x más reciente con más de 2 semanas); react-router solo se corrige en 7.18, no se migró (aviso moderado abierto). A2/A3: la ciudadanía recibe `Idempotency-Key` en pedidos y órdenes (el backend de órdenes aún debe respetarlo). A5: no se pudo comprobar la escena 3D en navegador (Edge headless sin WebGL); se revisó el diseño del panel en 390/1024/1440 sin superposición con titular, CTA ni panel de altura.
- Backend C1-C3 hechos. Commits: 1819569, 950b58d y 6f65f49 (C1 y gracia de refresh de un solo uso, atómica); d882998 (C2 y C3, una sola unidad de código); 1c55bfc (docs). Verificación en apps/backend: `ruff check .` sin errores; `pytest -q` 250 pasadas; migraciones 0004 y 0005 aplicadas a la base en marcha (docker compose up -d --build backend); `GET /api/v1/salud` responde ok.
- C4 (centros en escuelas reales del Mapa Educativo y puestos de lluvia en localidades BAHRA) no se hizo: `data/geo/establecimientos_educativos.geojson` y `localidades_parajes.geojson` existen, pero la semilla sigue usando `data/simulado/centros_recepcion.json` y `puestos_pluviometricos.json` con coordenadas inventadas. Queda como brecha D7 documentada.
- Web D1 hecho (e3ea6dc). `/comando` es el Tablero (decisor: río frente a 7,80 y 8,30 m con tendencia y tiempo restante con su supuesto, 4 tarjetas de sector, pedidos por estado/sector/canal, centros, cuadrillas, órdenes y borradores de bitácora, lluvia 7 días, frescura; operador: cola de pedidos filtrable primero, accesos cerrados y cuadrillas libres, río en una línea). El Monitor pasó a `/comando/rio`. Menú agrupado (Situación, Respuesta, Análisis, Registro) con nombres corrientes; aviso persistente "Escenario activo" con "Volver a observado"; `/admin` con tablero (usuarios por rol y estado, bloqueos, inactivos, integridad de la auditoría, servicio) y lista con filtros y paginación. Se refresca cada 60 s y con eventos de tiempo real (agrupados cada 2 s); el bloque `evacuaciones` se muestra solo si llega. Verificación en apps/frontend: tsc sin errores, eslint sin avisos, vitest 15 archivos / 178 pruebas en verde (15 nuevas en `tablero.test.tsx`), build correcto. No verificado: capturas de pantalla de rutas con sesión (sin credenciales ni WebGL), y contra el backend en marcha. Límites: el panel no puede desbloquear cuentas (no hay endpoint); la lista de usuarios filtra y pagina en el cliente sobre los primeros 200.
- Cambio de contrato: el login responde siempre 401 genérico (los bloqueos ya no dan 429; el 429 es solo del limitador por IP con Retry-After).
