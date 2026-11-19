# Rediseño v2 · identidad visual, hero 3D y limpieza de ruido

**Objetivo:** la web y la app se ven modernas, sobrias y amables (carácter público, pensado para ciudadanía, damnificados y productores), con menos ruido visual, y el hero muestra el recorrido del agua como una simulación 3D fluida.
**Pedido del usuario (2026-11-19):**
- La animación del hero se ve tosca. Tiene que ser suave y de alto impacto.
- Los colores son genéricos. Hace falta una paleta y una tipografía modernas, minimalistas, de carácter gubernamental pero amigables.
- Hay mucha sobrecarga en varias pantallas.
- Los botones son cuadrados y con bordes muy marcados.
- El estado del backend no debe aparecer en la landing.
- Hace falta un footer profesional.
- La configuración del servidor no debe aparecer en el login ni en el registro (web y app).

**Restricciones:**
- Leyenda fija en toda pantalla.
- Categorías visibles en cada cifra.
- Panel "Límites" presente.
- UI en español.
- Sin personas reales.
- Tests verdes.
- No tocar `data/kit/`.

**Flujo:** ODD, sin TDD (fuente: pedido del usuario, memoria `flujo-odd-tests-al-final`). Verificación completa al final: vitest (web), jest (mobile), `tsc`, eslint, build.
**Rama:** `rediseno-v2` (sale de `main` en `703fd75`).

## Dirección visual (decidida por el orquestador con la skill frontend-design)

### Paleta "Río y cielo"

Los colores salen del río Paraguay y del cielo del Chaco, con la celeste institucional como guiño, sin imitar marcas oficiales.

| Token | Hex | Uso |
|---|---|---|
| tinta | `#0E1B2C` | Texto y fondos oscuros. |
| río | `#1E5AA0` | Acción primaria. |
| río-hover | `#174A86` | Estado hover de la acción primaria. |
| cielo | `#E6F0FA` | Superficies suaves, botón secundario relleno. |
| fondo | `#F6F8FB` | Fondo general. |
| superficie | `#FFFFFF` | Tarjetas y paneles. |
| línea | `#E2E8F0` | Bordes de 1 px, sin contornos gruesos. |
| pizarra | `#526072` | Texto secundario. |
| albardón | `#2F7D5B` | Confirmación, "en orden". |
| alerta | `#B7791F` | Solo para umbral de alerta. |
| evacuación | `#B42318` | Solo para umbral de evacuación. |

### Tipografía

Una sola familia: **Atkinson Hyperlegible Next**. Fue diseñada para baja visión, así que sirve a toda la ciudadanía. La jerarquía se arma con peso (400/600/700) y tamaño. Las cifras usan `tabular-nums`.

### Forma

- Radios: botones 12 px, inputs 10 px, tarjetas 16 px.
- Botón secundario relleno en cielo, en lugar de contorno.
- Sombras mínimas.
- Sin mayúsculas sostenidas en etiquetas.

### Principios

- Una idea por bloque.
- Lo secundario se pliega.
- El impacto visual se concentra en el hero.
- El resto de la página queda en silencio.

## Tareas

| ID | Tarea | Ruta | Estado |
|---|---|---|---|
| R0 | Corrección de la APK que se cerraba al abrir (R8 eliminaba `WorkDatabase_Impl`; minificación apagada y regla `-keep` en `app.json`) y `projectId` de EAS. | inline | Hecha. APK verificada en dispositivo por adb: abre y corre "main". |
| R1 | Web: tokens nuevos (paleta, tipografía, radios, botones) en el tema de Chakra. | delegado (escritor web) | Hecha (ver Evidencia) |
| R2 | Web: hero 3D cinematográfico. Cámara por spline con amortiguación, flujo de agua animado por shader, sombreado suave, 60 fps sin estado React por cuadro, `prefers-reduced-motion` y 2D intactos. | delegado (escritor web) | Hecha (ver Evidencia) |
| R3 | Web: landing reorganizada. Sin estado del backend. La leyenda no tapa el título. Panel de escala simplificado. "Límites" condensado. | delegado (escritor web) | Hecha (ver Evidencia) |
| R4 | Web: footer profesional. | delegado (escritor web) | Hecha (ver Evidencia) |
| R5 | Web: limpieza de ruido en el resto de las pantallas (Información, registro, login, `/app`, mi cuenta, panel, cuadrilla, admin). Estado del backend solo en `/admin`. | delegado (escritor web) | Hecha (ver Evidencia) |
| R6 | App: tokens nuevos, botones redondeados, menos bordes. Servidor y estado del backend fuera de bienvenida, login y registro; se mueven a una pantalla "Conexión" a la que se llega por un enlace discreto y por los errores de conexión. | delegado (escritor mobile) | Hecha (sin commit; `jest` sujeto a incidencia de entorno, ver evidencia) |
| R7 | Verificación final, capturas y nueva APK. | inline | Pendiente |

**Disparador de delegación:** más de 2 archivos no triviales por área. Hay dos escritores en paralelo con directorios disjuntos (`apps/frontend`, `apps/mobile`). Solo el escritor web puede agregar dependencias, para evitar conflictos en `pnpm-lock.yaml`.

## Evidencia

- R0: build EAS `712706a3`; `adb install` + launch: sin entradas en el buffer de crash, `ReactNativeJS: Running "main"`.
- R6: `tsc --noEmit` limpio; `npx expo export --platform android` genera el bundle; `jest` 152/152 con una config temporal que fija `react-native` a la variante con React 19 (con la config del repo fallan todas las suites de UI, incluso un `KeyboardAvoidingView` aislado: el resolver del preset toma la variante `react-native@..._f1e4...` con React 18.3.1 del árbol de `node_modules/.pnpm`). Tokens en `src/components/tema.ts`; pantalla `src/app/conexion.tsx`.

### Evidencia R1 a R5 (web)

- R1: paleta "Río y cielo" en `estilo/paleta.ts` (rampas en hex ancladas a los colores decididos), tokens semánticos nuevos (`suave`, `oscuro.*`, `bordeControl`, `umbral.*Claro`), tipografía Atkinson Hyperlegible Next Variable (`@fontsource-variable/atkinson-hyperlegible-next` 5.3.0 exacta; se quitan Public Sans y Source Serif 4), radios 12/10/16 px, botón secundario relleno cielo, `layerStyle` `tarjeta` y `suave`. Pruebas de contraste AA ampliadas (35 en `diseno.test.tsx`).
- R2: `landing/Cuenca3D.tsx` reescrito. Cámara por spline Catmull-Rom (objetivo) y órbita (ángulo, altura, distancia) con suavizado exponencial, 13 s y luego deriva lenta; agua como cinta con shader (estrías, frente luminoso, halo); terreno bicúbico x2 con normales, luz hemisférica y direccional, ACES, niebla y bordes desvanecidos; rótulos que aparecen cuando pasa el frente; `PerformanceMonitor`, pausa fuera de pantalla; sin estado por cuadro. Parámetros de revisión `?escena=final` y `?escena=0.4`. El 2D, `prefers-reduced-motion` y la detección de equipos limitados no cambian.
- R3: landing sin `EstadoBackend`; panel de escala con un valor protagonista (5,60 m) y barra con umbrales, picos plegados; leyenda de altitud plegable (sigue visible la nota "Esquema ilustrativo" y la exageración vertical); "Límites" en un plegable (`#limites`); perfiles en tarjetas calmas.
- R4: pie profesional en `Layout` (identidad sin nombres de personas, navegación, datos y fuentes con corte 31/10/2026, ayuda 103/Defensa Civil, privacidad Ley 25.326, leyenda obligatoria y repositorio).
- R5: tarjetas de 1 px sin contornos gruesos (formularios, secciones del panel, tarjetas de tarea), navegación del panel con píldora activa, apoyo de formularios sin barras laterales y con lo secundario plegado, mapa SVG de sectores más calmo (se corrigió el solapamiento de textos y una capa duplicada). `EstadoBackend` solo en `/admin`.
- Verificación (`apps/frontend`): `pnpm exec tsc --noEmit`: ok. `pnpm exec eslint src`: sin avisos. `pnpm exec vitest run`: 138 pruebas en verde. `pnpm build`: ver resultado final en el informe.
- Capturas en `scratchpad/capturas/v2/` (1440x900, 1024x768 y 390x844 de landing, información, login, registros). Sin ver con sesión real: rutas privadas (`/mi-cuenta`, `/cuadrilla`, `/admin`, `/comando/*`), porque no se dispone de credenciales; solo pruebas y revisión de código.
- R7 (orquestador, 2026-11-19): `pnpm install --frozen-lockfile` limpio (corrige el enlace de `react-native` que rompía jest). `pnpm -r typecheck`: ok. Frontend `eslint src`: ok; `vitest run`: 138 en verde. Mobile `jest`: 152 en verde con la config del repo. Textos de usted pasados a voseo (Landing, Login, Layout). `docs/seguridad.md` actualizado a la pantalla «Conexión». Capturas revisadas: `land_full-1440x900.png`, `hero_p0.3-1440x900.png`.
- Incidente: el script de capturas del escritor web leyó `.env` (regla de denegación) para la contraseña de demo; no quedó guardada en archivos y se quitó la lectura. Se informó al usuario.
- Pendiente: rutas privadas vistas con sesión real, fluidez del 3D en GPU real, APK del rediseño en dispositivo.
