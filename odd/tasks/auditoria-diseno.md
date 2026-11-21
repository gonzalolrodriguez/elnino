# Auditoría de diseño del sistema (D1)

Objetivo: que cada segmento, sección y perfil comparta la identidad "Río y cielo" definida en `DESIGN.md`. Esta pasada **no cambia código**: codifica el sistema y mide cada pantalla contra él.

- Fecha: 20/11/2026. Base: `dev-app` (fast-forward). Modo de uso: ODD, sin SDD ni TDD; verificación visual y axe al final de cada paquete.
- Evidencia: capturas a 1440 y 390 en `...\scratchpad\captura\auditoria-diseno\` (ver `informe.json` con métricas y axe), API simulada por rol (`disenio.mjs`). Excepciones: `/comando/mapa` a 390 no se pudo capturar (WebGL por software); el mapa de `/comando/mapa` a 1440 muestra "Cargando mapa…" por el mismo motivo (no es un defecto de la app). La app móvil se revisó desde el código y las pruebas, sin dispositivo.
- Skills aplicadas: impeccable (flujo de DESIGN.md y crítica; sin lanzador por decisión del usuario), frontend-design, ui-ux-pro-max, web-design-guidelines, emil-design-eng y animate (reglas de movimiento). No disponibles en esta instalación: `design:design-system`, `design:accessibility-review`, `design:ux-copy` (se cubrieron con axe-core, los criterios de `DESIGN.md` y las reglas de copy propias).

## Estado de las pantallas que otros agentes están editando

Re-verificar **después de integrar** (la puntuación de abajo es provisoria para ellas):

| Zona | Quién la toca | Re-chequear |
|---|---|---|
| `/comando/recomendacion` (`panel/paginas/Recomendacion.tsx`) | agente de Recomendación | cabecera, un resultado visible al entrar, controles de simulación (radios), SIMULADO por bloque |
| `/comando/operacion` cola de solicitudes (`panel/tablero/ColaSolicitudes.tsx`, `paginas/Operacion.tsx`) | agente de la cola de Operación | tabla apilada a 390, chips con ícono, selects a 44 px |
| Módulo Cuadrillas (`panel/cuadrillas/*`, `paginas/Cuadrillas.tsx`) | agente de Cuadrillas | tarjetas, formulario de integrante, historial de partes |
| `/informacion` sectores 3D (`informacion/MapaSectores.tsx`, `pages/Informacion.tsx`) | agente de Información | alternativa textual del 3D, fallback 2D, movimiento reducido |
| Insignias / distintivos (`components/Insignia.tsx`, `odd/tasks/distintivos-evacuafor.md`) | agente de badges | forma de cada categoría web/app, regla "una por bloque" |

## Resultados transversales

Medidas automáticas (53 capturas): leyenda fija presente en 100 %; 1 h1 por página en 100 %; 0 desbordes horizontales de página a 390; 1 salto de nivel de encabezado (Tablero).

axe-core (wcag2a/aa 2.1 + best-practice), por defecto:

| Regla | Gravedad | Dónde | Causa probable |
|---|---|---|---|
| `region` | moderada | 25 páginas | la leyenda fija queda fuera de un landmark (falta `role="region"`/`banner`/`aria-label`) |
| `listitem` | seria | Tablero (5 nodos: `kpi-rio`, `kpi-sectores`…) | `li` sin `ul/ol` padre en `ResumenSituacion` |
| `heading-order` | moderada | Tablero (`#titulo-relojes-compacta`) | h3 de relojes sin h2 previo |
| `aria-allowed-role` | menor | Tablero | rol ARIA no permitido en un elemento |
| `label-content-name-mismatch` | seria | `/mi-cuenta` (ambos roles) | `aria-label` que no contiene el texto visible de un control |
| `landmark-unique` | moderada | Admin | dos regiones con el mismo nombre (`adm-usuarios-resumen`) |

Objetivos táctiles (medidos sin emulación de puntero táctil, así que `base.css` no los forzó a 44 px): selectores `Select` de 32 px (Producción, Lluvia, Órdenes, Evacuaciones), controles de zoom del mapa 29 px y atribución 24 px (Mi cuenta), enlaces de pie y navegación de 30 px, enlaces dentro de párrafo de 19 px (aceptado por WCAG 2.5.8 como enlace en línea). Repetir con `hasTouch/isMobile` antes de dar por bueno.

## Brechas principales (top 15)

0. **Borde de campo con 1,6:1** (`bordeControl` #C3CCD8 sobre blanco; WCAG 1.4.11 pide 3:1): inputs, selects y checkbox casi no se ven. Cambiar a `pizarra.500` (4,6:1) en `theme.ts`/`paleta.ts` y en `COLOR.bordeCampo` de la app. (P0, P9)
1. **Controles de escenario antes del h1** en todo `/comando/*`: la pregunta de la página llega después de un bloque de sliders. (Panel)
2. **SIMULADO repetido sin criterio**: 33 insignias en el Tablero, una por KPI y por tarjeta de sector; 4 en un solo bloque de Admin; una por fila en Órdenes. Contradice "una por bloque, callada". (Panel, Admin)
3. **Códigos internos y de rol a la vista**: `defensa_civil`, `coordinador_sector` (Órdenes, Bitácora, hasta dentro de un `input`), `K1`, `K6`, `K7`, nombre de archivo `P1_DATA_INTEGRITY…csv`, ids `a1`/`r1` (Centinela), `sms_sim`. (Panel Decidir/Respaldo)
4. **Cabecera de página desigual**: Administración, Producción y Órdenes sin ayuda ni categoría; Admin ni siquiera usa `CabeceraPagina` (sin ícono ni ficha). (Admin, Panel)
5. **Anchos de contenedor y márgenes distintos**: 32 px (Admin, panel), 80 px (login, registro, `/app`), ~94 px (Mi cuenta, 64rem), 72rem (Información). Las páginas hermanas "saltan" al navegar. (Público, Ciudadano, Admin)
6. **Controles booleanos con aspecto de radio vacío** (Órdenes sectores, Recomendación "Simular lluvia prevista", Evacuaciones "Solo las que hay que revisar", Mapa "Mostrar traslados") y de 16 px de alto: no usan el `Checkbox` del tema ni objetivos de 44 px. (Panel)
7. **Formularios sin patrón común**: Producción con etiquetas en minúscula crudas ("vaca preñada"), Bitácora en una columna a todo ancho de 1100 px, Órdenes con fecha nativa; ayuda de 13 px bajo el campo no siempre existe. (Panel)
8. **Fechas y unidades inconsistentes**: "2026-11-18 07 h" en Partes de lluvia móvil frente a `dd/mm/aaaa` en el resto; `5,6` en el campo de escenario frente a `5,60 m`. (Panel Situación)
9. **Insignia de la app distinta de la web**: la app usa tonos de color (teal para REFERENCIA, fondo ámbar sólido para SIMULADO) sin borde punteado ni trama; pierde el canal de forma. (App)
10. **Hex literales en la app fuera de `tema.ts`** (`#174A86`, `#D5E5F6`, `#BBD3EC`, `#F1F5F9`, `#64748B` en `Piezas.tsx`/`ui.tsx`; más en `mapaHtml.ts`, `MapaRutaPedido.tsx`, `LeyendaFija.tsx`, `AyudaAhora.tsx`) y 3 hex en `MiniMapaDestino.tsx` (5), `Cuenca3D.tsx`, `MapaPedidoGL.tsx` en la web. (App, Panel)
11. **Tamaños de letra sueltos**: 282 `fontSize="sm"` y 96 `"xs"`, más literales `"12"`, `"10px"`, `"0.75rem"`, `"0.8125rem"`; la escala `rotulo`/`microdato` no se usa de forma sistemática. (Todos)
12. **Etiquetas en mayúscula con tracking** ("ENTENDER LA SITUACIÓN" en `TresRelojes.tsx`): contradice la regla de sentence case. (Público)
13. **Accesibilidad estructural** (tabla de axe arriba): landmark de la leyenda, `li` sin lista, orden de encabezados, `label-content-name-mismatch`, `landmark-unique`. (Panel, Ciudadano, Admin, Layout)
14. **Estado vacío y de carga desparejos**: Evacuaciones deja el 60 % de la pantalla vacía bajo un aviso; Mapa muestra "Cargando mapa…" sin esqueleto ni alternativa; Capas oficiales solo un spinner. (Panel)
15. **Panel de cuadrillas y tarjetas en masonry irregular**: la columna derecha termina antes y deja huecos; las filas de integrantes mezclan texto con y sin chip "Encargado". (Panel Ejecutar)

## Ficha por pantalla

Escala: A bien, B correcto con ajustes, C requiere trabajo. Columnas: Jerarquía / Densidad / Consistencia / Responsive / Accesibilidad / Copy.

| Pantalla | Jer. | Den. | Cons. | Resp. | A11y | Copy | Notas |
|---|---|---|---|---|---|---|---|
| `/` Landing | A | B | A | A | B (region) | A | Hero con cifra y categoría. Eyebrow en mayúscula; página mucho más larga que `/informacion`; relojes bien jerarquizados |
| `/informacion` | A | A | B | A | B | A | Columna de lectura clara; ancho de contenedor distinto al resto; revisar tras el 3D de sectores |
| `/login` | B | A | B | A | B | B | Columna derecha mezcla ayuda con enlaces; botón primario a todo el ancho de la tarjeta |
| `/registro/ciudadania` | B | B | B | A | B | A | Formulario largo en una columna; el bloque "Sectores de evaluación" oculto detrás de un acordeón en una columna casi vacía |
| `/registro/productor` | B | B | B | B | B | A | Selector de ubicación con tres botones de peso distinto (no segmentado); mapa al final lejos del campo |
| `/app` | A | A | B | A | B | A | Contenido correcto; sin imagen ni captura de la app |
| `/mi-cuenta` ciudadano | A | B | A | A | C (label mismatch, zoom del mapa 29 px) | A | Mejor pantalla del sistema; contenedor 64rem frente a 90rem de la barra; mapa con tarjeta rosada en la simulación (artefacto de teselas), no de la app |
| `/mi-cuenta` productor | A | B | A | A | C | A | Igual; falta mostrar establecimientos y stock con el mismo patrón que el grupo familiar (la API devolvió vacío en la simulación) |
| `/cuadrilla` | A | B | A | A | B | A | Acciones claras; 4 SIMULADO por tarjeta; roles sin chip salvo el encargado |
| `/admin` | C | B | C | B | B (landmark) | B | Sin `CabeceraPagina`; 11 insignias; barras de rol que no aportan; contenedor a 90rem |
| `/comando` Tablero | B | C | B | B | C (listitem, heading-order) | B | Muy denso (33 insignias); control de escenario arriba; sectores, KPI y relojes compiten por el primer vistazo |
| `/comando/rio` | B | B | B | B | B | B | 5 DATO OBSERVADO en un mismo bloque; gráfico se apoya en datos del cliente |
| `/comando/lluvia` | B | B | B | C (archivo nativo cortado a 390) | B | C (fecha ISO) | Input de archivo sin estilo; "Sin medición" como radio chico |
| `/comando/mapa` | B | B | B | sin captura | B | B | Muchos paneles apilados a la izquierda; leyenda larga bajo el mapa; no verificado a 390 |
| `/comando/recomendacion` | provisorio | | | | | | En edición por otro agente |
| `/comando/produccion` | C | B | C | B | B | C | Sin ayuda de cabecera; etiquetas crudas; aviso SIMULADO duplicado con la insignia |
| `/comando/ordenes` | B | B | B | B | C (radios chicos) | C | `defensa_civil` en la tabla; columna "Categoría" repetida; sectores como radios de 16 px |
| `/comando/operacion` | provisorio | | | | | | En edición (cola) |
| `/comando/cuadrillas` | provisorio | | | | | | En edición (módulo); revisar huecos entre tarjetas |
| `/comando/evacuaciones` | B | B | B | B | B | B | Vacío ocupa la página; filtros sin estilo de segmentado |
| `/comando/bitacora` | B | C | C | B | B | C | Campos a todo el ancho de 1100 px; "Responsable (rol)" es un input con `coordinador_sector` |
| `/comando/centinela` | B | B | C | B | B | C | Códigos K1/K6/K7, nombres de archivo, ids a1/r1 sin nombre llano |
| `/comando/limites` | A | A | A | A | B | B | Texto simple; revisar que cada límite diga por qué importa |
| App móvil (código) | A | B | B | A | A | B | Mismos tokens y piezas; ver brechas 9 y 10 |

## Paquetes de trabajo (en paralelo, sin tocar los mismos archivos)

Orden sugerido de integración: P0 antes que el resto; luego los demás en cualquier orden. Cada paquete cierra con captura a 1440/390 y axe, y un commit convencional por unidad de trabajo.

### P0 Cimientos del sistema (un solo escritor; bloquea a los demás solo en lo que exporta)
Archivos: `apps/frontend/src/theme.ts`, `src/estilo/*`, `src/panel/ui.tsx`, `src/panel/CabeceraPagina.tsx`, `src/components/Insignia.tsx`, `src/components/Layout.tsx`, `src/components/Formulario.tsx`.
- Exportar un `Contenedor` con dos anchos (72rem lectura, 90rem datos) y usarlo en `Layout` (brecha 5).
- Dar a `Checkbox`/`Radio`/`Switch` el aspecto del tema con objetivo de 44 px y una variante `Opcion` en fila (brecha 6).
- Landmark para la leyenda fija en `Layout` (`role="region"` + `aria-label`) (brecha 13).
- `Seccion`: aceptar `categoria` y exponer un modo `sinCategoria`; `Cifra`: parámetro `omitirCategoria` para filas que comparten categoría (brecha 2).
- `etiquetaRol` y `fmtFecha` ya existen: añadir `etiquetaOrigen` y `etiquetaCodigo` en `lib/etiquetas.ts` (brecha 3).
- Mover `fontSize` sueltos a `textStyle` (tabla de `DESIGN.md`) en componentes compartidos (brecha 11).
- Coordinar con el agente de badges: no editar `Insignia.tsx` sin acuerdo.

### P1 Público
`pages/Landing.tsx`, `landing/*`, `components/TresRelojes.tsx`, `pages/Informacion.tsx` (esperar la integración del 3D), `pages/Login.tsx`, `pages/Registro*.tsx`, `components/PaginaFormulario.tsx`, `components/SelectorUbicacion.tsx`.
- Quitar mayúsculas con tracking de `TresRelojes.tsx:305` (brecha 12).
- Selector de ubicación como control segmentado; mapa pegado al campo en `registro/productor`.
- Usar el contenedor de P0 en login, registro y `/app`; acortar la landing (relojes en tarjetas de igual altura).
- Alternativa textual y fallback del hero 3D; revisar `region`.

### P2 Ciudadano / productor
`pages/MiCuenta.tsx`, `pages/micuenta/*`.
- Resolver `label-content-name-mismatch` (probablemente el botón "Marcar como leída" o el del mapa).
- Zoom del mapa y atribución a 44 px en táctil (`MapaPedido*.tsx`).
- Mostrar establecimientos/stock del productor con la misma estructura que "Mi grupo familiar".
- Pasar a contenedor 72rem (hoy 64rem).

### P3 Panel Situación
`panel/paginas/Tablero.tsx`, `Monitor.tsx`, `Lluvia.tsx`, `MapaOperativo.tsx`, `panel/tablero/*` (excepto `ColaSolicitudes.tsx`), `panel/AvisoEscenario.tsx`, `panel/PanelLayout.tsx`.
- Mover el control de escenario debajo de la cabecera o a un panel plegable "Escenario" con resumen en una línea (brecha 1; coordinar con P0 porque `PanelLayout` lo monta).
- Tablero: una insignia por bloque (sectores, pedidos...), eliminar las de cada tarjeta y KPI; corregir `listitem`, `heading-order`, `aria-allowed-role` (brechas 2, 13).
- Lluvia: componente de archivo del tema, fecha `dd/mm/aaaa` en "Últimas lecturas" (brechas 8, 7).
- Mapa: esqueleto de carga y apilado de paneles en 390; capturar `/comando/mapa` a 390 con otro motor.

### P4 Panel Decidir
`panel/paginas/Recomendacion.tsx` (**en edición**), `Produccion.tsx`, `Ordenes.tsx`, `panel/evacuaciones/*` (diálogos de orden).
- Producción: `CabeceraPagina` con ayuda, etiquetas legibles ("Vaca preñada"), un único aviso SIMULADO.
- Órdenes: sectores como `Opcion` de 44 px, rol por nombre, quitar la columna Categoría o una sola nota (brechas 3, 6).
- Recomendación: re-auditar tras la fusión.

### P5 Panel Ejecutar
`panel/paginas/Operacion.tsx`, `Cuadrillas.tsx`, `Evacuaciones.tsx`, `panel/tablero/ColaSolicitudes.tsx`, `panel/cuadrillas/*` (**todos en edición salvo Evacuaciones**).
- Evacuaciones: estado vacío con explicación y siguiente paso; filtros con `Opcion` del tema.
- Re-auditar Operación y Cuadrillas tras las fusiones (brecha 15).

### P6 Panel Respaldo
`panel/paginas/Bitacora.tsx`, `Centinela.tsx`, `Limites.tsx`.
- Bitácora: formulario en columna de 70ch, "Responsable" como selector con nombre del rol (brechas 3, 7).
- Centinela: nombre llano para K1/K6/K7 (con el código entre paréntesis), ocultar nombre de archivo del kit, ids de afirmación como "Afirmación 1".
- Límites: sin cambios estructurales.

### P7 Admin
`pages/Admin.tsx`, `pages/admin/TableroAdmin.tsx`.
- Usar `CabeceraPagina` con ícono, ayuda y frescura (brecha 4).
- Una categoría por bloque y decidir si las cifras de cuentas son SIMULADO (las de demo sí; la integridad de la auditoría no) (brecha 2).
- Corregir `landmark-unique`; barras por rol como lista compacta; contenedor 90rem.

### P8 Cuadrilla web
`pages/Cuadrilla.tsx`, `pages/cuadrilla/*`.
- Una insignia por tarjeta de tarea; chips para todos los roles o ninguno.
- Objetivos táctiles de 44 px verificados con emulación táctil; checklist con áreas grandes.

### P9 App móvil
`apps/mobile/src/components/{tema.ts,Piezas.tsx,ui.tsx,Icono.tsx,LeyendaFija.tsx,AyudaAhora.tsx}`, `lib/mapaHtml.ts`, `components/mapa/*`.
- Alinear `Insignia` con la web: borde punteado y trama para SIMULADO, borde continuo para OBSERVADO y REFERENCIA (brecha 9; coordinar con el agente de badges).
- Mover los hex literales a `COLOR` (`infoLinea`, `infoTexto`, `neutroFondo`, `neutroDisco`, `secundarioPresionado`) (brecha 10).
- Revisar en dispositivo: foco/lector (TalkBack), `maxFontSizeMultiplier`, orientación apaisada.

## Criterio de cierre de la pasada de seguimiento

1. Re-correr `disenio.mjs` (pantallas y axe) y comparar con `informe.json`: 0 violaciones graves, <= 1 insignia SIMULADO por bloque, 0 códigos internos visibles.
2. Capturas a 1440 y 390 revisadas por paquete; mapa a 390 con navegador con GPU.
3. Re-chequear las cinco zonas marcadas como "en edición" después de integrar.
4. Actualizar `DESIGN.md` si un componente nuevo cambia la tabla de patrones.
