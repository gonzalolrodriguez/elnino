# Diseño web · pase visual completo

**Objetivo:** pase de diseño sobre toda la web (landing, Información, registro, login, mi cuenta, panel operativo, cuadrilla, admin) con identidad propia, accesible y consistente; la sección "El Niño" pasa a llamarse "Información".
**Pedido del usuario (2026-11-18):** aplicar las skills de diseño instaladas a toda la web; renombrar "El Niño" a "Información".
**Restricciones:** reglas de la mesa (leyenda fija, categorías visibles), stack confirmado (React 18 + Chakra UI v2 + R3F + MapLibre/Deck.gl), UI en español, tests verdes.
**Flujo:** ODD, sin TDD; verificación completa al final.
**Rama:** `diseno-web` (sale de `fase-6-entrega`).

## Tareas
- [x] D1 Sistema visual: tokens (color OKLCH, tipografía, espaciado, radios, movimiento) en el tema de Chakra — delegado
- [x] D2 Renombrar "El Niño" → "Información" (`/informacion`, con redirección desde `/el-nino`), navegación y docs — delegado
- [x] D3 Landing e Información — delegado
- [x] D4 Registro, login, mi cuenta, app — delegado
- [x] D5 Panel operativo, cuadrilla y admin — delegado
- [x] D6 Auditoría de accesibilidad y guías web; microinteracciones con reduced motion — delegado
- [x] D7 Verificación final y cierre
- [x] D8 Datos de relieve reales y reproducibles (`apps/backend/scripts/descargar_relieve.py` → `data/geo/relieve/`, manifiesto, LEEME) — inline, un solo escritor
- [x] D9 Landing: escena 3D de planialtimetría (malla, curvas, departamentos, río, leyenda) y respaldo 2D con los mismos datos — inline
- [x] D10 Docs: `ficha_fuentes.md`, LEEME, README, `decisiones.md` — inline
- [x] D11 Simulaciones: capas Relieve / Curvas de nivel / Departamentos en el mapa operativo (MapLibre) y fondo local en el mapa SVG de sectores de `/informacion` — inline

## Evidencia
- Ruta de ejecución: un solo escritor (inline, delegado por el orquestador). Sin commit, por pedido.
- `pnpm -r typecheck`: ok. Frontend `lint`: ok. `test`: 93 pruebas en verde (61 previas + nuevas). `build`: ok.
- sloplint (sin --render): 1 FAIL waived (EstadoBackend: heurística por archivo; el foco lo define el tema global) y 2 REFLEX del mismo archivo.
- Capturas en scratchpad/capturas (landing, información, login, registro, app a 1440/390/360). Sin ver: rutas privadas.

## Evidencia D8–D11 (relieve real)
- `python apps/backend/scripts/descargar_relieve.py`: cuenca z7, 24 tiles, 39,2 a 892,3 m, 13 niveles de curvas (25 m < 200 m, 100 m arriba); corredor z11, 16 tiles, 49,7 a 77,5 m, curvas cada 2 m (13 niveles), ruido del DEM 1,99 m. `ruff check` y `ruff format --check` del script: ok.
- `pnpm -r typecheck`: ok. Frontend `lint`: ok. `test`: 104 pruebas en verde (93 previas + 11 nuevas en `relieve.test.tsx`). `build`: ok (Cuenca3D 869 kB, MapaGL 2.009 kB, ambos cargados bajo demanda; `public/relieve` 1,8 MB por `fetch`).
- Capturas (landing 3D tras la animación, 1440x900 y 390x844) en scratchpad/capturas: `relieve-1440.png`, `relieve-390.png`. Mapa operativo verificado con una página de prueba temporal (ya eliminada): curvas, departamentos, rótulo de cota y tinte visibles. Sin verificar visualmente: `/comando/mapa` autenticado y `/informacion` (cubiertos por pruebas, MapLibre simulado).
- Pendiente: la ruta autenticada del mapa operativo no se miró con sesión real.
