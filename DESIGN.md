---
name: EvacuaFor
description: "Río y cielo: plataforma de gestión de evacuaciones, sobria, clara y amable, con la categoría del dato siempre a la vista."
colors:
  tinta: "#0E1B2C"
  tinta-suave: "#526072"
  fondo: "#F6F8FB"
  superficie: "#FFFFFF"
  linea: "#E2E8F0"
  linea-control: "#66768A"
  cielo: "#E6F0FA"
  rio-primario: "#1E5AA0"
  rio-hover: "#174A86"
  albardon-ok: "#2F7D5B"
  alerta-umbral: "#B7791F"
  alerta-texto: "#7A4F10"
  alerta-fondo: "#FDF6E8"
  evacuacion-umbral: "#B42318"
  evacuacion-texto: "#8E1B13"
  evacuacion-fondo: "#FDEEEC"
  rio-anegado: "#1D7B9F"
typography:
  pantalla:
    fontFamily: "Atkinson Hyperlegible Next Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(2rem, 1.3rem + 2.6vw, 3.25rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  titular-pagina:
    fontFamily: "Atkinson Hyperlegible Next Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  titulo-bloque:
    fontFamily: "Atkinson Hyperlegible Next Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  cifra-grande:
    fontFamily: "Atkinson Hyperlegible Next Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 1.6rem + 3vw, 3.75rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.035em"
  cifra-media:
    fontFamily: "Atkinson Hyperlegible Next Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  cuerpo:
    fontFamily: "Atkinson Hyperlegible Next Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  rotulo:
    fontFamily: "Atkinson Hyperlegible Next Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.3
  microdato:
    fontFamily: "Atkinson Hyperlegible Next Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  campo: "10px"
  boton: "12px"
  tarjeta: "16px"
  pastilla: "9999px"
spacing:
  xs: "4px"
  s: "8px"
  m: "12px"
  l: "16px"
  xl: "24px"
  xxl: "32px"
components:
  boton-primario:
    backgroundColor: "{colors.rio-primario}"
    textColor: "{colors.superficie}"
    rounded: "{rounded.boton}"
    height: "44px"
    padding: "0 20px"
  boton-primario-hover:
    backgroundColor: "{colors.rio-hover}"
  boton-secundario:
    backgroundColor: "{colors.cielo}"
    textColor: "{colors.rio-hover}"
    rounded: "{rounded.boton}"
    height: "44px"
  campo:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.campo}"
    height: "44px"
  tarjeta:
    backgroundColor: "{colors.superficie}"
    rounded: "{rounded.tarjeta}"
    padding: "20px"
---

# Sistema de diseño de EvacuaFor ("Río y cielo")

Fuente de verdad para web (`apps/frontend`, Chakra v2) y app (`apps/mobile`, Expo). Si una pantalla necesita algo que no está acá, se agrega acá primero. El código ya implementa casi todo: tokens en `apps/frontend/src/theme.ts` y `src/estilo/paleta.ts`; app en `apps/mobile/src/components/tema.ts`.

## Overview

**Para quién y para qué.** Personas en una emergencia por crecida (ciudadanía, productores), equipos en terreno (cuadrillas) y mandos que deciden (operador, decisor, admin). Se usa con apuro, a veces con mala señal y con el celular en la mano. La claridad pesa más que la expresión: es una interfaz de **operación** (tarea, escaneo rápido, estados), salvo la landing, que **persuade** y explica.

**Identidad.** Río y cielo: tinta azul marino para el texto, azul río para la acción, cielo claro para superficies suaves, línea de 1 px en lugar de contornos gruesos. Ámbar y rojo quedan **reservados** para lo que cuenta: umbrales (alerta 7,80 m, evacuación 8,30 m), advertencias y errores. Una sola tipografía (Atkinson Hyperlegible Next, hecha para baja visión). Sin sombras decorativas, sin degradados, sin ilustración de relleno.

**Principios.**
1. **El dato primero.** Cada cifra lleva su categoría, fuente y fecha (regla 2 de la mesa); el estado nunca depende solo del color.
2. **Recomienda, no ordena.** Toda pantalla que sugiere algo lo dice; la orden la emite una persona con rol (decisor) y queda registrada.
3. **Una pregunta por pantalla.** Cada página responde una pregunta y arranca con su respuesta (estado, cifra o acción principal).
4. **Mismos patrones en todos los perfiles.** Cabecera, bloque, cifra, chip, lista y formulario se ven y se comportan igual en `/mi-cuenta`, `/comando/*`, `/cuadrilla`, `/admin` y la app.
5. **Español rioplatense, claro.** Voseo consistente, sin códigos internos sin explicar.

## Colors

Rampas en `paleta.ts` (limo, pizarra, agua, verde, alerta, evacuacion, rio). Los componentes usan **tokens semánticos** (`texto`, `textoSuave`, `fondo`, `superficie`, `borde`, `bordeControl`, `primario`, `primarioHover`, `suave`, `foco`), no hex ni nombres de rampa sueltos.

| Rol | Token | Uso | Contraste |
|---|---|---|---|
| Texto | `tinta` #0E1B2C | texto, títulos, cifras | 17,3:1 sobre blanco |
| Texto secundario | `tinta-suave` #526072 | rótulos, microdatos | 6,4:1 sobre blanco, 6,0:1 sobre fondo |
| Acción | `rio-primario` #1E5AA0 | botón principal, enlaces, selección | 6,9:1 con texto blanco |
| Superficie suave | `cielo` #E6F0FA | botón secundario, tab activa, ficha de ícono | texto `rio-hover` 7,7:1 |
| Fondo / línea | `fondo` #F6F8FB, `linea` #E2E8F0 | página, borde de tarjeta | decorativo |
| Borde de campo | `linea-control` #66768A (`pizarra.500`) | inputs, selects, checkbox (WCAG 1.4.11 exige 3:1) | 4,6:1. El `bordeControl` actual #C3CCD8 da 1,6:1 y no cumple |
| OK | `albardon-ok` #2F7D5B | confirmación, "en orden" | texto sobre fondo claro: `verde.800` |
| Alerta | `alerta-umbral` #B7791F | **solo** umbral 7,80 m, advertencia | texto: `alerta-texto` #7A4F10 (AA) |
| Evacuación / error | `evacuacion-umbral` #B42318 | **solo** umbral 8,30 m, error, acción destructiva | texto: `evacuacion-texto` |
| Río anegado | `rio-anegado` | solo "anegado" y estaciones en el mapa | no para texto |

Reglas: el color **refuerza**, nunca es el único canal (ícono + texto en chips; forma + texto en categorías). Sobre fondo oscuro (hero, pie, leyenda fija) usar `oscuro.fg` y los tonos `*Claro`. No usar más de un acento cromático por bloque. Prohibido: hex a mano en componentes, degradados de decoración, texto gris sobre gris, `#000`.

**Categorías de dato** (`Insignia`): DATO OBSERVADO = relleno cielo + borde continuo azul; DOCUMENTO DE REFERENCIA = blanco + borde continuo gris; SIMULADO = borde punteado ámbar + trama diagonal. Se distinguen por forma y texto.

## Typography

Una familia (`Atkinson Hyperlegible Next Variable`, autoalojada), pesos 400/600/700. La jerarquía sale de **peso y tamaño**, no de familias.

| Estilo (`textStyle`) | Tamaño | Uso |
|---|---|---|
| `pantalla` | fluido 32 a 52 px | saludo y títulos de portada (landing h1 usa `Heading size 4xl/5xl`) |
| `titularPagina` | 28 px fijo | **h1 de cada página del panel, admin, cuadrilla** |
| `tituloBloque` | 18 px fijo | **h2 de cada bloque** (`Seccion`) |
| `cifraGrande` | fluido 40 a 60 px, tabular | la cifra protagonista de una pantalla (río) |
| `cifraMedia` | 28 px, tabular | KPI y cifras de segundo nivel (`Cifra`) |
| cuerpo | 16 px / 1,6 | texto corrido, máximo 70 caracteres por línea |
| `rotulo` | 13 px semibold | rótulo sobre/bajo una cifra, encabezado de tabla |
| `microdato` | 13 px | fuente, fecha, ayuda. **Nunca menos de 12 px** |

Reglas: cifras y tablas con numerales tabulares (`textStyle="cifra*"`, `table` ya los tiene); sentence case, **sin versalitas ni texto en mayúsculas** salvo las categorías de dato y la leyenda fija (que son literales de la mesa); títulos con `text-wrap: balance`; no usar tamaños literales (`fontSize="12"`, `"10px"`): elegir un estilo de la tabla. Un solo h1 por página; no saltar niveles (h1, h2, h3).

## Layout

Rejilla de 4/8 px; separación entre bloques 16 a 24 px; relleno de tarjeta 16 (móvil) / 20 px (escritorio).

| Ancho | Páginas públicas | Ciudadano `/mi-cuenta` | Panel `/comando` | Cuadrilla `/cuadrilla` | App |
|---|---|---|---|---|---|
| 390 | 1 col., gutter 16 | 1 col., orden: estado, pedido activo, avisos, centro, datos | menú "Sección: …" colapsable arriba; 1 col.; tablas apiladas (`APILAR`) | 1 col., tarjeta por tarea | 1 col., margen 16 dp |
| 768 | 1 col. ancha, gutter 24 | 1 col. | 1 col. + menú colapsable | 1 col., acciones en fila | 1 col., ancho máx. 640 dp |
| 1024 | 2 col. cuando hay lateral (info, registro) | 2 col. (8/4) | **barra lateral fija 240 px** + contenido | 2 col. (tareas / ubicación y avisos) | 2 col. en tablet >= 840 dp |
| 1280 | contenedor 72rem | contenedor 72rem (hoy 64rem: unificar) | contenido fluido, máx. 90rem | contenedor 72rem | — |
| 1440 | contenedor 72rem centrado | ídem | máx. 90rem | ídem | — |

**Un solo ancho de contenedor por familia de pantallas:** páginas de lectura y de formulario 72rem (texto corrido a 70ch dentro); paneles de datos 90rem (el mismo de la barra de navegación). No alternar márgenes (32 px, 80 px, 94 px) entre páginas hermanas. La **leyenda fija** (`PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial`) va en toda pantalla; reserva `--altura-leyenda` para el foco y los anclajes.

## Elevation & Depth

Plano. Profundidad = **línea de 1 px + cambio de superficie** (blanco sobre `fondo`, `cielo` para lo suave, `tinta` para la tarjeta de estado dominante en el panel personal). Sin sombras en tarjetas; sombra mínima solo en elementos flotantes (menú desplegable, toast, diálogo). Capas: contenido, barra lateral, leyenda fija (siempre arriba), diálogo.

## Shapes

Campo 10 px, botón 12 px, tarjeta 16 px, pastilla (chip, insignia, tab) 9999 px, ficha de ícono 12 px. Nada de radio 3 px, 6 px ni 20 px sueltos. Ícono: trazo redondeado de 2 px sobre grilla de 24, 16 px en chips, 20 px en botones, 24 px en fichas (`components/iconos/Iconos.tsx`, `panel/iconos.tsx`; app: `Icono.tsx`).

## Components

Cada patrón existe en un solo lugar; no reimplementar.

- **Cabecera de página** (`panel/CabeceraPagina.tsx`): ficha de ícono 44 px + h1 `titularPagina` + categoría de la página + una línea de ayuda (máx. 70 ch) + frescura ("Actualizado hace…") + acciones a la derecha (abajo del título en móvil). **Obligatoria en toda página privada** (panel, admin, cuadrilla, mi cuenta usa el saludo). Debe ser el primer elemento visible: controles globales (escenario) van **debajo** o colapsados, no antes del h1.
- **Bloque** (`panel/ui.tsx: Seccion`): tarjeta, h2 `tituloBloque`, ícono opcional, **una** categoría en el título cuando todo el bloque es de esa categoría, `derecha` para frescura o enlace. Dentro, no repetir la categoría de cada dato igual a la del título.
- **Cifra / KPI** (`Cifra`): rótulo, valor tabular, categoría, fuente y fecha. En una fila de KPI con la misma categoría, una sola insignia para el grupo.
- **Chip de estado** (`Chip`, tonos ok/aviso/alerta/info/neutro): siempre **ícono + texto**; es información de estado, no botón. App: `Piezas.Chip`.
- **Insignia de categoría** (`components/Insignia.tsx`): **callada** para SIMULADO (es lo normal en el prototipo: una por bloque, tamaño pequeño), **prominente** para DATO OBSERVADO (lo único real: va junto a la cifra, nunca oculta). DOCUMENTO DE REFERENCIA junto a su fuente. La app debe usar las mismas formas que la web (hoy no).
- **Listas vs tablas**: lista/tarjeta cuando hay menos de 5 campos por ítem o se usa en móvil; tabla (`Table` + `APILAR`, `data-etiqueta` en cada celda) cuando se comparan columnas. Nunca scroll horizontal de página; si una tabla es ancha, `TablaDesplazable` con `aria-label`.
- **Línea de tiempo / paso a paso** (`pages/micuenta/LineaTiempoPedido.tsx`, `Piezas.Paso`): vertical, hecho/actual/pendiente con ícono y hora.
- **Tarjeta de estado dominante** (`EstadoSector`, `Banda`): una por pantalla, arriba, con ícono grande, frase de acción en una línea y cifra.
- **Formularios** (`components/Formulario.tsx`, `TarjetaFormulario`, `PaginaFormulario`): etiqueta siempre visible encima, ayuda debajo (13 px), error debajo del campo en `evacuacion.700` + ícono, resumen de errores arriba al enviar; obligatorios con asterisco y `aria-required`. Campos 44 px, `inputMode`/`autoComplete` correctos. Booleanos con `Checkbox` del tema (cuadrado) y excluyentes con `RadioGroup` en fila de **objetivos de 44 px**; no usar `<input>` nativo suelto. Archivos: botón del tema + nombre del archivo (no el input nativo). Contador −/+ (`Contador`) para cantidades pequeñas.
- **Selector de ubicación** (`SelectorUbicacion`): control segmentado "Mi ubicación / En el mapa / Coordenadas" (no tres botones de jerarquías distintas), mapa de K10 como respaldo, aviso de privacidad al lado.
- **Estados** (`EstadoCargando`, `AlertaError`, `Cargando`): cargando = esqueleto o spinner con texto; vacío = qué falta y qué hacer; error = qué pasó + "Reintentar". Nunca pantalla en blanco.
- **Aviso** (`Alert` subtle): una frase, ícono; `AvisoSimulado` solo en la entrada de una zona simulada, no por bloque.
- **Toasts** (`useToast`): confirmaciones breves ("Orden emitida"), 4 s, se repiten con el mismo verbo del botón. Errores graves van en la página, no en toast.
- **Diálogos** (`Modal` / `AlertDialog`): solo para confirmar acciones irreversibles o con efecto sobre terceros (emitir orden, cerrar tarea). Título = la acción; botones "Cancelar" + verbo; foco al abrir y devuelto al cerrar.
- **Mapas** (`MapaGL`, `ElegirEnMapa`): leyenda visible y plegable debajo del mapa (no tapando), controles de zoom 44 px, atribución, categoría de cada capa, alternativa textual (tabla o lista) del contenido.
- **Navegación**: barra superior (`Layout`) + en panel, barra lateral agrupada por tarea (Situación, Decidir, Ejecutar, Respaldo y registro) y menú de sección en móvil. La página activa con `cielo` + peso 600.

## Motion

Poco y con propósito. `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` para entradas y respuestas; `--ease-in-out` para movimiento en pantalla; nunca `ease-in`. Pulsación 100 a 160 ms (`scale(0.97)` ya en `Button`), color y borde 160 ms, desplegables y diálogos 150 a 250 ms, salida más corta que la entrada. Animar solo `transform` y `opacity`. **No animar** acciones de teclado frecuentes ni los números que alguien lee para decidir (las cifras del panel cambian en el lugar, sin conteo). Un solo momento orquestado por página (la landing: recorrido del río). `prefers-reduced-motion` ya reduce todo globalmente en `theme.ts`; los componentes con animación propia (hero, relojes, recorrido) deben ofrecer estado estático equivalente. Hover solo bajo `@media (hover: hover) and (pointer: fine)`.

## Accessibility

WCAG 2.1 AA como piso. Contraste 4,5:1 texto, 3:1 componentes. Objetivos táctiles >= 44 px web (`pointer: coarse` ya lo fuerza en `base.css`), >= 48 dp app (`TOQUE_MIN`), 8 px entre objetivos. Foco visible de 3 px (`foco`, `focoClaro` sobre oscuro), `scroll-margin` por la leyenda fija. Un h1 por página, niveles sin saltos, regiones con `aria-labelledby`, tablas con `th scope`. Cada campo con `label`; los íconos decorativos `aria-hidden`; la insignia lleva "Categoría:" oculto para lectores. Estado y errores en `aria-live` (polite; assertive solo para error de envío). Reflujo a 320 px y zoom 200 % sin scroll horizontal de página. Idioma `lang="es"`. App: `accessibilityRole`, `maxFontSizeMultiplier` acotado, ícono + texto en estados.

## Copy y voz

- Español rioplatense con **voseo consistente** ("Registrate", "Elegí", "Podés"); sin mezclar con tuteo ni con "usted".
- Frases cortas, verbo claro en botones ("Emitir orden", "Marcar como leída"); la misma palabra en botón, diálogo y toast.
- Nombrar por lo que la persona entiende: "Río y lluvia", no "Monitor"; **roles por su nombre** ("Defensa Civil", "Coordinador de sector"), nunca el código (`defensa_civil`, `coordinador_sector`).
- **Nada de códigos internos** (K1, K3, K10, SUPUESTO, siteCode, `sms_sim`) sin su nombre llano: "serie histórica del río (K1)", "sectores de evaluación (K10)", "supuesto del equipo". Los códigos pueden acompañar, no reemplazar.
- Fechas `dd/mm/aaaa` y horas `hh:mm` (`fmtFecha`), cifras con coma decimal y unidad (`fmtM`); nunca ISO en pantalla.
- Errores: qué pasó y cómo seguir; sin culpar ni pedir disculpas. Vacíos: invitación a actuar.
- Una recomendación dice "se recomienda"; una orden, "orden emitida por [rol]".

## Patrones por perfil

- **Público** (`/`, `/informacion`, `/login`, `/registro/*`, `/app`): persuadir y explicar; hero con cifra del corte y categoría; selector de perfil con tres tarjetas de igual peso; formularios en `PaginaFormulario` (columna de formulario + columna lateral "para qué usamos tus datos"). Un solo CTA primario por bloque.
- **Ciudadano / productor** (`/mi-cuenta`): una pantalla de estado: tarjeta de sector, pedido activo con línea de tiempo y mapa, avisos, centro asignado, datos. Acción de ayuda siempre a un toque; el 103 siempre visible. Productor suma establecimientos y stock con el mismo patrón que el grupo familiar.
- **Cuadrilla** (`/cuadrilla`, app modo cuadrilla): lista de tareas como tarjetas con una acción principal por estado (Iniciar, Informar, Terminar); texto grande, botones de ancho completo en móvil, checklist con objetivos grandes; ubicación opt-in con aviso claro.
- **Operador** (`/comando/*`): densidad media, tablas con filtros arriba, acciones por fila en botones secundarios, una acción principal por bloque. Controles de escenario compactos y siempre visibles pero subordinados a la cabecera.
- **Decisor**: lo del operador + "Emitir orden" como única acción primaria de la barra de la página; toda orden con fundamento, sectores y confirmación en diálogo; el borrador de bitácora se ofrece al emitir.
- **Admin** (`/admin`): igual que el panel (cabecera, bloques, tablas apilables); datos de cuentas no son SIMULADO (ver auditoría) salvo que lo sean.
- **App móvil**: mismos tokens (`tema.ts`) y piezas (`Piezas.tsx`); pestañas inferiores <= 5; formularios offline-first con indicador de pendientes; sin hex fuera de `tema.ts`.

## Do's and Don'ts

| Hacer | No hacer |
|---|---|
| `CabeceraPagina` como primer elemento con ícono, h1, categoría y una línea de ayuda | Poner el control de escenario arriba del título, o una página sin cabecera (Administración, Producción) |
| `Seccion titulo="…" categoria="SIMULADO"` una vez por bloque | Una insignia SIMULADO en cada KPI, cada fila y cada tarjeta del mismo bloque (Tablero, Admin) |
| `Chip tono="aviso" icono={…}` + texto | Chip solo de color, o texto de estado en gris |
| `fmtFecha`, `fmtM`, `etiquetaRol(...)` | Mostrar `defensa_civil`, `2026-11-18 07 h` o `sms_sim` al usuario |
| `Checkbox` / `RadioGroup` del tema, 44 px | `input` nativo o radios minúsculos en fila (Órdenes: sectores; Recomendación: simulación) |
| `Table sx={APILAR}` con `data-etiqueta` | Tabla de 6 columnas que se desborda a 390 px |
| `textStyle="cifraMedia"` para toda cifra | `fontSize="12"`, `"10px"`, `"0.8125rem"` sueltos |
| Un contenedor de 72rem para lectura y formularios | Márgenes de 32 / 80 / 94 px según la página |
| Mismo vocabulario en web y app (Insignia, Chip, Paso) | Una Insignia en la app con otra forma y otros colores que la web |
| Tokens (`COLOR`, `TIPO`, `ESPACIO`, `RADIO`) en la app | `#174A86`, `#D5E5F6`, `#F1F5F9` literales en `Piezas.tsx` / `ui.tsx` |
