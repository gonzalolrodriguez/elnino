# Fase 6 · Entrega

**Objetivo:** dejar el repositorio listo para la evaluación del 21/11/2026: fichas, contrato API, seguridad, arquitectura, README reproducible y prueba desde clonado limpio. Tag evaluable `v1.0-entrega` (preparado, no ejecutado).
**Criterio de aceptación (CLAUDE.md §13):** lista de entrega de §3 completa y requisitos técnicos de `07_Entrega_Tecnica_Software.pdf`.
**Flujo:** ODD, sin TDD; una sola verificación al final. Sin commits ni tags (los gestiona el coordinador).
**Rama:** `fase-6-entrega`.
**Ruta:** un escritor único (delegado por el coordinador) para documentación y README; la prueba de clonado limpio se corre en un directorio temporal fuera del repositorio.

## Criterio de aceptación: lista de entrega

### CLAUDE.md §3 · Entregables
| Entregable | Estado |
|---|---|
| `docs/ficha_tecnica.md` (vence vie 20/11, 18:00) | hecho (T6.1); falta revisión humana |
| `docs/ficha_fuentes.md` | hecho (T6.2); quedan afirmaciones cualitativas sin fuente verificada, declaradas en el documento |
| `docs/registro_limpieza.md` | hecho (T6.3), cumple la plantilla |
| Monorepo con commit/tag evaluable | pendiente humano (T6.7: merge y tag) |
| Póster | pendiente humano |
| Pitch de 3 minutos | pendiente humano |
| Video MP4 de 120 s o menos | pendiente humano |
| APK (EAS Build) | pendiente humano (requiere cuenta de Expo y clave de Google Maps) |
| Revisión visual en navegador y en teléfono | pendiente humano |

### `07_Entrega_Tecnica_Software.pdf`
| Requisito | Estado |
|---|---|
| Frontend y backend en directorios identificables (`apps/frontend`, `apps/backend`) | hecho |
| README: requisitos y versiones, instalación, arranque, puertos, prueba del flujo principal | hecho (T6.5), validado con clonado limpio (T6.6) |
| `.env.example` | existe (no se modificó: regla de permisos) |
| Esquema y datos de demo | hecho: `alembic upgrade head` + `python -m app.db.seed`; el contenedor lo hace al iniciar |
| Contrato frontend–backend con ejemplo reproducible | `docs/contrato_api.md` + `docs/openapi.json` (T6.4) |
| Validación de entradas en backend | hecho (Fases 1 y 2) |
| Estados de carga, vacío y error en la UI | hecho (Fases 3 a 5) |
| Prueba del flujo principal y de una entrada inválida | hecho (README, "Verificación rápida") |
| Secretos en variables de entorno; sin datos personales | hecho |
| Lockfiles | `pnpm-lock.yaml` versionado; backend con versiones fijadas en `requirements*.txt` |
| Probado desde clonado limpio | ver T6.6 |

## Tareas
- [x] T6.1 `docs/ficha_tecnica.md` con la estructura de la plantilla oficial
- [x] T6.2 Auditoría de `docs/ficha_fuentes.md` contra lo que muestran la web, la app y la API
- [x] T6.3 `docs/registro_limpieza.md` contra la plantilla oficial
- [x] T6.4 `docs/arquitectura.md`; `contrato_api.md`, `seguridad.md` y `decisiones.md` contra el código; `docs/openapi.json` exportado de la app
- [x] T6.5 README: requisitos 07, guion de demo y verificación rápida
- [x] T6.6 Prueba de clonado limpio y corrección del README
- [x] T6.7 Pasos de publicación preparados (sección siguiente)
- [x] T6.8 Verificación final

## Ruta por tarea
Todas: escritor único; disparador de escritura (2+ archivos no triviales) y de preparación (lectura para escribir).

## Pasos de publicación (preparados, NO ejecutados)
1. Verificar que el árbol de trabajo esté limpio en `fase-6-entrega` y que el coordinador haya hecho los commits de la fase (`docs:` y `chore:`).
2. Abrir el pull request `fase-6-entrega` hacia `main` (la cadena de fases anteriores debe estar mergeada o incluida) y mergearlo.
3. Sobre `main` actualizado:
   ```bash
   git checkout main && git pull
   git tag -a v1.0-entrega -m "Entrega AI LAB Misión: Código Formosa · Equipo 3 · Desafío 6 Evacuaciones"
   git push origin v1.0-entrega
   ```
4. Comprobar que la mesa tiene acceso de lectura al repositorio (https://github.com/gonzalolrodriguez/elnino) y entregar el enlace al repositorio y al tag.
5. Antes del tag: póster, pitch y video listos; APK compilada si el equipo la incluye; revisión visual en navegador y teléfono.

## Evidencia
- T6.1: `docs/ficha_tecnica.md` con la estructura exacta de la plantilla oficial; roles marcados "propuesta, a confirmar".
- T6.2: auditoría de cifras de la web, la app y la API: se agregaron 7 filas y una lista de 3 afirmaciones sin fuente verificada (página El Niño: "rezago de semanas a meses", "avisa con semanas de anticipación", "en horas"); no se inventaron fuentes.
- T6.3: `docs/registro_limpieza.md` cumple la plantilla (encabezado, cinco columnas, comprobación final); lo regenera `python -m app.ingest.limpieza_k1` sin diferencias (verificado en el clon).
- T6.4: `docs/arquitectura.md` nuevo (Mermaid + fronteras de seguridad); `docs/openapi.json` exportado (51 rutas, 60 operaciones); las 51 rutas figuran en `contrato_api.md`; `seguridad.md` actualizado con las Fases 3 a 5 (adjuntos, idempotencia, tokens en web y app); `decisiones.md` con las decisiones de la Fase 6.
- T6.5: README reorganizado según 07 (variables, Docker y local, puertos, flujo principal e inválido, contrato, guion de demo, verificación rápida).
- T6.6 clonado limpio (rama `fase-6-entrega`, proyecto Compose `clonlimpio`, db en 5434, backend en 8001; ya eliminado con `down -v`):
  - `docker compose up -d --build`: db healthy y backend con migraciones y seed; `/api/v1/salud` → `{"estado":"ok",...,"base_de_datos":"ok"}`; escenario {7,6; 40; []} → S1 y S3 en riesgo, S2 normal, S4 comprometido y aislado, río normal a 0,2 m de la alerta; altura 13 → 422.
  - `pnpm install --frozen-lockfile`: Done (3 min 36 s). Frontend `test`: 53 pruebas; `build`: OK. Mobile `jest`: 36 pruebas. Backend `ruff check .` y `pytest -q`: 202 passed.
  - Defectos hallados y corregidos: (1) el puerto 8000 del backend estaba fijo en `docker-compose.yml` (ahora `${BACKEND_PORT:-8000}`); (2) con el `.env.example` sin tocar, 11 pruebas fallaban con 401 en la preparación porque el admin usa `DEMO_ADMIN_PASSWORD` y las pruebas usaban `DEMO_PASSWORD` (corregido en `tests/conftest.py`); 202 pasan tras el arreglo; (3) el README no decía que `DATABASE_URL` debe llevar el mismo puerto que `POSTGRES_PORT`, ni cómo cargar `.env` en el entorno para `pytest`, ni el comando de pruebas de la app (`pnpm test` solo corre la web); (4) el aviso "Ignored build scripts" de pnpm no estaba explicado; (5) la red vial no se carga con el contenedor ni con el seed.

- T6.8 verificación final en el repositorio principal (2026-11-18, base de desarrollo en 5433, sin detenerla): `ruff check .`: All checks passed; `pytest -q`: 202 passed; `pnpm -r typecheck`: shared, mobile y frontend Done; frontend `test`: 6 archivos, 53 pruebas pasadas (597 s por la carga de la máquina); mobile `jest`: 5 suites, 36 tests pasados.
- Pendiente humano: póster, pitch, video, APK (cuenta de Expo y clave de Google Maps), revisión visual en navegador y teléfono, confirmación de roles del equipo, decisión sobre las 3 afirmaciones sin fuente, commits, merge y tag.
