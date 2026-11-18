# Ficha técnica · AI LAB Misión: Código Formosa
PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial · Entrega: viernes 20/11/2026, 18 h

**Nombre de la herramienta:** Plataforma de Gestión de Evacuaciones (Operación Agua)
**Equipo · institución · integrantes y rol de cada uno:** Equipo 3 · Instituto Politécnico Formosa (IPF) · Gonzalo Rodríguez, Franco Villalba, Dylan Cabrera y Javier Martínez. Reparto de roles (propuesta, a confirmar por el equipo): (1) backend, datos y seguridad; (2) panel operativo web; (3) landing 3D y registro web; (4) app móvil. La asignación de cada integrante a cada rol la confirma el equipo antes de la entrega.
**Reto:** 2 Simulador (Desafío 06 · Evacuaciones)

## Usuario y pregunta
Lo usa el Comité de la Misión (los tres técnicos de la mesa interinstitucional) y, en el diseño, los mandos operativos de cada sector. Responde: ¿cómo organizar la información territorial para planificar y simular una evacuación (personas y producción) de manera más clara y ordenada, antes de que la lluvia o el río aíslen a la gente?

## Qué funciona hoy
Lo que sigue se probó con pruebas automáticas o con una ejecución real, según se indica. Todo lo que calcula la herramienta es `SIMULADO`; los datos del kit conservan su categoría.

- **Limpieza de K1 reproducible** (`python -m app.ingest.limpieza_k1`): 8.347 filas de entrada, 8.335 finales (8.334 válidos y 1 en cuarentena); máximo 9,81 m (05–06/01/2016); registro en `docs/registro_limpieza.md`. Probado con pruebas del backend.
- **Simulador de escenario** (`POST /simulacion/escenario`): con 7,60 m y 40 mm, S4 queda comprometido y aislado, S1 y S3 en riesgo, S2 normal y el río normal a 0,20 m de la alerta; una altura de 13 m se rechaza con 422. Verificado en un backend real y con pruebas.
- **Caminos no transitables:** el operador marca un acceso como cerrado con su motivo y el escenario lo recalcula (`PATCH /accesos/{id}`).
- **Recomendador y comparador de alternativas:** personas por sector (K10 más familias registradas en el polígono), asignación a centros por capacidad con quiénes quedan sin lugar, viajes por vehículo y tres alternativas lado a lado. Es una recomendación, no una orden.
- **Ruteo** vehicular, de camión jaula y de arreo con pgRouting sobre la red OSM del corredor; sin red cargada, estimación aproximada con su limitación a la vista.
- **Arca Productiva** (calculadora ganadera): reproduce el caso de control (150 m², 1 camión con divisiones, 58,4 kg de maíz y 5,5 kg de pellet por día).
- **Órdenes y bitácora K8:** solo el rol `decisor` emite órdenes; cada una crea notificaciones, tareas de cuadrilla y un borrador de bitácora con los seis campos obligatorios, exportable a Markdown.
- **Centinela:** auditoría de la limpieza de K1, verificador de las afirmaciones de K6 (refuta "10,7 m en 2016" y "superó la evacuación en octubre" con datos de K1) y de las siete relaciones de K7 (algunas "no verificables con la capa disponible").
- **Monitor hidrométrico:** serie K1 con umbrales de K3, picos y velocidades de ascenso de 2015–16, 2019 y octubre de 2026, con rango y supuesto lineal.
- **Lluvia:** partes por formulario, planilla UPCA (vacío distinto de 0) y canales simulados (WhatsApp, SMS, IVR) con firma HMAC; el origen siempre queda visible.
- **Portal público:** landing con esquema 3D de la cuenca y alternativa 2D, página El Niño con fuentes, registro de ciudadanía y de productores con consentimiento, y área "mi cuenta".
- **Seguridad:** Argon2id, JWT de 15 minutos con refresh rotativo, RBAC por endpoint y por recurso, cifrado AES-GCM de campos sensibles y bitácora de accesos con hash encadenado (`docs/seguridad.md`).
- **App móvil (Expo):** registro, login, perfil, pedido de asistencia con cola offline (envío en dos tiempos e idempotencia), alertas, mapa del sector y modo cuadrilla.
- **Prueba desde clonado limpio:** siguiendo solo el README, el backend con Docker, la web y la app pasan sus pruebas (backend 202, web 53, app 36).

No se pudo comprobar todavía: el aspecto y el comportamiento visual en un navegador y en un teléfono físico (mapa, gráficos, diseño adaptable, cámara y GPS), la subida de fotos desde un dispositivo real y la compilación del APK.

## Qué falta para que la mesa la use
- **Datos reales de la autoridad:** qué edificios son centros de recepción y su capacidad (hoy `SIMULADO`; las escuelas del Mapa Educativo son solo candidatas), recursos disponibles, responsables por rol y sectores definitivos (K10 es simulado y está "a validar por la mesa"). Dependen de Defensa Civil y del comité.
- **Datos que el kit no trae:** lluvia observada (conectar la red de partes de la Policía/UPCA), cotas y barrios reales, caminos con su estado real, catastro parcelario de Formosa (sin descarga pública; hoy los productores de demostración se ubican en el paraje, sin parcela), población por radio censal (INDEC 2022) y las series K2, K4 y K5 pendientes del kit.
- **Verificación de supuestos:** capacidad de camiones jaula y de vehículos categoría B, raciones, dormidero, velocidades por superficie, umbrales de lluvia por tipo de camino y pesos del ISAD son supuestos del equipo (`apps/backend/app/config/supuestos.yaml`); necesitan validación de INTA, SENASA y Vialidad.
- **Integraciones reales:** WhatsApp (Meta Cloud API), gateway SMS, IVR del 103 y notificaciones push remotas (FCM), hoy simulados o locales.
- **Para operar en serio:** despliegue con HTTPS, MFA para usuarios institucionales, auditoría de dependencias, inscripción de la base ante la AAIP y prueba con usuarios de campo. Estimación del equipo: varias semanas de trabajo sostenido y la participación de la autoridad; no hay una cifra confirmada.

## Cómo está hecha
- **Backend:** Python 3.12 (probado con 3.13), FastAPI 0.115, Pydantic 2, SQLAlchemy 2 + GeoAlchemy2, Alembic, PostgreSQL 16 con PostGIS y pgRouting (imagen `pgrouting/pgrouting:16-3.4-3.6.1`), Argon2, PyJWT, `cryptography`, slowapi, openpyxl, pytest y ruff.
- **Web:** React 18, TypeScript, Vite 6, Chakra UI 2, Framer Motion, React Three Fiber y Drei (landing), MapLibre GL y Deck.gl (mapa), vitest.
- **App móvil:** Expo SDK 58, React Native 0.88, expo-router, expo-sqlite, expo-secure-store, expo-location, react-native-maps, jest-expo; APK con EAS Build (perfil `preview`).
- **Monorepo:** pnpm 10 con workspaces; Node 24.
- **Datos:** kit del evento (K1, K3, K10, planilla) sin modificar; capas oficiales de IGN, BAHRA/Georef, Mapa Educativo, REFES y OpenStreetMap, versionadas con su fuente, licencia y fecha (`data/geo/`).
- **Uso de IA:** se usó Claude Code (Anthropic) como asistente de desarrollo para escribir código, pruebas y documentación bajo la dirección del equipo. Las decisiones de alcance, stack y diseño (D1 a D8 y P1 a P12) las tomó el equipo y quedan registradas en `docs/decisiones.md`; el trabajo se hizo por fases con revisión humana antes de cada commit. El producto no usa IA en su lógica de decisión: el escenario, el recomendador, el ruteo y los verificadores son reglas y cálculos deterministas con supuestos explícitos. El informe K6, generado por IA, se trata como material a auditar: el verificador contrasta cada afirmación con K1, K3 y K9 y muestra el veredicto con su evidencia. Una IA asistió también en el diseño inicial (investigación y pilares), cuyos errores se corrigen en CLAUDE.md §16.

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
- **Tres frases cualitativas de la página El Niño** (rezago de semanas a meses, aviso con semanas de anticipación, anegamiento en horas) no tienen fuente oficial precisa; están declaradas en `docs/ficha_fuentes.md`.
- **Datos posteriores al corte (31/10/2026)** están apagados por defecto.

## Cómo se arranca (cinco líneas)
Requisitos: Node 24, pnpm 10, Python 3.12 o superior y Docker. Detalle y puertos en el `README.md`.
1. `cp .env.example .env` y completar `JWT_SECRET`, `FIELD_ENCRYPTION_KEY`, `CANAL_HMAC_SECRET` y las claves de demostración; luego `pnpm install`.
2. `docker compose up -d --build` (base de datos y backend; aplica migraciones y carga los datos de demostración).
3. `curl http://localhost:8000/api/v1/salud` debe responder `"estado":"ok"`.
4. `pnpm dev:web` y abrir http://localhost:5173; ingresar como `decisor@demo.evacuaciones.invalid` (contraseña `DEMO_PASSWORD` del `.env`).
5. App móvil: `pnpm dev:mobile` (Expo Go; el mapa y el APK requieren un development build, ver README).

## Repositorio

Tema elegido: Desafío 06 · Evacuaciones (simulador). URL del monorepo: https://github.com/gonzalolrodriguez/elnino · Commit o tag evaluable: tag `v1.0-entrega` (a crear sobre `main` después del merge de la Fase 6). Frontend: `apps/frontend`; backend: `apps/backend`; app móvil: `apps/mobile`; paquete compartido: `packages/shared`. Configuración: `.env.example`. Comandos de ejecución y de prueba: `README.md`. Fuentes: `docs/ficha_fuentes.md`; limpieza de K1: `docs/registro_limpieza.md`; contrato: `docs/contrato_api.md` y `docs/openapi.json`; arquitectura: `docs/arquitectura.md`; seguridad: `docs/seguridad.md`.
