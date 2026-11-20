# Ficha técnica · AI LAB Misión: Código Formosa
PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial · Entrega: viernes 20/11/2026, 18 h

**Nombre de la herramienta:** Plataforma de Gestión de Evacuaciones (Operación Agua)
**Equipo · institución · integrantes y rol de cada uno:** Equipo 3 · Instituto Politécnico Formosa (IPF).
- Gonzalo Rodríguez: backend (API, datos, base PostGIS y seguridad).
- Dylan Cabrera: frontend web.
- Javier Martínez: frontend web.
- Franco Villalba: app móvil.
**Reto:** 2 Simulador (Desafío 06 · Evacuaciones)

## Usuario y pregunta
Lo usa el Comité de la Misión (los tres técnicos de la mesa interinstitucional) y, en el diseño, los mandos operativos de cada sector. Responde: ¿cómo organizar la información territorial para planificar y simular una evacuación (personas y producción) de manera más clara y ordenada, antes de que la lluvia o el río aíslen a la gente?

## Qué funciona hoy
Lo que sigue se probó con pruebas automáticas o con una ejecución real, según se indica. Todo lo que calcula la herramienta es `SIMULADO`; los datos del kit conservan su categoría.

- **Limpieza de K1 reproducible** (`python -m app.ingest.limpieza_k1`): 8.347 filas de entrada, 8.335 finales (8.334 válidos y 1 en cuarentena); máximo 9,81 m (05–06/01/2016); registro en `docs/registro_limpieza.md`. Probado con pruebas del backend.
- **Simulador de escenario** (`POST /simulacion/escenario`): con 7,60 m y 40 mm, S4 queda comprometido y aislado, S1 y S3 en riesgo, S2 normal y el río normal a 0,20 m de la alerta; una altura de 13 m se rechaza con 422. Verificado en un backend real y con pruebas.
- **Caminos no transitables:** el operador marca un acceso como cerrado con su motivo y el escenario lo recalcula (`PATCH /accesos/{id}`). El cierre también excluye los tramos de la red vial asociados a ese acceso en el ruteo con pgRouting (probado con pruebas del backend).
- **Recomendador y comparador de alternativas:** personas por sector (K10 más familias registradas en el polígono), asignación a centros por capacidad con quiénes quedan sin lugar, viajes por vehículo y tres alternativas lado a lado. Es una recomendación, no una orden.
  - Tiempos de viaje por la red vial real (OpenStreetMap), con la lluvia cerrando tramos de tierra y ripio.
  - Veredicto "¿alcanza el tiempo?" por sector, con holgura del 25 % y el ganado 48 h antes (supuestos), y lluvia prevista SIMULADA opcional para la ventana seca.
  - Las familias nunca se separan entre centros ni entre viajes. Hay un set aparte de hogares SIMULADOS para probarlo.
  - Desde la recomendación, "Preparar orden con estos sectores" abre Órdenes con los sectores marcados; la orden la sigue emitiendo el decisor.
- **Ruteo** vehicular, de camión jaula y de arreo con pgRouting sobre la red OSM del corredor; sin red cargada, estimación aproximada con su limitación a la vista.
- **Arca Productiva** (calculadora ganadera): reproduce el caso de control (150 m², 1 camión con divisiones, 58,4 kg de maíz y 5,5 kg de pellet por día).
- **Órdenes y bitácora K8:** solo el rol `decisor` emite órdenes; cada una crea notificaciones, tareas de cuadrilla y un borrador de bitácora con los seis campos obligatorios, exportable a Markdown.
- **Centinela:** auditoría de la limpieza de K1, verificador de las afirmaciones de K6 (refuta "10,7 m en 2016" y "superó la evacuación en octubre" con datos de K1) y de las siete relaciones de K7 (algunas "no verificables con la capa disponible").
- **Monitor hidrométrico:** serie K1 con umbrales de K3, picos y velocidades de ascenso de 2015–16, 2019 y octubre de 2026, con rango y supuesto lineal.
- **Lluvia:** partes por formulario, planilla UPCA (vacío distinto de 0) y canales simulados (WhatsApp, SMS, IVR) con firma HMAC; el origen siempre queda visible.
- **Portal público:**
  - Landing con el relieve real de la cuenca en 3D (SRTM, curvas de nivel, departamentos) y alternativa 2D.
  - El recorrido del agua desde el Pantanal hasta la confluencia con el Paraná se puede explorar: arrastrar, zoom y una barra para recorrer el río por sus hitos.
  - Página Información (El Niño, serie K1, sectores y fuentes).
  - Franja "Cómo estamos hoy" en lenguaje llano, con "Emergencia: 103" visible. Con sesión iniciada, la landing muestra el acceso de cada rol en lugar del selector de perfil.
  - Registro de ciudadanía y de productores con consentimiento. La ubicación se toma del GPS, se marca en un mapa (con los sectores K10) o se escribe a mano.
  - **Mi cuenta como panel personal:**
    - Estado del sector en una frase, con el río frente a la altura de compromiso.
    - El pedido activo como seguimiento de envío: recibido, verificado, cuadrilla asignada (por rol y vehículo), en camino, asistido y confirmado.
    - Avisos por gravedad, centro asignado, historial de pedidos y grupo familiar.
    - Al cerrar la tarea, el ciudadano confirma con cinco opciones: por completo, en parte, no me encontraron, no vinieron u otro problema. También puede hacerlo por SMS.
  - Diseño accesible: tipografía para baja visión, 320 px a 4K y navegadores antiguos.
- **Tablero de decisión** (`/comando`):
  - Para el decisor: río frente a umbrales con tendencia y tiempo restante con su supuesto, estado de los cuatro sectores, pedidos por estado, sector y canal, ocupación de centros, cuadrillas, órdenes, lluvia por origen y antigüedad de cada dato.
  - Para el operador, la cola de pedidos va primero.
  - Menú ordenado por el flujo de trabajo: Situación, Decidir, Ejecutar y Respaldo y registro. La altura del río y la lluvia del escenario se cambian desde cualquier página.
  - **Cuadrillas:** una página con cada cuadrilla, sus integrantes por rol (sin nombres), vehículo, tarea actual, último parte y dificultades abiertas. El operador asigna integrantes.
  - Para el administrador: usuarios, cuentas bloqueadas, integridad de la bitácora de accesos y estado del servicio.
- **Constancias y validación cruzada de evacuaciones:**
  - La cuadrilla cierra cada tarea con una constancia: destino por GPS, centro, personas y animales trasladados, fotos, nota y rol firmante. Funciona sin conexión desde la app.
  - El evacuado confirma "¿llegaste a X?" por la app o por SMS desde su teléfono registrado.
  - Cada evacuación queda pendiente, en curso, cerrada por la cuadrilla, verificada o con discrepancia. Una discrepancia es una marca para revisar, no una acusación.
  - Esta información se ve en el tablero, en una página propia y como capa de traslados en el mapa.
- **Partes de la cuadrilla:** desde la web o la app (con cola sin señal), la cuadrilla informa avances, dificultades y el resultado de cada tarea: completa, a medias, no realizada o reprogramada. La observación es obligatoria si no fue completa. Una tarea a medias vuelve a pendiente marcada "requiere atención" para que el operador la reasigne. El ciudadano ve que hubo una novedad, sin el texto de la observación.
- **Sin datos móviles:**
  - Desde la app y sin cuenta: "Llamar al 103" y "Pedir ayuda por SMS", con el mensaje armado con el GPS del teléfono, que funciona sin datos.
  - Guía "Qué hacer" offline con los números 103, 106, 911 y 105.
  - Los canales simulados aceptan texto libre ("somos 5 y tenemos 40 vacas") y una referencia de ubicación cuando no hay GPS, que luego verifica un operador.
  - Responden a las palabras clave `AYUDA`, `INFO` y `SOS`.
- **Seguridad:**
  - Contraseñas con Argon2id.
  - Acceso con JWT de 15 minutos y refresh rotativo. El refresh admite un único reintento de 30 s ligado al mismo cliente, pensado para redes rurales.
  - Login con respuesta genérica.
  - RBAC por endpoint y por recurso.
  - Cifrado AES-GCM de campos sensibles.
  - Bitácora de accesos con hash encadenado.
  - Idempotencia en pedidos, órdenes y constancias.
  - Cuotas blandas sin CAPTCHA.
  - Mapeo a OWASP Top 10:2025 y Mobile Top 10 2024 en `docs/seguridad.md`.
  - Auditoría del 20/11/2026 sobre lo agregado: límites por usuario, vencimiento de posiciones, borrado de datos guardados en el teléfono al vencer la sesión, política de seguridad de contenido (CSP) en la web y FastAPI/Starlette actualizados (`pip-audit` sin hallazgos).
- **App móvil (Expo):**
  - Registro, login y perfil.
  - Pedido de asistencia con cola offline: envío en dos tiempos, idempotencia y reintentos acotados.
  - Estado del sector visible sin conexión, alertas y mapa del sector.
  - Modo cuadrilla con cierre con constancia.
  - Pestaña Monitor para mandos.
  - Pantalla de conexión aparte de login y registro.
  - "Necesito ayuda ahora": un toque, cuenta regresiva cancelable de 5 s, GPS automático y envío por la cola sin conexión.
  - Barra fija en todas las pantallas con el 103, el estado de conexión y los pedidos pendientes.
  - Mis pedidos con línea de tiempo, cuadrilla, vehículo y llegada estimada.
- **Distintivos SAPUKAY:**
  - **Tres relojes:** río (DATO OBSERVADO, distancia a la alerta y rango de días con supuesto lineal), barro (SUPUESTO: la tierra se corta con 30 mm y S4 se compromete 30 cm antes de la alerta) y El Niño (DOCUMENTO DE REFERENCIA, CFS v2). Están en la landing y en el tablero.
  - **Cuadrilla en camino:** con una tarea en curso, la cuadrilla comparte su posición desde la app o la web. El solicitante ve en un mapa el recorrido por la red vial (evitando caminos cerrados), el vehículo avanzando y la llegada estimada (supuesto de velocidad). El panel tiene una capa de cuadrillas. La posición solo se guarda mientras dura la tarea, vence a los 30 minutos y solo la ven el solicitante y los roles operativos. Para la demostración, sin un teléfono real, el servidor mueve al vehículo por la ruta desde una base SIMULADA, rotulado "SIMULADO · recorrido de demostración".
  - **Brújula sin conexión:** en la app, una flecha apunta al centro asignado o al más cercano, guardado en el teléfono, con la distancia en línea recta y la advertencia de que no es un camino.
  - **Lámina de agua ilustrativa:** en el simulador, cada sector se cubre según cuánto supera el río su altura de compromiso (K10). Los accesos cortados se ven discontinuos y hay un botón "Reproducir subida". No es un modelo hidráulico.
- **Pruebas automáticas al 20/11/2026:** backend 426, web 329 y app 314, todas en verde, con ruff, tsc y eslint limpios. Un APK anterior generado con EAS Build se instaló y abrió en un teléfono Android físico, verificado por adb.

Se vieron en un navegador, contra el backend real, la landing (con y sin sesión), Mi cuenta de una ciudadana de prueba con su pedido y el mapa de OpenStreetMap, y los tres relojes. El panel rediseñado, la página de cuadrillas y el recorrido animado se revisaron con capturas sobre datos simulados.

No se comprobó todavía:
- El uso completo de la app en un teléfono: GPS, cámara, cola sin señal, llamada al 103 y SMS.
- La fluidez del 3D en distintos equipos.
- La política de seguridad de contenido (CSP) en la versión compilada de la web.
- La brújula y la lámina de agua, que solo tienen pruebas automáticas.

## Qué falta para que la mesa la use
- **Datos reales de la autoridad:** qué edificios son centros de recepción y su capacidad (hoy `SIMULADO`; las escuelas del Mapa Educativo son solo candidatas), recursos disponibles, responsables por rol y sectores definitivos (K10 es simulado y está "a validar por la mesa"). Dependen de Defensa Civil y del comité.
- **Datos que el kit no trae:** lluvia observada (conectar la red de partes de la Policía/UPCA), cotas y barrios reales, caminos con su estado real, catastro parcelario de Formosa (sin descarga pública; hoy los productores de demostración se ubican en el paraje, sin parcela), población por radio censal (INDEC 2022) y las series K2, K4 y K5 pendientes del kit.
- **Verificación de supuestos:** capacidad de camiones jaula y de vehículos categoría B, raciones, dormidero, velocidades por superficie, umbrales de lluvia por tipo de camino y pesos del ISAD son supuestos del equipo (`apps/backend/app/config/supuestos.yaml`); necesitan validación de INTA, SENASA y Vialidad.
- **Integraciones reales:** WhatsApp (Meta Cloud API), gateway SMS y número de voz (IVR), y notificaciones push remotas (FCM). Hoy están simulados o son locales. Están documentados los proveedores posibles y sus restricciones en Argentina. Por ejemplo, el short code para SMS demora semanas de aprobación.
- **Voz e IA (hoja de ruta):**
  - Transcripción de llamadas en español rioplatense: Whisper local o un servicio en la nube, a evaluar.
  - Asistente orientativo que ayude a armar el reporte. Solo orienta y estructura; nunca decide.
  - El equipo todavía no decidió si la IA corre en la nube o en el equipo local.
- **Lugares reales en la base:** las escuelas del Mapa Educativo y las localidades de BAHRA están descargadas en `data/geo/`, pero la carga de demostración todavía usa centros y puestos de lluvia simulados.
- **Para operar en serio:**
  - Despliegue con HTTPS y un perfil de compilación de la app sin tráfico `http`.
  - Verificación en dos pasos (MFA) para usuarios institucionales.
  - Recuperación de cuenta sin contraseña (OTP o sesión ligada al dispositivo).
  - Migrar `react-router` a la versión 7, que tiene un aviso de seguridad moderado sin parche en la 6.
  - Inscripción de la base ante la AAIP.
  - Prueba con usuarios de campo.

  Estimación del equipo: varias semanas de trabajo sostenido y la participación de la autoridad. No hay una cifra confirmada.

## Cómo está hecha
- **Backend:** Python 3.12 (probado con 3.13), FastAPI 0.165 (Starlette 1.10), Pydantic 2, SQLAlchemy 2 + GeoAlchemy2, Alembic, PostgreSQL 16 con PostGIS y pgRouting (imagen `pgrouting/pgrouting:16-3.4-3.6.1`), Argon2, PyJWT, `cryptography`, slowapi, openpyxl, pytest y ruff.
- **Web:** React 18, TypeScript, Vite 6, Chakra UI 2, Framer Motion, React Three Fiber y Drei (landing), MapLibre GL 6 y Deck.gl (mapa), tipografía Atkinson Hyperlegible Next, `@vitejs/plugin-legacy` (navegadores antiguos), vitest.
- **App móvil:** Expo SDK 58, React Native 0.88, expo-router, expo-sqlite, expo-secure-store, expo-location, react-native-maps, jest-expo; APK con EAS Build (perfil `preview`).
- **Monorepo:** pnpm 10 con workspaces; Node 24.
- **Datos:** kit del evento (K1, K3, K10, planilla) sin modificar; capas oficiales de IGN, BAHRA/Georef, Mapa Educativo, REFES y OpenStreetMap, versionadas con su fuente, licencia y fecha (`data/geo/`).
- **Uso de IA:** se usó Claude Code (Anthropic) como asistente de desarrollo para escribir código, pruebas y documentación bajo la dirección del equipo. Las decisiones de alcance, stack y diseño (D1 a D8 y P1 a P12) las tomó el equipo y quedan registradas en `docs/decisiones.md`; el trabajo se hizo por fases con revisión humana antes de cada commit. Usamos agentes de IA para auditorías de solo lectura: bugs, diseño y organización de la información, seguridad OWASP, canales sin datos e imágenes satelitales. Las revisiones automáticas de seguridad marcaron fallas, que se corrigieron con pruebas; las que quedan abiertas figuran como riesgos aceptados en `docs/seguridad.md`. El producto no usa IA en su lógica de decisión: el escenario, el recomendador, el ruteo y los verificadores son reglas y cálculos deterministas con supuestos explícitos. El informe K6, generado por IA, se trata como material a auditar: el verificador contrasta cada afirmación con K1, K3 y K9 y muestra el veredicto con su evidencia. Una IA asistió también en el diseño inicial (investigación y pilares), cuyos errores se corrigen en CLAUDE.md §16.

## Lo que la herramienta no puede decir
- **No decide ni ordena una evacuación:** la orden la emite una persona con rol autorizado y queda registrada; la plataforma solo recomienda y simula.
- **No tiene** lluvia observada, pronóstico hidrológico a más de 15 días, cotas, barrios ni centros reales, ni alturas anteriores a 2006 (1983, 1992 y 1998 no se muestran). Lo declara el panel "Límites".
- **Todo lo calculado es `SIMULADO`:** sectores K10, accesos, centros y su capacidad, recursos, personas, lluvia de demostración, ISAD, recomendaciones, alternativas y tiempos. El ISAD es un índice relativo y no reemplaza el criterio de compromiso de K10.
- **El tiempo restante** es una proyección lineal a tasa constante, con rango y supuesto; no es un pronóstico.
- **K1 es un dataset pedagógico** con alteraciones deliberadas: no es una serie oficial ni apta para operar. Un valor imposible (98,1 m el 15/07/2012) quedó en cuarentena y los 25 días sin dato de 2018 no se interpolaron. El pico de 2019 (9,72 m) figura el 02/06 en la serie, mientras otros documentos citan el 03/06 por el huso horario.
- **K7 se audita solo en parte:** la capa de cursos de agua del IGN de Formosa no incluye el Paraná ni Corrientes, por lo que dos de las siete relaciones quedan "no verificables con la capa disponible"; las distancias se calculan con una proyección aproximada.
- **Ganadería:** camiones por 30 bovinos, vehículos categoría B de 40 animales, dormidero de 5 m² y raciones son supuestos o cifras de INTA "a verificar"; no son normativa. La ración del ternero al pie y de vaquillona y toro es un supuesto del equipo.
- **Pronóstico estacional:** el informe CFS v2 es de un tercero y orientativo. Es inconsistente consigo mismo en el índice ONI (una diapositiva indica +2,2 y 93 %; otra +2,3 y 99 %); el portal usa la cifra de la diapositiva de contexto y lo declara.
- **Establecimientos de salud:** la ubicación es aproximada (centroide de la localidad), porque REFES no publica coordenadas.
- **Red vial OSM:** de los 12.987 tramos del corredor, 4.255 figuran como pavimento, 6.345 como tierra y 2.387 con superficie desconocida; ninguno está etiquetado como ripio (OSM usa `unpaved` de forma genérica y aquí se mapea a tierra). El ruteo trata la superficie desconocida como tierra y el umbral de lluvia para ripio solo se aplica a los accesos simulados de los sectores.
- **Chacras y campos reales:** no hay padrón parcelario abierto; los productores y familias son ficticios y no se asocian a parcelas reales.
- **Tres frases cualitativas de la página Información (tema El Niño)** (rezago de semanas a meses, aviso con semanas de anticipación, anegamiento en horas) no tienen fuente oficial precisa; están declaradas en `docs/ficha_fuentes.md`.
- **Datos posteriores al corte (31/10/2026)** están apagados por defecto.
- **Una evacuación "verificada" no es una prueba.** Solo significa que la constancia de la cuadrilla y la respuesta del evacuado coinciden. Un SMS puede suplantarse en la red móvil. La distancia máxima entre destino y centro (500 m) es un supuesto. Una discrepancia solo marca el caso para revisarlo.
- **Los pedidos por texto libre o sin GPS** tienen ubicación aproximada y siempre requieren la verificación de un operador. La plataforma nunca completa datos que la persona no dio.

## Cómo se arranca (cinco líneas)
Requisitos: Node 24, pnpm 10, Python 3.12 o superior y Docker. Detalle y puertos en el `README.md`.
1. `cp .env.example .env` y completar `JWT_SECRET`, `FIELD_ENCRYPTION_KEY`, `CANAL_HMAC_SECRET` y las claves de demostración; luego `pnpm install`.
2. `docker compose up -d --build` (base de datos y backend; aplica migraciones y carga los datos de demostración).
3. `curl http://localhost:8000/api/v1/salud` debe responder `"estado":"ok"`.
4. `pnpm dev:web` y abrir http://localhost:5173; ingresar como `decisor@demo.evacuaciones.invalid` (contraseña `DEMO_PASSWORD` del `.env`).
5. App móvil: `pnpm dev:mobile` (Expo Go; el mapa y el APK requieren un development build, ver README).

## Repositorio

Tema elegido: Desafío 06 · Evacuaciones (simulador). URL del monorepo: https://github.com/gonzalolrodriguez/elnino · Commit o tag evaluable: tag `v1.0-entrega` sobre `main` (se mueve al último merge antes de la entrega del 21/11). Frontend: `apps/frontend`; backend: `apps/backend`; app móvil: `apps/mobile`; paquete compartido: `packages/shared`. Configuración: `.env.example`. Comandos de ejecución y de prueba: `README.md`. Fuentes: `docs/ficha_fuentes.md`; limpieza de K1: `docs/registro_limpieza.md`; contrato: `docs/contrato_api.md` y `docs/openapi.json`; arquitectura: `docs/arquitectura.md`; seguridad: `docs/seguridad.md`.
