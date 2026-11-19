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
| A1 | Web: bugs de sesión. Doble refresh en StrictMode o con varias pestañas; logout por errores de red o 5xx; 401 sin renovar y reintentar. | escritor web | Pendiente |
| A2 | Web: bugs del panel. Simulador desactualizado, borrador de bitácora, idempotencia de órdenes, toasts, backoff del WS, guardarArchivo, admin que se desactiva a sí mismo, fallback 2D si falla la malla, bucle del hero. | escritor web | Pendiente |
| A3 | Web: UX. "Usted" a voseo; códigos crudos a etiquetas legibles; "Pedir ayuda" y "Mi sector" en `/mi-cuenta`; copy de `/app`; login automático tras registrarse; botón de ubicación primero. | escritor web | Pendiente |
| A4 | Web: `maplibre-gl` al parche (crítico de `pnpm audit`); revisar los avisos de react-router. | escritor web | Pendiente |
| B1 | App: cola offline. Foto inexistente, `hayRed` en LAN sin internet, duplicado al encolar, máximo de intentos, purga de enviadas, segunda pasada del vaciado, límites de personas y animales. | escritor mobile | Hecho |
| B2 | App: otros bugs. FormGrupoFamiliar que pisa datos, Solicitudes desactualizadas, orden servidor/sesión en ConfigServidor, especie en el SMS, `&body=` de iOS, cámara cancelada, WS (try/catch y reconexión), checklist de canceladas, categoría en el mapa. | escritor mobile | Hecho |
| B3 | App: UX sin conectividad. En bienvenida, "Pedir ayuda sin cuenta" (SMS armado) y "Llamar al 103"; "¿Sin datos? Enviar por SMS" visible en Asistencia; aviso a mandos de que su panel está en la web; guía offline estática (qué hacer y a quién llamar). | escritor mobile | Hecho |
| C1 | Backend: seguridad de baja fricción. Gracia de refresh, 401 genérico, cuota blanda de solicitudes, `compare_digest` en bytes, tope de cuerpo y de largo del checklist, auditoría de correos inexistentes, seed demo por variable, DB en 127.0.0.1. | escritor backend | Pendiente (espera la auditoría de backend) |
| C2 | Backend: bugs de la auditoría de backend. | escritor backend | Pendiente |
| C3 | Backend: `GET /panel/resumen` y `GET /admin/resumen`; normalizador de texto libre para el SOS, ubicación por referencia, menú de palabras clave por SMS, guion de IVR. | escritor backend | Pendiente |
| D1 | Web: tablero de decisión (decisor/operador) y tablero de admin con esos endpoints. | escritor web (después de C3) | Pendiente |
| E1 | Docs: `seguridad.md` a OWASP 2025 y Mobile 2024; ficha de fuentes y contrato API actualizados. | inline/escritor | Pendiente |

## Evidencia

- Auditorías (solo lectura) recibidas: UX/IA, seguridad (OWASP 2025, sin edición 2026 oficial), bugs web/mobile (31 confirmados), canales/IA (MVP y decisiones del equipo). Bugs de backend: en curso.
- App B1-B3 hechos (commits a12f7d8 y 243c68e); B4 parcial (5793f4e): etiquetas, Estado de tu sector con caché SQLite, referencia dentro del texto. Pendientes B4: referencia_ubicacion como campo propio (el backend aún no lo tiene) y pestaña Monitor (falta `GET /panel/resumen`). Verificación en apps/mobile: tsc sin errores, jest 180/180, expo export android correcto. Sin copia de la foto al directorio de documentos (expo-file-system no es dependencia directa).
