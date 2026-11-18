# Decisiones del proyecto

Registro de decisiones confirmadas por el equipo el 2026-11-17 (Fase 0). Todas las propuestas por defecto de CLAUDE.md §1.2 fueron aceptadas.

| # | Tema | Decisión confirmada |
|---|---|---|
| P1 | Estructura del monorepo | `apps/frontend`, `apps/mobile` (Expo), `apps/backend` (FastAPI) y `packages/shared` (constantes y, más adelante, tipos y cliente API generados desde OpenAPI). |
| P2 | Web | React 18 + TypeScript + Vite + Chakra UI + Framer Motion. React Three Fiber + Drei (landing) y MapLibre GL JS + Deck.gl (panel) se incorporan en fases posteriores. |
| P3 | App móvil | Expo + TypeScript + expo-router; mapas con `react-native-maps`, cola offline con `expo-sqlite`, tokens en `expo-secure-store`; APK con EAS Build (perfil `preview`). |
| P4 | Backend y base | FastAPI + PostgreSQL 16 + PostGIS + pgRouting con `docker-compose`; migraciones con Alembic (Fase 1). |
| P5 | Datos posteriores al corte | Apagados por defecto (`PERMITIR_DATOS_POST_CORTE=false`). Se muestra el dato del corte (Puerto Formosa 5,60 m, `DATO OBSERVADO`, 31/10/2026). |
| P6 | Canales (WhatsApp, SMS, IVR) | Simulados con lógica real (mismo formato y parser que el canal real). |
| P7 | Notificaciones | Web: centro de notificaciones + WebSocket. Móvil: notificaciones locales; push remoto como fase opcional. |
| P8 | Lluvia | Partes policiales y cargas manuales, importación de la planilla UPCA y deslizador `SIMULADO` en el simulador. |
| P9 | Índice ISAD | Índice relativo rotulado `SIMULADO`, con pesos configurables; el disparador oficial es la altura de compromiso de K10. |
| P10 | Ruteo | pgRouting sobre red vial OSM/IGN recortada al corredor, con aristas bloqueables. |
| P11 | Reparto del equipo | (1) backend + datos + seguridad, (2) panel operativo web, (3) landing 3D + registro web, (4) app móvil. |
| P12 | Chacras y campos reales | Opción (b): productores ficticios ubicados en el punto del paraje real, sin parcela. |

## Decisiones técnicas de la Fase 0

- Gestor de paquetes: pnpm con workspaces y `node-linker=hoisted` (compatibilidad con Metro/Expo).
- Imagen de base de datos: `pgrouting/pgrouting:16-3.4-3.6.1` (PostgreSQL 16 con PostGIS y pgRouting; etiqueta verificada).
- La web usa React 18 (Chakra UI v2); la app móvil usa la versión de React que exige el SDK de Expo vigente (19.x). Cada paquete declara su propia versión.
- Dependencias del backend fijadas en `requirements.txt` y `requirements-dev.txt`.
