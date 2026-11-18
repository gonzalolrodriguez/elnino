# Fase 5 · App móvil

**Objetivo:** app Expo (React Native) multi-rol, offline-first, conectada al backend real (CLAUDE.md §5.5, §6, §8.7, §8.10, §13 Fase 5).
**Criterio de aceptación (§13):** una solicitud creada sin conexión se sincroniza y aparece en el panel; una orden emitida llega como notificación.
**Alcance de propiedad:** solo `apps/mobile/**` y este archivo. Cambios en archivos compartidos se piden al coordinador.
**TDD:** desactivado (preferencia del usuario); código y pruebas primero, una sola verificación al final. Runner: jest-expo.
**Commits:** no se realizan; los gestiona el coordinador.

## Tareas
- [x] M5.1 Infraestructura: dependencias Expo SDK 58, jest-expo, cliente API, almacenamiento seguro, sesión con refresh rotativo
- [x] M5.2 Bienvenida, registro (consentimiento Ley 25.326) y login; leyenda fija en toda pantalla, modales y carga
- [x] M5.3 Perfil: grupo familiar (ciudadano) y establecimiento + stock (productor) vía `/mi/*`
- [x] M5.4 Solicitud de asistencia: GPS, tipo, personas, animales, foto, texto; codificador SOS-FSA puro
- [x] M5.5 Cola offline en expo-sqlite: encolado, reintentos con backoff, indicador de pendientes, envío en dos tiempos
- [x] M5.6 Mis solicitudes y su estado
- [x] M5.7 Alertas y órdenes (`/mi/notificaciones`), marcar leída, notificación local por WebSocket y polling
- [x] M5.8 Mapa del sector y centro asignado (`/mi/sector`, react-native-maps)
- [x] M5.9 Modo cuadrilla (`/tareas`, checklist, cambio de estado), oculto para otros roles
- [x] M5.10 Pruebas (jest) y verificación final

## Ruta
Escritura de 2+ archivos no triviales: un escritor único (este agente, delegado por el coordinador).

## Brechas de API detectadas
- No existe endpoint de adjuntos: la foto se comprime y se conserva localmente; no se envía.
- `POST /solicitudes` no admite clave de idempotencia: un reintento tras un timeout con respuesta perdida puede duplicar la solicitud.

## Evidencia
- `pnpm --filter @evacuaciones/mobile typecheck`: sin errores.
- `jest` (jest-expo): 5 suites, 29 tests en verde.
- `npx expo-doctor`: 20/20 checks passed.
- `npx expo export --platform android`: bundle Hermes generado (1315 módulos).
- No ejecutado en dispositivo ni emulador: pendiente de prueba en teléfono real.
