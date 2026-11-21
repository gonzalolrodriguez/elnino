# Auditoría de cierre del diseño (web)

- Fecha: 20/11/2026. Base: `dev-app` (`ac4bcab`). Solo lectura: no se tocó código fuente.
- Método: vite propio (puerto 5204), API simulada por rol (`disenio.mjs` ampliado con `/mi/cuadrilla`, `/cuadrillas/:id`, `/cuadrillas/plantillas`, `/serie/caudal-glofas`, avisos). Capturas a 1440 y a 390 (con `hasTouch`/`isMobile`), axe-core (wcag2a/aa 2.1 + best-practice) a ambos anchos, desborde horizontal y objetivos táctiles.
- Capturas: `C:\Users\lehen\AppData\Local\Temp\claude\e35296bceb88399d\1bd09b6d-ea2e-482d-a9eb-0ef7aa7c4910\scratchpad\captura\cierre*` (`cierre`, `cierre-b`, `cierre-c1..c3`, `cierre-d`; cada carpeta con `informe.json` salvo `cierre`, cuya corrida se cortó y se repitió en las otras). Los scripts son `cierre.mjs` / `cierre2.mjs` en la carpeta `captura`.
- Límites: el mapa de `/comando/mapa` (y las teselas de `/mi-cuenta`) se ven vacíos o rosados por WebGL por software y teselas simuladas; no son defectos de la app. La captura completa a 390 con emulación móvil duplica el pie de página (artefacto de Playwright). La app móvil no se revisó. Los valores crudos que aparecen en `/comando/cuadrillas/1` ("otro", "botiquin", "humana") salen de mi dato simulado fuera del catálogo, no de la app.

## Totales

| Métrica | Antes (auditoría 20/11) | Ahora |
|---|---|---|
| Violaciones axe (todas las pantallas, 2 anchos) | 25 páginas con `region` + `listitem` (5 nodos), `heading-order`, `aria-allowed-role`, `label-content-name-mismatch` (x2), `landmark-unique` | **1** (menor): `empty-heading` en `/cuadrilla` (ver R3) |
| Desbordes horizontales de página a 390 | 0 | **0** |
| Páginas sin leyenda fija / sin h1 | 0 | 0 |
| Saltos de nivel de encabezado | 1 (Tablero) | 0 |
| Insignias por pantalla (Tablero) | 33 | 22 (decisor), 24 (operador) |

Nota sobre dos "pantallas en blanco" que aparecieron al principio (`/informacion` y `/comando/rio`): las causó mi dato simulado de `/serie/caudal-glofas` con forma incorrecta (sin `fechas`). Con la forma real ambas cargan y dan 0 axe. Ver R6: un dato malformado deja la página entera en blanco porque no hay límite de error global.

## Por pantalla

Columnas: axe (cantidad y reglas), desborde a 390, notas frente a `DESIGN.md`, puntaje antes → después (A bien, B correcto, C requiere trabajo; resumido en una letra por la media de jerarquía, consistencia, responsive, accesibilidad y copy).

| Pantalla | axe | Desborde | Notas frente a DESIGN.md | Puntaje |
|---|---|---|---|---|
| `/` | 0 | no | Hero con cifra y categoría; selector de perfil con tres tarjetas; enlaces de las tarjetas (27 px) y "Ingresar / Descargar la app" (21 px) bajo 44 px en táctil | A → A |
| `/informacion` | 0 | no | Barra lateral de contenidos, serie K1, caudal GloFAS, sectores 3D con alternativa; contenedor consistente. Sliders `type="range"` de 32 px de alto a 390 | B → A |
| `/login` | 0 | no | Mismo contenedor que el resto del público | B → A |
| `/registro/ciudadania` | 0 | no | `PaginaFormulario`, una insignia | B → A |
| `/registro/productor` | 0 | no | Igual | B → A |
| `/app` | 0 | no | Correcto | A → A |
| `/mi-cuenta` ciudadano | 0 | no | Tarjeta de estado dominante, pedido activo con línea de tiempo, avisos, centro, datos. Contenedor ya unificado. Insignias SIMULADO: 7 (una por bloque más "Sector S4" y "Domicilio"). Falta de código crudo: ninguna | C(a11y) → A |
| `/mi-cuenta` productor | 0 | no | Idéntica. No se pudo verificar establecimientos y stock (mi dato devolvió vacío) | C → A- |
| `/cuadrilla` | 1 (`empty-heading`) | no | Tarjetas por tarea con acción principal; 6 insignias. Captura 390 fiel al patrón | B → A- |
| `/admin` | 0 | no | Ya usa `CabeceraPagina`; categoría SIMULADO por bloque (2 de 5 bloques); chip doble "Bloqueado" + "Bloqueada" en la misma fila; el select de rol operativo corta el texto ("Sin rol operativ") | C → B+ |
| `/comando` Tablero (decisor) | 0 | no | Cabecera primero; sectores y KPI jerarquizados; 22 insignias (baja de 33 pero sigue alta); "Tres relojes" con tarjetas de distinta altura; aún "K1 limpio", "K10" y "es un SUPUESTO" a la vista | C → B+ |
| `/comando` Tablero (operador) | 0 | no | Igual; selects de filtro de 32 px (1440) y enlaces en línea de 19 px | C → B+ |
| `/comando/rio` | 0 | no | Con dato correcto carga (serie K1 y caudal GloFAS) | B → B+ |
| `/comando/lluvia` | 0 | no | Sin desborde a 390 (antes el archivo nativo se cortaba) | B → A- |
| `/comando/mapa` | 0 | no | Columna izquierda de 3000 px con 8 bloques apilados, mapa a la derecha sin fijar; leyenda larga bajo el mapa. A 390 captura completa | B → B |
| `/comando/recomendacion` | 0 | no | Cabecera primero, un resultado al entrar | prov. → A- |
| `/comando/produccion` | 0 | no | Con cabecera y ayuda | C → B+ |
| `/comando/ordenes` (decisor y operador) | 0 | no | Sectores como `Opcion` de 44 px, rol por nombre ("Defensa Civil"), una sola insignia. Es la pantalla más pareja del panel | C → A |
| `/comando/operacion` | 0 | no | Cola con chips; filtros S1-S4 de 41-43 px de ancho a 390; enlaces a cuadrilla de 26 px | prov. → B+ |
| `/comando/cuadrillas` (decisor y operador) | 0 | no | Tarjetas, vista Lista/Mapa | prov. → A- |
| `/comando/cuadrillas/:id` | 0 | no | Cabecera con ícono, bloques con ficha; usa el patrón del resto | nuevo → A |
| `/comando/evacuaciones` | 0 | no | Con cabecera y estado vacío | B → B+ |
| `/comando/bitacora` | 0 | no | Dos columnas, rol por nombre | C → A- |
| `/comando/centinela` | 0 | no | Cifras y veredictos en lista | C → B+ |
| `/comando/limites` | 0 | no | Texto con medida de lectura | A → A |

Patrones transversales verificados: leyenda fija presente en todas; un h1 por página; cabecera de página como primer elemento en todo el panel (los controles de escenario ya van debajo); ancho de contenedor unificado; chips con ícono y texto; formularios con etiqueta visible y objetivos de 44 px.

## Pendientes priorizados

Cada ítem lleva archivo:línea y el cambio mínimo. "Bloquea demo" = se ve o falla frente al jurado.

| # | Pendiente | Dónde | Arreglo mínimo | Bloquea demo |
|---|---|---|---|---|
| R1 | Una pantalla entera queda en blanco si una respuesta llega con forma inesperada (visto en `/informacion` y `/comando/rio` con `/serie/caudal-glofas` malformada); no hay `ErrorBoundary` global | `apps/frontend/src/App.tsx:39-78` (solo hay límites locales en `informacion/SectoresInundacion.tsx` y `landing/Hero.tsx`) | Envolver `<Routes>` en un `ErrorBoundary` con `AlertaError` + "Reintentar". Además, en `caudal/CaudalGlofas.tsx:389` comprobar `Array.isArray(carga.datos.fechas)` además de `n === 0` | Sí (riesgo si un endpoint falla en vivo) |
| R2 | Pie de página: "Código fuente en GitHub" de 19 px de alto y "Inicio" de 33 px de ancho en todas las páginas a 390 con táctil | `components/Layout.tsx:256` (enlace) y los enlaces de "Navegación" del pie | Agregar `display="inline-flex" alignItems="center" minH="2.75rem"` a esos `Link` | No |
| R3 | `empty-heading` (axe, menor) en `/cuadrilla`: el h3 de la tarjeta queda vacío cuando la tarea no trae `titulo` | `pages/Cuadrilla.tsx:62-64` | `{tarea.titulo \|\| \`Tarea n.º ${tarea.id}\`}` | No |
| R4 | Enlaces en línea de 19 px en el Tablero a 390 ("Atender en Solicitudes y cuadrillas", "Marcar o liberar caminos en el mapa", "Ver las recibidas", "Asignar") y de 26 px en Operación (nombre de cuadrilla) | `panel/tablero/ColaSolicitudes.tsx:52`, `panel/tablero/bloques.tsx:229` y `:269`, enlace "Asignar" del bloque de cuadrillas | `display="inline-flex" minH="2.75rem" alignItems="center"` (o `py={3}`) en esos `Link` | No |
| R5 | Sliders `type="range"` de 32 px a 390 en Información (`input::358x32`) | `informacion/SerieK1.tsx:202`, `caudal/CaudalGlofas.tsx:272` (`minHeight: "2rem"`), `informacion/SectoresInundacion.tsx:210` | `minHeight: "2.75rem"` (el `base.css:97` ya trata `range` aparte; subir ahí a 44 px bajo `pointer: coarse`) | No |
| R6 | Mapa operativo: columna izquierda de unos 3000 px con ocho bloques; el mapa queda arriba a la derecha y se pierde al bajar | `panel/paginas/MapaOperativo.tsx` (contenedor del mapa) | `position: sticky; top: calc(var(--altura-leyenda) + 1rem)` en el contenedor del mapa; plegar "Capas oficiales" y "Ruteo" en acordeones | Sí si se muestra el mapa en vivo |
| R7 | En todo el panel, el primer bloque de contenido arranca a unos 300-400 px: nota de categorías (`NotaCategorias`) + control de escenario ocupan dos franjas antes de la respuesta de la página | `panel/NotaCategorias.tsx:40-56`, `panel/AvisoEscenario.tsx` | Plegar `NotaCategorias` por defecto tras la primera visita (ya guarda "Ocultar"); en 1440 fundir ambas en una sola franja de una línea | No |
| R8 | Admin: chip doble en una cuenta bloqueada ("Bloqueado" + "Bloqueada") y select de rol operativo con texto cortado ("Sin rol operativ") | `pages/Admin.tsx:67-80` y `:52` | Mostrar solo el chip "Bloqueada" cuando `bloqueada`; `maxW="10rem"` → `maxW="12rem"` | No |
| R9 | Códigos internos que aún asoman en el Tablero: "K1 limpio", "K10", "es un SUPUESTO" | `panel/tablero/*` (bloque de río, de sectores y de frescura) | Usar `etiquetaCodigo` ("serie histórica del río (K1)", "sectores de evaluación (K10)", "supuesto del equipo") | No |
| R10 | Tablero con 22-24 insignias (objetivo: una por bloque); "Tres relojes" con tarjetas de distinta altura | `panel/tablero/bloques.tsx`, `components/TresRelojes.tsx` | Quitar la insignia por tarjeta de sector y dejar una en el título del bloque; `alignItems="stretch"` y misma altura en los tres relojes | No |

Fuera de la lista: enlaces de las tarjetas de perfil en la landing (27 px) y "Ocultar" de la nota de categorías (19 px, solo escritorio con puntero fino, aceptado).

## Conclusión

El sistema quedó consistente: 1 violación axe menor en 26 pantallas y 2 anchos, 0 desbordes, cabecera, contenedor, chips y formularios iguales entre perfiles. Para la demo, lo único a resolver es R1 (blanco total ante una respuesta mal formada) y, si se muestra el mapa, R6. El resto son ajustes de táctil y copy.
