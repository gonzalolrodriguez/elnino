# Decisiones del proyecto

Registro de decisiones confirmadas por el equipo el 2026-11-17 (Fase 0). Todas las propuestas por defecto de CLAUDE.md §1.2 fueron aceptadas.

| # | Tema | Decisión confirmada |
|---|---|---|
| P1 | Estructura del monorepo | `apps/frontend`, `apps/mobile` (Expo), `apps/backend` (FastAPI) y `packages/shared` (constantes y, más adelante, tipos y cliente API generados desde OpenAPI). |
| P2 | Web | React 18 + TypeScript + Vite + Chakra UI + Framer Motion. React Three Fiber + Drei (landing, con alternativa 2D) y MapLibre GL JS + Deck.gl (panel) incorporados en las Fases 3 y 4. |
| P3 | App móvil | Expo + TypeScript + expo-router; mapas con `react-native-maps`, cola offline con `expo-sqlite`, tokens en `expo-secure-store`; APK con EAS Build (perfil `preview`). |
| P4 | Backend y base | FastAPI + PostgreSQL 16 + PostGIS + pgRouting con `docker-compose`; migraciones con Alembic (Fase 1; tres migraciones al cierre). |
| P5 | Datos posteriores al corte | Apagados por defecto (`PERMITIR_DATOS_POST_CORTE=false`). Se muestra el dato del corte (Puerto Formosa 5,60 m, `DATO OBSERVADO`, 31/10/2026). |
| P6 | Canales (WhatsApp, SMS, IVR) | Simulados con lógica real (mismo formato y parser que el canal real). |
| P7 | Notificaciones | Web: centro de notificaciones + WebSocket. Móvil: notificaciones locales; push remoto como fase opcional. |
| P8 | Lluvia | Partes policiales y cargas manuales, importación de la planilla UPCA y deslizador `SIMULADO` en el simulador. |
| P9 | Índice ISAD | Índice relativo rotulado `SIMULADO`, con pesos configurables; el disparador oficial es la altura de compromiso de K10. |
| P10 | Ruteo | pgRouting sobre red vial OSM/IGN recortada al corredor, con aristas bloqueables. |
| P11 | Reparto del equipo | (1) backend + datos + seguridad, (2) panel operativo web, (3) landing 3D + registro web, (4) app móvil. Propuesta por defecto: la asignación de cada integrante la confirma el equipo (ver `docs/ficha_tecnica.md`). |
| P12 | Chacras y campos reales | Opción (b): productores ficticios ubicados en el punto del paraje real, sin parcela. |

## Decisiones técnicas de la Fase 0

- Gestor de paquetes: pnpm con workspaces (sin `node-linker=hoisted`; ver la nota sobre React por paquete más abajo).
- Imagen de base de datos: `pgrouting/pgrouting:16-3.4-3.6.1` (PostgreSQL 16 con PostGIS y pgRouting; etiqueta verificada).
- La web usa React 18 (Chakra UI v2); la app móvil usa la versión de React que exige el SDK de Expo vigente (19.x). Cada paquete declara su propia versión.
- Dependencias del backend fijadas en `requirements.txt` y `requirements-dev.txt`.
- React por paquete: `react-router` y `react-router-dom` no declaran `@types/react` como peer, por lo que pnpm los resolvía desde el hoisting privado (`node_modules/.pnpm/node_modules`), que podía tomar `@types/react` 19 de la app móvil en la web (React 18) y rompía `tsc` (TS2786). Se resolvió con `packageExtensions` en `pnpm-workspace.yaml`, que declara ese peer opcional y obliga a enlazar los tipos de cada workspace. No se usa `node-linker=hoisted` (se descartó por romper las pruebas); el repositorio no tiene `.npmrc`.

## Hoja de ruta y pendientes

- **Bloqueo de login por cuenta sin verificación adicional.** El bloqueo temporal por intentos fallidos se aplica a toda la cuenta, no por origen ni dispositivo, y no hay un paso de desbloqueo (OTP o correo). Es un compromiso conocido: un tercero puede bloquear temporalmente una cuenta ajena a cambio de frenar la fuerza bruta. Mitigación futura: verificación por OTP o correo y límite por IP además del límite por cuenta.
- **Push remoto (FCM).** Fuera de alcance del MVP. Las alertas llegan como notificaciones locales con la app abierta (P7). Requiere development build y credenciales de FCM.
- **APK.** Compilarlo con EAS Build requiere la cuenta de Expo del equipo (`npx eas login`) y, para ver el mapa, una clave de Google Maps (`GOOGLE_MAPS_API_KEY`).

## Decisiones técnicas de la Fase 6 (entrega)

- **Puerto del backend en Docker configurable.** `docker-compose.yml` publica el backend en `${BACKEND_PORT:-8000}`; permite correr dos copias del proyecto a la vez (p. ej. desarrollo y prueba de clonado limpio) sin chocar de puerto. El valor por defecto no cambia.
- **Contraseña del admin en las pruebas.** El seed usa `DEMO_ADMIN_PASSWORD` para el admin si está definida (el `.env.example` la define distinta de `DEMO_PASSWORD`); las pruebas del backend ahora hacen lo mismo (`tests/conftest.py`, función `clave_demo`). Antes, con el `.env.example` sin tocar, 11 pruebas fallaban en la preparación con 401.
- **Esquema OpenAPI versionado.** `docs/openapi.json` se exporta de la aplicación para que la mesa pueda leer el contrato sin levantar el backend.
- **Afirmaciones sin fuente.** Tres frases cualitativas de la página Información (tema El Niño) no tienen respaldo oficial preciso; se declaran en `docs/ficha_fuentes.md` en lugar de inventar una fuente.
- **Publicación.** El tag evaluable `v1.0-entrega` se crea sobre `main` después del merge (pasos en `odd/tasks/fase-6-entrega.md`).

## Decisiones del pase de diseño web

- **Relieve real en la landing y en los mapas (planialtimetría).** El esquema dibujado a mano de la cuenca se reemplaza por relieve real: modelo de elevación (AWS Terrain Tiles, SRTM), curvas de nivel, río Paraguay (Natural Earth 1:10M), límite y nueve departamentos de Formosa (IGN). La escena 3D lleva exageración vertical ×60 rotulada en la leyenda; el esquema a mano queda solo como respaldo si no cargan los archivos. El mapa operativo (`/comando/mapa`) suma las capas "Departamentos de Formosa", "Curvas de nivel" (cada 2 m en el corredor de los sectores, con rótulos de cota) y "Relieve" (tinte a baja opacidad), activas por defecto, y el mapa SVG de sectores de `/informacion` usa las curvas del corredor y el límite departamental como fondo. Todo es `DOCUMENTO DE REFERENCIA`: el modelo tiene error vertical de varios metros y no reemplaza la altura de escala de K10 como disparador. Datos, intervalos y límites en `data/geo/LEEME.md`; regenerar con `apps/backend/scripts/descargar_relieve.py`. Los PNG y JSON se cargan por `fetch` desde `public/relieve/` para no engordar el bundle inicial.

- **La sección "El Niño" pasa a llamarse "Información".** Ruta `/informacion`; `/el-nino` se conserva como redirección (con su ancla, p. ej. `#fuentes`). El tema El Niño es ahora uno de los temas de la página, que además lleva un índice lateral. El contenido y las cifras no cambian.
- **Sistema visual en el tema de Chakra.** Los colores se escriben en OKLCH (`apps/frontend/src/estilo/paleta.ts`) y se compilan a hex porque Chakra, SVG, WebGL y Deck.gl necesitan RGB; los componentes usan tokens semánticos (`texto`, `primario`, `cat.simulado.bg`, `estado.en_riesgo.fill`, `umbral.alerta`). Un test verifica el contraste AA de los pares de texto.
- **Tipografía autoalojada.** Source Serif 4 (títulos y cifras) y Public Sans (texto), ambas variables, con `@fontsource-variable/*` fijados en versión exacta. La pila de respaldo mantiene la app legible sin conexión.
- **Categorías y estados no dependen solo del color.** DATO OBSERVADO lleva relleno sólido, DOCUMENTO DE REFERENCIA fondo de papel con borde continuo y SIMULADO borde punteado con rayado; cada insignia lleva el prefijo "Categoría:" para lectores de pantalla. Los estados de sector van siempre con texto y, en los mapas, con trazo (en riesgo punteado, comprometido rayado, aislado con borde grueso).
- **Movimiento.** Solo responde a acciones del usuario (pulsado de botones, transiciones de color) y hay un único momento orquestado en la landing: la escala de Puerto Formosa sube hasta el nivel del corte. Con `prefers-reduced-motion` todo queda quieto.

## Decisiones del pase de adaptabilidad web (320 a 2560 px, equipos antiguos)

- **Formularios con panel de apoyo.** Registro de ciudadanía, ingreso y `/app` usan `PaginaFormulario`: formulario (28 a 36 rem) y, desde 992 px, un panel de apoyo a la derecha con información real (para qué se usan los datos, derechos de la Ley 25.326, sectores K10 rotulados `SIMULADO`); en pantallas angostas el panel pasa debajo. No se agregan cifras nuevas. El registro de productores conserva el mapa como segunda columna.
- **Menú plegable bajo 768 px.** Botón "Menú" con `aria-expanded` y `aria-controls`; se cierra con Escape (el foco vuelve al botón) y al navegar. En el panel operativo la lista de secciones también se pliega bajo 992 px. El ancho máximo del contenido es 90 rem (110 rem en el panel).
- **Mapa operativo.** En pantallas angostas el mapa va primero y los paneles debajo (el orden del DOM coincide con el visual); en táctil se usa `cooperativeGestures` para que el mapa no atrape el desplazamiento de la página. Sin WebGL 2 se muestra un aviso en lugar del mapa.
- **Tablas.** Todas van en `TablaDesplazable`: región con nombre, enfocable por teclado y con sombra lateral donde queda contenido oculto. La página nunca se desplaza en horizontal.
- **Navegadores antiguos.** `@vitejs/plugin-legacy` 6.1.1 (compatible con Vite 6) con el piso Chrome 70, Safari 12, Firefox 78, Edge 79, Samsung 10; `build.cssTarget` baja el CSS al mismo piso. Respaldos propios en `src/estilo/base.css`: `:focus` cuando no existe `:focus-visible`, títulos de tamaño fijo sin `clamp()`, `overflow-x: hidden` sin `overflow: clip`, `dvh` solo con soporte, y márgenes en lugar de `gap` en flexbox (clase `sin-gap-flex`, detectada por `src/lib/compat.ts`). El gap en `Flex` suelto de Chakra solo se cubre para pilas, grupos de botones y controles de formulario.
- **Equipos de pocos recursos.** El 3D de la landing se usa solo con WebGL 2 y sin `prefers-reduced-motion`, y no en equipos con 2 núcleos o menos o 2 GB o menos de memoria (`navigator.hardwareConcurrency`, `deviceMemory`); si el navegador no informa un dato, no se infiere nada.
- **Accesibilidad adaptable.** Objetivos táctiles de 44 px con `pointer: coarse`; contraste alto (`prefers-contrast: more`) con bordes y texto secundario más fuertes; en colores forzados (`forced-colors`) las categorías se distinguen por el trazo (continuo, doble, punteado) y los estados de sector conservan su patrón. El gráfico de la serie K1 se redimensiona al ancho real para que el texto siga legible y admite toque (antes solo respondía al puntero).

