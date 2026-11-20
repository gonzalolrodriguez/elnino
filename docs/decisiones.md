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


## Decisiones del motor de evacuación (rama `dev-cabrera`, 19/11/2026)

Diagnóstico, tareas y criterios de aceptación en `odd/tasks/motor-evacuacion.md`.

- **¿Alcanza el tiempo?** El recomendador compara, por sector, el tiempo para completar el traslado con el plazo disponible y da un veredicto (`alcanza`, `justo`, `no_alcanza`, `ya_comprometido`, `sin_estimacion`). El plazo del río es un rango (tasa de ascenso más rápida y más lenta de K1, proyección lineal, `SUPUESTO`); el veredicto `alcanza` exige terminar dentro del plazo más corto dejando libre el 25 % (`margen_seguridad_fraccion`). Una holgura fija en horas se descartó: con una ventana seca de pocas horas ningún plan podía "alcanzar".
- **Ventana seca (Idea 1).** Entrada opcional `pronostico_lluvia` (mm y horas, `SIMULADO`). Si esa lluvia deja intransitable el acceso que usa el sector, el plazo es la hora de la lluvia. No se conecta un pronóstico real: los datos posteriores al corte siguen apagados (P5).
- **La lluvia cierra la red vial.** Los perfiles con ruedas aplican a los tramos de la red los mismos umbrales que a los accesos (tierra y superficie desconocida desde 30 mm, ripio desde 80 mm). Antes el ruteo podía sacar vehículos de un sector aislado por caminos de tierra mojados.
- **Tiempos por la red vial real.** El recomendador usa `pgr_dijkstraCost` (muchos a muchos) sobre la red de OpenStreetMap ya versionada en `data/geo/red_vial.geojson`, que `docker compose` carga al arrancar si la tabla está vacía. Sin red o sin ruta, la estimación aproximada sigue y se informa el método por tramo. El origen sigue siendo el centroide del sector (no hay puntos de encuentro reales cargados).
- **Enganche a la red.** Un punto se ancla al nodo más cercano con un tramo firme y usable para el perfil y la lluvia, si queda a no más de 500 m por encima del nodo más cercano (`ruteo_enganche_usable_m`). Sin ese tope el origen "saltaba" kilómetros por un camino cerrado sin costo; sin la preferencia por camino firme, el mismo sector tardaba más en seco que con lluvia.
- **Centros descartados.** Un centro dentro de un sector comprometido nunca recibe evacuados; dentro de uno en riesgo tampoco, con el supuesto `centro_excluir_en_riesgo` (criterio conservador). Hoy no afecta a los centros de demostración, pero sí afectaría a cualquier escuela real dentro de un sector (C4).
- **Reparto por flujo de costo mínimo.** Reemplaza al voraz por cercanía: respeta la prioridad (penalidad por persona sin lugar que crece con la prioridad y supera cualquier ahorro de tiempo) y minimiza personas × minutos. Implementación propia (caminos más cortos sucesivos) para no sumar dependencias. El voraz queda en `asignacion.asignar`.
- **Flota por tipo de vehículo.** Cada tipo (colectivo, camioneta 4x4, lancha, camión jaula) tiene su propia línea de tiempo: tipos distintos trabajan en paralelo. Antes todos los sectores se sumaban en secuencia, lo que sobrestimaba el tiempo total; los camiones jaula no tenían tiempo.
- **Familias indivisibles (pedido del equipo, 19/11/2026).** En una catástrofe, separar una familia agrava el daño: el plan nunca reparte un grupo familiar entre centros ni entre viajes distintos. Si no entra entero en ningún centro, se informa y decide una persona con rol autorizado. Se resolvió en dos etapas: el flujo de costo mínimo fija los cupos por sector y las familias se colocan enteras dentro de esos cupos; primero las que tienen menores o mayores y después las más grandes. Así se conserva la prioridad entre sectores y casi todo el ahorro de tiempo del flujo. Con la red real y el set de hogares, a 7,60 m y 40 mm, se ubican 328 familias enteras y la cantidad de personas con lugar es la misma que repartiendo el total (1.250).
- **Set separado de hogares SIMULADOS.** K10 no tiene hogares. Para probar el criterio con toda la población se generó `data/simulado/hogares_k10.json`, que divide la población de K10 (sin cambiarla, D8) con tamaños de hogar `SUPUESTO`. No se usó el censo porque no se pudo obtener el cuadro de hogares por cantidad de personas de Formosa. Es opcional (`poblacion_k10_en_hogares`); la demo sigue igual.
- **Fuera de este paso:** cohesión de sector (vecinos al mismo centro) y mascotas en el centro asignado.
- **Pendiente de decisión del equipo:** centros y puestos reales (C4).
