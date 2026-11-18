# CLAUDE.md — Plataforma de Gestión de Evacuaciones · Equipo 3 IPF · AI LAB Misión: Código Formosa

> Contexto permanente del proyecto para Claude Code. Va en la **raíz del repositorio** y se lee automáticamente.
> Arranque sugerido:
> `claude "Leé CLAUDE.md completo. Antes de escribir código, mostrame la sección 1 (decisiones) y confirmá conmigo las que figuran como PENDIENTE. Después ejecutá la Fase 0 y esperá mi OK."`

Este documento integra cuatro fuentes:
1. El diseño amplio de Gemini (informe de investigación + seis pilares + diseño técnico).
2. El documento base del equipo (Idea 4 como eje: Tranquera Digital y Bot Policial; Ideas 1, 2 y 3 como módulos complementarios).
3. La propuesta del equipo de portal público con landing 3D y plataforma multi-rol (web + app React Native).
4. La consigna del Desafío 6 y el kit del evento (reglas de la mesa, datos K1–K10).

Cuando hay conflicto, el orden de prioridad es: **reglas de la mesa y kit → decisiones del equipo → diseño de Gemini**. Las correcciones al diseño de Gemini están en la sección 16.

---

## 0. Cómo tenés que trabajar (instrucciones para Claude Code)

1. **No tomes decisiones de alcance, stack o diseño por tu cuenta.** Si algo no está decidido en la sección 1 o es ambiguo, preguntá antes. Las decisiones marcadas como `PENDIENTE` se confirman con el usuario al inicio de la Fase 0.
2. **Trabajá por fases** (sección 13). Al cerrar cada fase: corré tests y linters, mostrá un resumen (qué se hizo, qué falta, cómo probarlo), proponé el mensaje de commit y **esperá confirmación** antes de commitear o pasar a la siguiente.
3. **Nunca muestres datos inventados como reales.** Todo lo que no venga del kit o de una URL oficial es `SIMULADO`, se rotula en pantalla y figura en `docs/ficha_fuentes.md`.
4. **No modifiques `data/kit/`.** Las transformaciones generan archivos nuevos en `data/processed/` y se documentan.
5. **Nada de personas reales** (nombres, DNI, teléfonos) en el repo ni en datos de demo. Los responsables operativos se identifican por rol.
6. Cada número que sea un **supuesto** (capacidades, velocidades, raciones, pesos del índice) va en `apps/backend/app/config/supuestos.yaml` con su fuente o la palabra `SUPUESTO`.
7. Código, textos de UI y documentación en **español**.
8. Si el kit y este documento difieren, **gana el kit**; avisá la diferencia.

---

## 1. Decisiones del proyecto

### 1.1 Decididas por el equipo
| # | Decisión |
|---|---|
| D1 | **Plataforma web** (portal público + paneles por rol) **y app multiplataforma en React Native** (no negociable: ambas). |
| D2 | **Portal único de entrada pública** con landing interactiva de alto impacto: hero 3D de la cuenca con el agua bajando desde Mato Grosso/Pantanal hasta Formosa, sección informativa sobre El Niño, y selectores de ingreso por perfil. |
| D3 | **Plataforma multi-rol**: ciudadanía/damnificados, productores agropecuarios, mandos operativos y decisores, con registro, login, roles y medidas de seguridad, tanto en web como en la app. |
| D4 | **Eje funcional del documento base del equipo**: Idea 4 (Tranquera Digital + Bot Policial) + Idea 1 (Ventana Seca y ruteo bimodal) + Idea 2 (Arca Productiva: calculadora ganadera y cuadrillas) + Idea 3 (Centinela: auditoría K1/K6/K7 y bitácora K8). |
| D5 | **Panel operativo** con monitor hidrométrico y pluviométrico, simulador y recomendador de evacuación por sector, y emisión de órdenes y alertas a damnificados/productores y tareas a cuadrillas. |
| D6 | Se deben cumplir todas las reglas de la mesa (sección 3). |
| D7 | **Lugares reales, personas simuladas:** localidades, parajes, caminos, escuelas, salud, comisarías y demás lugares salen de fuentes oficiales; solo se simulan personas, sus atributos y los valores sin fuente pública (sección 10). |
| D8 | **Sectores K10 tal como los armó la mesa** (geometría y atributos sin cambios, rotulados `SIMULADO`). |

### 1.2 Propuestas por defecto — CONFIRMADAS por el equipo el 17/11/2026
El equipo confirmó todas las propuestas por defecto. P12 se resolvió con la opción **(b)**: productores ficticios ubicados en el punto del paraje real (BAHRA), sin parcela. Si el equipo cambia algo, actualizá esta tabla.

| # | Tema | Propuesta por defecto | Alternativa |
|---|---|---|---|
| P1 | Estructura del monorepo | `apps/frontend` (web), `apps/mobile` (Expo), `apps/backend` (FastAPI), `packages/shared` (tipos y cliente API generados desde OpenAPI) | Sin `packages/shared` |
| P2 | Web | React 18 + TypeScript + Vite + **Chakra UI** + Framer Motion + **React Three Fiber + Drei** (landing) + **MapLibre GL JS + Deck.gl** (mapas operativos) — propuesta del equipo | Leaflet para el panel (recomendado por los organizadores; el stack es libre) |
| P3 | App móvil | **Expo (SDK estable actual) + TypeScript + expo-router**; mapas con `react-native-maps`; cola offline con `expo-sqlite`; ubicación `expo-location`; fotos `expo-image-picker` + compresión; tokens en `expo-secure-store`; APK con **EAS Build** (perfil `preview`, `buildType: apk`) | MapLibre React Native (requiere development build, no funciona en Expo Go) |
| P4 | Backend y base | **FastAPI + PostgreSQL 16 + PostGIS + pgRouting** como base principal, levantada con `docker-compose`; migraciones con Alembic; seeds de demo | Arranque dual con respaldo en memoria (archivos) si no hay Docker |
| P5 | Datos posteriores al corte (31/10/2026) | **Apagados por defecto** (`PERMITIR_DATOS_POST_CORTE=false`). La landing y el monitor muestran el dato del corte: Puerto Formosa 5,60 m, `DATO OBSERVADO`, 31/10/2026. Un panel "Lectura en vivo INA" queda preparado, rotulado `DOCUMENTO DE REFERENCIA` con fecha y hora, activable solo si la mesa lo autoriza | Mostrar en vivo desde el inicio |
| P6 | Canales (WhatsApp, SMS, IVR) | **Simulados con lógica real**: endpoints que reciben mensajes de prueba con el mismo formato y parser que el canal real; la integración real (Meta Cloud API, gateway SMS) queda documentada | Integración real con cuentas |
| P7 | Notificaciones de órdenes y alertas | Web: centro de notificaciones en la app + WebSocket; móvil: **notificaciones locales** disparadas por polling/WebSocket mientras la app está abierta; push remoto con `expo-notifications` + FCM como fase opcional (requiere development build y credenciales) | Push remoto desde el inicio |
| P8 | Lluvia | El kit **no tiene lluvia observada** (planilla vacía). Fuentes en la plataforma: (a) partes policiales y cargas manuales, rotuladas según origen; (b) importación de la planilla UPCA; (c) deslizador `SIMULADO` en el simulador | Pronóstico Open-Meteo como `REFERENCIA` (posterior al corte, ver P5) |
| P9 | Índice ISAD (susceptibilidad de anegamiento) | Se implementa como **índice relativo rotulado SIMULADO**, con pesos configurables; el disparador oficial del simulador es la altura de compromiso de K10 frente a Puerto Formosa | No implementar ISAD |
| P10 | Ruteo | **pgRouting** sobre red vial OSM/IGN recortada al corredor (vehicular y arreo), con aristas bloqueables por el operador; GraphHopper como fase opcional | GraphHopper desde el inicio |
| P12 | Chacras y campos reales | Ver sección 10.3 | — |
| P11 | Reparto del equipo | Propuesta: (1) backend + datos + seguridad, (2) panel operativo web, (3) landing 3D + registro web, (4) app móvil. Cada integrante elige | A definir por el equipo |

---

## 2. Contexto del desafío

- **Programa:** AI LAB Misión: Código Formosa · Operación Agua (CITF – Clúster de Innovación Tecnológica Formosa).
- **Equipo 3 · Instituto Politécnico Formosa:** Gonzalo Rodríguez, Franco Villalba, Dylan Cabrera, Javier Martínez.
- **Desafío asignado: 06 · Evacuaciones.** Consigna: desarrollar un simulador que permita explorar alternativas de planificación y visualizar cómo podrían organizarse los recursos y recorridos ante un escenario hipotético.
- **La herramienta podría:** seleccionar un sector comprometido; identificar accesos y recorridos disponibles; localizar centros de recepción o puntos de encuentro; registrar responsables y recursos; simular alternativas de organización y traslado; mostrar información para evaluar cada alternativa.
- **Aspectos obligatorios a considerar:** cartografía, ubicación y **capacidad de centros de recepción**, **accesibilidad de caminos** (el simulador debe permitir **marcar un camino como no transitable**), responsables y **fecha de actualización de cada capa**.
- **Cuidados:** centros de recepción con capacidad → datos de prueba `SIMULADO` (escuelas del Mapa Educativo solo como referencia; qué edificio es centro lo define la autoridad). **No publicar nombres ni teléfonos reales de responsables: usar roles.**
- **Límite de responsabilidad:** decidir evacuar, definir recorridos y disponer recursos corresponde a las autoridades. La plataforma recomienda y simula; la orden la emite una persona con rol autorizado y queda registrada.
- **Pregunta orientadora:** ¿Cómo organizar información territorial para planificar y simular una evacuación de manera más clara y ordenada?
- **Usuarios en el cierre:** tres técnicos de la mesa interinstitucional por El Niño actúan como "Comité de la Misión" (ficticio).

### Problema real que aborda el equipo (documento base)
- Evacuar **personas y producción**: familias y también ganado mayor (hasta 200 cabezas por lote), ganado menor, colmenas y cosechas. Si el productor no sabe que sus animales tendrán traslado, resguardo y comida, no se va.
- **Ventana seca:** evacuar antes de que la lluvia sature los caminos de tierra o el agua aísle a la gente.
- Logística de **recepción y permanencia** (centros, predios altos, banquinas acondicionadas; agua, alimentos, forraje, asistencia veterinaria).
- **Registro y trazabilidad** de a quién se asistió, con qué familia, qué stock y qué necesita.
- **Coordinación interinstitucional por rol** (Comando de Emergencia, Defensa Civil, Policía, SIPEC, Desarrollo Humano, Producción, PAIPPA, Prefectura, SENASA, INTA, Vialidad).

---

## 3. Reglas obligatorias de la mesa (se evalúan)

1. Leyenda fija en **toda pantalla (web y app), video y ficha:** `PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial`.
2. Categoría visible en cada cifra, serie, umbral o capa: `DATO OBSERVADO` (K1, K2, K3) · `DOCUMENTO DE REFERENCIA` (reportes INA, SMN/NOAA, IGN, OSM, Mapa Educativo) · `SIMULADO` (K10, K6, K7, K8, personas y registros de demo, capacidad de centros, recursos, lluvia simulada, todo lo posterior al corte). Los lugares reales (escuelas, salud, localidades, parajes, caminos) son `DOCUMENTO DE REFERENCIA` con fuente y fecha.
3. Si una cifra no está en `docs/ficha_fuentes.md`, no se muestra.
4. Corte de datos 31/10/2026; lo posterior solo con decisión de la mesa (ver P5).
5. Proyecciones con supuesto, horizonte y rango de incertidumbre.
6. Decisiones con responsable (rol) y evidencia → bitácora K8.
7. El kit **no tiene**: lluvia observada; pronóstico hidrológico más allá de 15 días; cotas, barrios, caminos o centros reales; alturas anteriores a 2006 (1983, 1992, 1998 sin fuente oficial verificada). La plataforma lo declara en un panel "Límites".

**Evaluación (100):** utilidad para decidir 30 · rigor 25 · honestidad frente a la incertidumbre y la IA 15 · continuidad 15 · equipo y comunicación 15. Capacidades revisadas: datos limpios y trazables, fuentes verificables, territorio correcto, límites explícitos, decisión humana registrada.

### Entregables
| Fecha | Qué |
|---|---|
| Mié 18/11 | Mentoría de software |
| Jue 19/11 | Mentoría sobre El Niño |
| Vie 20/11, 18:00 | `docs/ficha_tecnica.md` |
| Sáb 21/11, 10:00 | Póster, pitch 3 min, video MP4 ≤ 120 s, monorepo con commit/tag evaluable, `ficha_fuentes.md`, `registro_limpieza.md` |

Requisitos técnicos (07_Entrega_Tecnica_Software.pdf): frontend y backend en directorios identificables; README con requisitos, versiones, instalación, arranque, puertos y prueba del flujo principal; `.env.example`; inicialización del esquema y carga de datos de demo; **contrato frontend–backend documentado** con ejemplo reproducible; validación de entradas en backend; estados de carga/vacío/error en UI; **prueba del flujo principal y de una entrada inválida**; secretos en variables de entorno; sin datos personales; lockfiles; probado desde clonado limpio.

---

## 4. Datos del kit

Ubicación: `data/kit/`. Si faltan archivos, avisá.

| Código | Archivo | Categoría | Estado |
|---|---|---|---|
| K1 | `P1_DATA_INTEGRITY_dataset_participantes_v1.csv` + `LEEME_P1_PARTICIPANTES.txt` | Observado (con alteraciones pedagógicas) | Disponible |
| K2 | `K2_pilcomayo_alturas.csv` | Observado | **Falta**: API INA siteCode=55 sin alterar |
| K3 | `K3_estaciones_umbrales.json` | Observado | Disponible |
| K4 | `K4_reporte_INA_2026-10-31.pdf` | Referencia | Falta (opcional) |
| K5 | `K5_boletin_ENSO.pdf` | Referencia | Falta; hay un boletín El Niño del 22/10/2026 en la carpeta |
| K6 | `K6_informe_IA.pdf` | Simulado | Disponible |
| K7 | `K7_red_hidrografica.pdf` | Simulado | Disponible (insumo para que la landing 3D sea hidrográficamente correcta) |
| K8 | `K8_escenarios.pdf` | Simulado | Disponible |
| K9 | `K9_fuentes.md` | Referencia | Disponible |
| K10 | `K10_sectores_simulados.geojson` | Simulado | Disponible |
| — | `Planilla_Precipitaciones_Formosa.xlsx` | Plantilla vacía | Estructura para importar partes de lluvia (regla: celda vacía = sin medición; 0 = se midió cero) |
| — | `20261029 Formosa.pptx` (pronóstico estacional CFS v2) | Referencia | Para la sección El Niño |
| — | `situacion_hidrica_agroambiental_2026-11-17.pdf` | Referencia posterior al corte | Ver P5 |

URL API INA (K9): `https://alerta.ina.gob.ar/pub/datos/datos&timeStart=2006-01-01&timeEnd=2026-10-31&siteCode=57&varId=2&format=csv` (siteCode=55 para Puerto Pilcomayo).

### 4.1 K3 — contenido exacto
```json
{
  "fecha_corte": "2026-10-31",
  "fuente": "INA – Sistema de Información y Alerta Hidrológico, catálogo de estaciones (red de escalas de Prefectura Naval Argentina). Consultado el 29/10/2026",
  "url": "https://alerta.ina.gob.ar/pub/datos/estaciones&format=json",
  "unidad": "m",
  "categoria": "Dato observado",
  "estaciones": {
    "formosa":   { "siteCode": 57, "nombre": "FORMOSA (Puerto Formosa)", "rio": "Paraguay", "lon": -58.183, "lat": -26.183, "aguas_bajas": 1.6, "alerta": 7.8,  "evacuacion": 8.3 },
    "pilcomayo": { "siteCode": 55, "nombre": "PUERTO PILCOMAYO", "abreviatura": "PILC", "rio": "Paraguay", "lon": -57.65, "lat": -25.367, "aguas_bajas": 1.4, "alerta": 5.35, "evacuacion": 6.0 }
  }
}
```

### 4.2 K10 — sectores simulados (leer siempre el archivo)
EPSG:4326 · v1.0 · 2026-11-12 · referidos a Puerto Formosa (siteCode 57). Propiedades: `id, nombre, SIMULADO, altura_escala_compromiso_m, poblacion_simulada, acceso_simulado, estacion_referencia`.

| id | nombre | compromiso | población | acceso | bbox (lon_min, lat_min, lon_max, lat_max) |
|---|---|---|---|---|---|
| S1 | Sector Norte | 8,10 m | 1.200 | Un solo acceso, ripio | -58.195, -26.162, -58.180, -26.150 |
| S2 | Sector Centro | 8,60 m | 3.500 | Dos accesos pavimentados | -58.188, -26.192, -58.172, -26.178 |
| S3 | Sector Sur | 7,90 m | 800 | Un pavimentado y uno de ripio | -58.205, -26.222, -58.188, -26.208 |
| S4 | Sector Rural Este | 7,50 m | 150 + producción ganadera | Tierra, intransitable con lluvia | -58.150, -26.192, -58.128, -26.168 |

S4 se compromete **30 cm antes de la alerta** (7,80 m). Al corte (5,60 m) está a 1,90 m. Total simulado: 5.650 personas.

### 4.3 K8 — escenarios y bitácora (simulado)
- **A · Preparación:** comunicación preventiva, verificación de rutas y centros, monitoreo diario. Sin evacuación.
- **B · Evacuación preventiva** de sectores por debajo de una altura definida por el comité, con alojamiento temporal.
- **C · Espera** hasta que Puerto Formosa supere 7,80 m.
- Preguntas del comité: ¿qué dato convierte A en B?, costo de falsa alarma vs. demora, ¿los datos sostienen B hoy?, ¿qué sectores primero y por qué acceso?, ¿cuánto tiempo queda si el río acelera?, ¿velocidades de ascenso de 2015-16 y 2019?
- **Bitácora — campos obligatorios:** Decisión · Evidencia (dato con fuente abrible) · Límites · Riesgos (de la decisión y de la contraria) · Gatillos de cambio (valor y fuente) · Responsable (rol) y fecha (día simulado).

### 4.4 K6 — afirmaciones a auditar (veredicto preliminar; confirmar con los datos)
| Afirmación | Veredicto | Evidencia |
|---|---|---|
| SMN confirmó El Niño el 4/9/2026, 100 % sep–nov | Respaldada | K9 |
| NOAA: 83 % fuerte o muy fuerte (oct–dic) | Respaldada | K9 |
| En 2016 Puerto Formosa llegó a ~10,7 m | Refutada | K1: máximo 9,81 m (05–06/01/2016) |
| En octubre 2026 superó la alerta / la evacuación | Refutada | K1: máximo de octubre 5,60 m |
| Sube ~11 cm/día desde comienzos de octubre | Respaldada como promedio | (5,60 − 2,37) / 30 ≈ 0,108 m/día |
| Superará 9,81 m en enero de 2027 | No verificable | Extrapolación lineal; INA no pronostica > 15 días |
| Lluvias de octubre 40 % sobre lo normal | No verificable | El kit no tiene lluvia observada |
| La escala de Puerto Formosa es de la red del SMN | Refutada | K3: red de escalas de Prefectura, publicada por el INA |

### 4.5 K1 — limpieza
CSV de 8.347 filas, columnas `obs_id,timestart,timeend,valor,unidad_registro,timeupdate`, **UTF-8 con BOM** (`encoding="utf-8-sig"`). Reglas del LEEME: metros; un solo criterio decimal; fechas `YYYY-MM-DD HH:MM:SS`; **no tratar como duplicados dos mediciones del mismo día a distinta hora**; revisar unicidad de `obs_id`; examinar continuidad de 2018; **no inventar ni interpolar** (sin evidencia → `pendiente_verificacion`).

Hallazgos de la auditoría preliminar (a reproducir y testear):

| Problema | Cantidad | Detalle | Tratamiento |
|---|---|---|---|
| Filas idénticas (mismo obs_id) | 12 | — | Eliminar → 8.335 |
| Fechas en otro formato | 40 | 20 `dd/mm/aaaa`, 20 `aaaa/mm/dd` | Normalizar |
| Coma decimal | 3 | 2014-02-14, 2014-06-18, 2014-10-22 | A punto |
| Unidad cm | 7 | 2011-03-10 a 16, 584–596 | ÷100 |
| Valor imposible | 1 | 2012-07-15: 98,1 entre 5,83 y 5,83 | Cuarentena, no reemplazar |
| Negativos | 141 | mínimo −0,86 m (2024-11-07) | Conservar |
| Días con varias mediciones | 432 | — | Conservar |
| Huecos 2018 | 25 días | 2018-01-06 a 2018-12-26 | No interpolar |

Control: máximo **9,81 m (05–06/01/2016)**; pico 2019 **9,72 m** (2019-06-02 00:00 en la serie; el documento base dice 3/06: nota de huso horario); 2026-10-01 = 2,37 m; 2026-10-31 = 5,60 m; 8.335 finales (8.334 válidos + 1 en cuarentena).

Velocidades de ascenso preliminares (máximo diario; recalcular):

| Período | Mayor suba 1 día | Mayor suba 7 días | Cruce 7,50 | Cruce 7,80 | Cruce 8,30 |
|---|---|---|---|---|---|
| 2015–16 | 0,29 m (2015-12-05) | 1,25 m (2015-12-10) | 2015-06-18 | 2015-08-01 | 2015-12-18 |
| 2019 | 0,36 m (2019-03-20) | 1,37 m (2019-03-25) | 2019-04-14 | 2019-04-17 | 2019-04-27 |
| Oct. 2026 | 0,28 m (2026-10-12) | 1,53 m (2026-10-17) | — | — | — |

Salidas: `data/processed/k1_limpio.csv`, `data/processed/k1_diario.csv` (días sin dato vacíos) y `docs/registro_limpieza.md` con la plantilla oficial.

---

## 5. Arquitectura

### 5.1 Vista general
```
                 ┌───────────────────────── Portal web (apps/frontend) ─────────────────────────┐
 Ciudadanía ───▶ │ Landing 3D + sección El Niño + selector de perfil → registro / login        │
 Productores ──▶ │ Área ciudadana/productor (perfil, grupo familiar, establecimiento, pedidos)  │
 Mandos ───────▶ │ Panel operativo (monitor, simulador, recomendador, órdenes, cuadrillas,      │
                 │ bitácora, auditoría de datos)                                               │
                 └──────────────────────────────────┬────────────────────────────────────────────┘
 App móvil (apps/mobile, Expo) ── offline-first ────┤ REST + WebSocket (JWT)
 Canales simulados (WhatsApp/SMS/IVR) ──────────────┤
                                                    ▼
                         Backend FastAPI (apps/backend): auth, RBAC, dominio, ingesta, simulación,
                         ruteo, notificaciones, bitácora de accesos
                                                    │
                         PostgreSQL + PostGIS + pgRouting (docker-compose) · data/kit · data/processed
```

### 5.2 Estructura del monorepo (P1)
```
operacion-agua-equipo3/
├── CLAUDE.md · README.md · .gitignore · .env.example · docker-compose.yml
├── data/
│   ├── kit/            # originales, no se tocan
│   ├── processed/      # K1 limpio y derivados
│   ├── simulado/       # datos ficticios rotulados
│   └── geo/            # capas de referencia recortadas (cursos de agua IGN, red vial OSM)
├── apps/
│   ├── backend/        # FastAPI
│   ├── frontend/       # Web: landing, áreas por perfil, panel operativo
│   └── mobile/         # Expo React Native
├── packages/
│   └── shared/         # tipos TS y cliente API generados desde OpenAPI; constantes (leyenda, categorías, roles)
└── docs/               # contrato_api.md, ficha_tecnica.md, ficha_fuentes.md, registro_limpieza.md,
                        # arquitectura.md, seguridad.md, decisiones.md
```

### 5.3 Backend (`apps/backend`)
Python 3.12 · FastAPI · Pydantic v2 · SQLAlchemy 2 + GeoAlchemy2 · Alembic · psycopg · pandas · shapely · pyyaml · passlib[argon2] o argon2-cffi · python-jose o PyJWT · cryptography · slowapi (rate limit) · pytest · ruff.

```
app/
├── main.py · config/{settings.py, supuestos.yaml}
├── core/        # seguridad: jwt, hashing, rbac, cifrado de campos, rate limit, auditoría, cors
├── db/          # sesión, modelos ORM, migraciones, seeds
├── domain/      # lógica pura sin I/O:
│   ├── escenario.py       # estado de sectores y accesos (río + lluvia + caminos cerrados)
│   ├── isad.py            # índice relativo SIMULADO (P9)
│   ├── asignacion.py      # personas → centros por capacidad
│   ├── alternativas.py    # comparador de alternativas
│   ├── ruteo.py           # pgRouting vehicular y arreo
│   ├── ganaderia.py       # Arca Productiva: camiones, dormidero, lotes, raciones, checklist
│   ├── cuadrillas.py      # armado de cuadrillas por tipo de incidente
│   ├── ascenso.py         # velocidades de ascenso y tiempo restante
│   ├── verificador.py     # K6/K7 contra K1/K3
│   └── parser_mensajes.py # SOS-FSA, LLUVIA <puesto> <mm>, WhatsApp de prueba
├── ingest/      # limpieza K1, carga K3/K10, importación planilla UPCA, (opcional) lectura INA
└── api/v1/      # auth, usuarios, ciudadania, productores, incidentes, datos, simulacion,
                 # ordenes, cuadrillas, bitacora, verificador, canales, meta
```

### 5.4 Web (`apps/frontend`) — P2
- **Rutas públicas:** `/` landing · `/el-nino` sección informativa · `/registro/ciudadania` · `/registro/productor` · `/login` · `/app` (descarga APK y enlace a la app).
- **Rutas privadas por rol:** `/mi-cuenta` (ciudadano/productor) · `/comando/*` (operador/decisor) · `/admin` (usuarios institucionales).
- **Landing (D2):**
  - Hero 3D con React Three Fiber + Drei + Framer Motion: cuenca simplificada (Pantanal → río Paraguay → Asunción → Puerto Pilcomayo → Puerto Formosa → confluencia con el Paraná), partículas de agua animadas, cámara que termina en Formosa. Geometría de ríos desde **cursos de agua del IGN** (o Natural Earth como respaldo), proyectada y simplificada; **relaciones hidrográficas verificadas contra K7** (p. ej. el Pilcomayo no desemboca en el Bermejo; orden de estaciones correcto). Rótulo: "Esquema ilustrativo".
  - Datos visibles con categoría: Puerto Formosa 5,60 m (31/10/2026, OBSERVADO), umbrales 7,80/8,30 (K3), picos 9,81 m (2016) y 9,72 m (2019) (K1). Lluvia: "sin dato observado en el kit" o el último parte cargado con su origen.
  - Selectores de ingreso por perfil (ciudadanía, productores, mandos) con CTA a registro, app o login.
  - Fallback 2D si WebGL no está disponible o si el usuario prefiere menos movimiento (`prefers-reduced-motion`).
- **Sección El Niño:** qué es ENSO; cómo llega a Formosa (cuenca alta y media, Pantanal como amortiguador, remanso del Paraná, rezago de semanas a meses); amenaza exógena (ríos) vs. endógena (lluvia sobre suelos arcillosos de muy baja pendiente); umbrales y picos; pronóstico estacional CFS v2 como REFERENCIA; qué hacer (anticipación, evacuación en seco); fuentes con fecha. Visualizaciones interactivas (línea de tiempo de la serie K1 con umbrales, mapa de sectores).
- **Panel operativo:** MapLibre + Deck.gl (o Leaflet según P2), componentes Chakra.

### 5.5 App móvil (`apps/mobile`) — P3
- Pantallas: bienvenida con leyenda · registro/login · perfil (grupo familiar o establecimiento) · **botón de solicitud de asistencia** (ubicación GPS, tipo, personas, animales, foto, texto) · mis solicitudes y su estado · alertas y órdenes recibidas · mapa del sector y centro asignado · modo cuadrilla (tareas asignadas, checklist, cambio de estado) para usuarios con rol operativo.
- Offline-first: cola local en `expo-sqlite`; envío en dos tiempos (JSON mínimo primero, foto después); reintentos; indicador de pendientes. Si no hay datos, ofrecer abrir la app de SMS con el texto codificado (`SOS-FSA|lat,lon|PERFIL|FAM:n|BOV:n(...)|ACC:...|texto`); el envío automático de SMS no se hace.
- Seguridad: tokens en `expo-secure-store`, nada sensible en AsyncStorage, cierre de sesión remoto.

---

## 6. Perfiles, roles y seguridad (D3)

### 6.1 Roles
| Rol | Alta | Puede |
|---|---|---|
| `ciudadano` | Autorregistro (web/app) | Gestionar su grupo familiar y domicilio, pedir asistencia, ver alertas de su sector y su centro asignado |
| `productor` | Autorregistro | Lo anterior + establecimiento(s) (RENSPA/RENAPA opcional, ubicación de tranquera y loma alta), stock por especie y categoría, solicitud anticipada de logística |
| `cuadrilla` | Alta por admin | Ver y actualizar sus tareas, checklists de campo, registrar asistencia |
| `operador` | Alta por admin | Panel operativo: monitor, simulador, marcar caminos, cargar partes, armar alternativas y cuadrillas, proponer órdenes |
| `decisor` | Alta por admin | Lo del operador + **emitir órdenes de evacuación** y registrar decisiones en la bitácora |
| `admin` | Seed inicial | Gestión de usuarios institucionales y catálogos |

Los mandos operativos **no se autorregistran** (login institucional, alta por admin). Cada usuario institucional tiene además un `rol_operativo` del catálogo (coordinador de sector, Defensa Civil, SIPEC, veterinario, etc.) para firmar tareas y decisiones.

### 6.2 Medidas
- Contraseñas con **Argon2id**; política mínima de longitud; bloqueo temporal por intentos fallidos; rate limiting en login y registro.
- **JWT** de acceso corto (15 min) + refresh rotativo con revocación; en web, refresh en cookie `HttpOnly`, `Secure`, `SameSite=Strict`; en móvil, `expo-secure-store`.
- **RBAC** por endpoint (dependencias de FastAPI) y por recurso (un ciudadano solo ve lo suyo).
- **Cifrado de campos sensibles** (salud, vulnerabilidad, teléfono) con AES-GCM (`cryptography`), clave por variable de entorno.
- **Consentimiento informado** en el registro (Ley 25.326: finalidad exclusiva de emergencia, derechos de acceso, rectificación y supresión).
- **Bitácora de accesos** a datos personales, con hash encadenado.
- Validación estricta con Pydantic; consultas parametrizadas; CORS restringido; cabeceras de seguridad; tamaño máximo de archivos e imágenes; tipos MIME permitidos.
- Webhooks de canales simulados con firma HMAC (mismo esquema que Meta `X-Hub-Signature-256`).
- Secretos solo en `.env` (nunca en el repo). Documentar todo en `docs/seguridad.md` con el mapeo a OWASP Top 10.
- **Datos de demo:** usuarios y registros ficticios (seeds), sin personas reales.

---

## 7. Modelo de datos (PostGIS, EPSG:4326)

Tablas principales (ajustar con Alembic):
- `usuarios` (id, email, hash, rol, rol_operativo, estado, creado_en, último_login) · `sesiones_refresh`
- `grupos_familiares` (usuario_id, integrantes, menores, mayores, personas con discapacidad o salud — cifrado —, mascotas, domicilio geom Point, sector_id calculado)
- `establecimientos` (productor_id, nombre, renspa, renapa, paippa, geom_tranquera Point, geom_loma_alta Polygon, superficie_albardon_m2, acceso_habitual)
- `stock_productivo` (establecimiento_id, especie, categoria, cantidad, actualizado_en)
- `estaciones` (K3) · `lecturas_hidrometricas` (K1 limpio, K2; con `categoria`, `calidad`, `fuente`)
- `puestos_pluviometricos` (código, nombre, zona, geom) · `lecturas_lluvia` (puesto, fecha, turno 07/17, mm o NULL, origen: parte_policial|carga_manual|planilla_upca|simulado)
- `sectores` (K10 + estado calculado) · `accesos` (geom LineString, superficie, transitable, motivo, actualizado_en, actualizado_por_rol)
- `red_vial` (aristas para pgRouting, costo, bloqueada) · `centros_recepcion` (capacidad personas/animales, servicios, ocupación, categoria SIMULADO)
- `solicitudes_asistencia` (origen: app|web|whatsapp_sim|sms_sim|ivr_sim; tipo; personas; animales; geom; estado: recibida→verificada→asignada→en_curso→resuelta; adjuntos)
- `cuadrillas` · `integrantes_cuadrilla` (rol operativo) · `tareas` (cuadrilla, solicitud, estado, checklist JSON)
- `ordenes` (tipo: alerta|evacuacion_preventiva|evacuacion; sectores; emitida_por; fundamento; creada_en) · `notificaciones` (usuario, orden, leída)
- `alternativas` (escenario snapshot, parámetros, métricas) · `bitacora_decisiones` (6 campos K8 + snapshot)
- `auditoria_accesos` (usuario, acción, recurso, ip, hash, hash_anterior, fecha)

---

## 8. Lógica de dominio

### 8.1 Escenario (Idea 1 · Ventana Seca)
Entrada: `altura_formosa_m` (0–12), `lluvia_mm` (≥ 0; origen indicado), `caminos_cerrados[]`.
- Sector: `comprometido` si altura ≥ compromiso (K10); `en_riesgo` si altura ≥ compromiso − `margen_riesgo_m` (supuesto 0,50); `normal` en otro caso.
- Río vs. K3: normal / alerta (≥ 7,80) / evacuación (≥ 8,30) y distancia a cada umbral.
- Acceso: `cerrado_operador` · `intransitable_lluvia` (tierra ≥ 30 mm, ripio ≥ 80 mm; supuestos) · `anegado` (sector comprometido y acceso de tierra) · `transitable`.
- Sector **aislado** = sin accesos transitables.
- ISAD (P9): índice relativo 0–1 con lluvia antecedente, humedad, concavidad y río, pesos en `supuestos.yaml`, **rotulado SIMULADO**; nunca reemplaza al criterio de K10.

Ejemplo esperado (`POST /api/v1/simulacion/escenario` con `{ "altura_formosa_m": 7.6, "lluvia_mm": 40, "caminos_cerrados": [] }`): S4 comprometido y su acceso de tierra intransitable → **S4 aislado**; S3 y S1 en riesgo; S2 normal; río normal a 0,20 m de la alerta.

### 8.2 Recomendador (D5)
Para cada sector comprometido o en riesgo, calcula:
- **Población:** simulada de K10 + familias registradas cuyo domicilio cae en el polígono (`ST_Intersects`), con vulnerables.
- **Producción:** establecimientos y stock declarados en el polígono.
- **Ventana:** días estimados hasta el compromiso (8.6) y estado de accesos; para ganado, recomendar inicio 24–48 h antes.
- **Recursos:** viajes por tipo de vehículo, camiones jaula, cupos en centros (asignación greedy por prioridad y capacidad, reportando quiénes quedan sin lugar), cuadrilla sugerida.
- Todo con supuestos explícitos; la salida es una **recomendación**, no una orden.

### 8.3 Ruteo bimodal (P10)
- Vehicular: `pgr_dijkstra`/`pgr_aStar` sobre `red_vial` excluyendo aristas bloqueadas o que intersecten sectores comprometidos; perfiles por tipo de vehículo (camión jaula solo pavimento/ripio).
- Arreo a pie: costo penalizado en zonas bajas/comprometidas hasta un cargadero firme.
- Si no hay red cargada: distancia de acceso + línea recta × factor de desvío (supuesto 1,3), avisando la limitación.

### 8.4 Alternativas
Dos generadas (prioridad por riesgo / por población) + una editable. Métricas: personas evacuadas y sin lugar; viajes por vehículo; tiempo estimado (velocidades por superficie: supuestos); accesos vulnerables usados; roles y recursos faltantes frente a `recursos_simulados`. Comparación lado a lado.

### 8.5 Arca Productiva (Idea 2)
Por establecimiento: dormidero (bovinos × 5 m², INTA); ¿alcanza el albardón?; divisiones internas si hay más de una categoría bovina; camiones jaula = ceil(bovinos / 30) **SUPUESTO** (pendiente tabla Anexo II Res. SENASA 581/2014); vehículos cat. B piso rígido sin malla para caprinos/porcinos/ovinos (capacidad SUPUESTO 40); lotes en destino (vientres+toros / vaquillonas / vacas con cría+terneros; máx. 200); ración diaria (maíz 2,8 / 3,1 / 2,5 kg; pellet de girasol 0,2 / 0,35 / 0,2 kg; INTA, a verificar); apicultura (vivas/muertas × vehicular/a pie); checklist en destino (mío-mío, agua, forraje, acostumbramiento al grano, control sanitario a 7 días). Control: rodeo 8 preñadas + 10 con cría + 10 terneros + 1 vaquillona + 1 toro → 150 m², 1 camión con divisiones, maíz 58,4 kg/día, pellet 5,5 kg/día.

### 8.6 Cuadrillas
Plantillas por tipo de incidente (humana y servicios / ganadera / apícola) con roles: encargado, salud (SIPEC), trabajo social, veterinario o zootecnista, policía, transporte, Prefectura, técnico de energía. El sistema sugiere; el operador confirma y asigna.

### 8.7 Órdenes y alertas
El `decisor` emite una orden (tipo, sectores, fundamento) → se crean notificaciones para usuarios del sector (web y app, P7) y tareas para cuadrillas; la orden genera automáticamente un borrador de entrada en la bitácora K8 que el decisor completa.

### 8.8 Ingesta pluviométrica (Idea 4 · Bot Policial)
- Mensaje `LLUVIA <CODIGO_PUESTO> <MM>` por endpoint de canal simulado o formulario; turnos 07:00 y 17:00.
- Importación de `Planilla_Precipitaciones_Formosa.xlsx` respetando **vacío ≠ 0**.
- Exportación a Excel con el formato de la planilla (por departamento y año hidrológico sep–ago).
- Validación: rango, puesto existente, duplicado de turno; comparación con puestos vecinos como advertencia.
- Origen siempre visible; los puestos y lecturas de demo son `SIMULADO`.

### 8.9 Centinela (Idea 3)
Panel de auditoría de K1 (registro de limpieza en vivo), verificador K6 (sección 4.4, evidencia calculada desde K1/K3), auditoría de las 7 relaciones de K7, tiempo restante (velocidades de 2015-16, 2019 y oct-2026, con rango y supuesto lineal) y bitácora K8 exportable a Markdown/PDF.

### 8.10 Canales simulados (P6)
`POST /api/v1/canales/whatsapp-sim`, `/sms-sim`, `/ivr-sim`: reciben el payload con la misma forma que el proveedor real (firmado con HMAC), lo pasan por `parser_mensajes.py` y crean una `solicitud_asistencia` o una `lectura_lluvia`. Documentar cómo se conectaría la Meta Cloud API real.

---

## 9. Contrato API (prefijo `/api/v1`; documentar en `docs/contrato_api.md` y OpenAPI)

Errores: `{ "error": { "codigo", "mensaje", "detalle" } }` (400/401/403/404/409/422/429). Respuestas con datos incluyen `categoria`, `fuente`, `fecha_dato` cuando aplica.

| Grupo | Endpoints |
|---|---|
| Meta | `GET /salud` · `GET /meta` (leyenda, categorías, límites, fecha de corte, flags) |
| Auth | `POST /auth/registro/ciudadano` · `POST /auth/registro/productor` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/yo` |
| Usuarios (admin) | `GET/POST/PATCH /usuarios` |
| Ciudadanía | `GET/PUT /mi/grupo-familiar` · `GET /mi/sector` · `GET /mi/notificaciones` |
| Productores | `GET/POST/PUT /mi/establecimientos` · `PUT /mi/establecimientos/{id}/stock` · `POST /mi/solicitudes-logistica` |
| Solicitudes | `POST /solicitudes` · `GET /solicitudes` (operador) · `PATCH /solicitudes/{id}` |
| Datos | `GET /estaciones` · `GET /sectores` · `GET /accesos` · `PATCH /accesos/{id}` · `GET /centros` · `GET /serie/formosa` · `GET /serie/ascenso` · `GET/POST /lluvia` · `POST /lluvia/importar-planilla` · `GET /lluvia/exportar` |
| Simulación | `POST /simulacion/escenario` · `POST /simulacion/recomendacion` · `POST /simulacion/alternativas` · `POST /ruteo` |
| Producción | `POST /ganaderia/calculo` |
| Operación | `GET/POST /cuadrillas` · `GET/PATCH /tareas` · `POST /ordenes` (decisor) · `GET /ordenes` |
| Centinela | `GET /verificador/k6` · `GET /verificador/k7` · `GET/POST /bitacora` · `GET /bitacora/{id}/export` |
| Canales | `POST /canales/whatsapp-sim` · `POST /canales/sms-sim` · `POST /canales/ivr-sim` |
| Tiempo real | `WS /ws` (eventos: escenario, solicitud, orden, tarea) |

Casos inválidos a testear: altura fuera de 0–12 → 422; lluvia negativa → 422; acceso inexistente → 404; bitácora con campo vacío → 422; ciudadano intentando emitir orden → 403; login con contraseña errónea repetida → 429; mensaje `LLUVIA` mal formado → 422.

---

## 10. Datos de territorio (reales) y datos de personas (simulados)

**Decisión del equipo (D7):** todo lo que sea **lugar** (localidades, parajes, regiones, departamentos, rutas y caminos, escuelas, establecimientos de salud, comisarías y destacamentos, edificios públicos, puertos, estaciones) debe ser **real**, tomado de fuentes oficiales y rotulado `DOCUMENTO DE REFERENCIA` con fuente y fecha. Lo que se simula son **personas y sus atributos** (nombres, edades, composición familiar, stock declarado) y los valores que no tienen fuente pública (capacidad de centros, recursos disponibles), rotulados `SIMULADO`.

### 10.1 Fuentes reales a integrar (`data/geo/`, cada capa con fuente, licencia y fecha de descarga en `ficha_fuentes.md`)
| Capa | Fuente oficial | Acceso | Uso |
|---|---|---|---|
| Provincia, departamentos, municipios | IGN / API Georef (datos.gob.ar) | Descarga GeoJSON / API | Límites, filtros, conteos por departamento |
| Localidades y **parajes** | BAHRA vía IGN / API Georef (recurso `/asentamientos`) | API / GeoJSON | Ubicación real de localidades, parajes y sitios edificados (incluye parajes rurales del este) |
| Red vial nacional y provincial | IGN Capas SIG (WFS) + Dirección Provincial de Vialidad (Mapa de Rutas y Caminos 2024) + OpenStreetMap (ODbL) para caminos vecinales | WFS / descarga | Accesos reales y grafo de pgRouting |
| Cursos de agua | IGN Capas SIG / Banco Mundial (origen IGN, CC BY 4.0) — K9 | Descarga | Mapa operativo y landing 3D |
| Establecimientos educativos | Mapa Educativo Nacional (WFS, padrón oficial, CC BY 4.0) y Padrón Oficial de Establecimientos Educativos (actualización 16/06/2026) | WFS / CSV | Candidatos a centro de recepción (la autoridad define cuáles); capacidad `SIMULADO` |
| Establecimientos de salud | REFES – Registro Federal de Establecimientos de Salud (Ministerio de Salud, datos.gob.ar) | CSV/XLSX | Postas y hospitales cercanos a sectores y centros |
| Puestos pluviométricos / destacamentos policiales | Nombres de los +110 puestos del parte de la Dirección de Comunicaciones de la Policía (UPCA), ubicados con las coordenadas de su localidad o paraje en BAHRA; comisarías de OSM como complemento | Parte publicado + BAHRA | Red de partes de lluvia (las lecturas de demo sí son `SIMULADO`) |
| Población | INDEC Censo 2022 por radio censal | Descarga | Estimar personas por zona real |
| Estaciones hidrométricas | K3 (INA/Prefectura) y, si se habilita, SNIH/CTN/COREBE | Kit / API | Monitor |
| Base cartográfica | Argenmap (IGN); OSM como respaldo | TMS/WMTS | Fondo de mapa |
| Catastro parcelario de Formosa | Dirección General del Catastro Territorial (Ley 1315: autoridad cartográfica provincial) e IDEF | **No se encontró descarga pública**; IDEF sin disponibilidad confirmada | PENDIENTE (P12) |

Script de descarga reproducible `apps/backend/scripts/descargar_capas.py`: baja cada capa, la recorta a Formosa (o al corredor RN 11 – río Paraguay para la red vial), guarda el archivo original y el recortado con fecha, y registra URL y licencia. Los archivos resultantes se versionan en el repo para que la demo funcione sin internet.

### 10.2 Datos simulados (`data/simulado/` + seeds), solo personas y valores sin fuente
- Usuarios de demo (admin, decisor, operador, cuadrilla, ciudadanos, productores) con nombres y edades ficticios; contraseñas de demo solo en `.env.example`/README.
- Grupos familiares y productores **ubicados en localidades o parajes reales** (BAHRA) del área de trabajo, con stock coherente (si hay terneros al pie, hay vacas con cría).
- Capacidad de cada centro de recepción (escuela real) → `SIMULADO`.
- Recursos disponibles (colectivos, 4x4, camiones jaula, lanchas) → `SIMULADO`.
- Lecturas de lluvia de demo en puestos reales → `SIMULADO`.
- Roles operativos (catálogo, sin nombres de funcionarios reales).

### 10.3 Pendientes de decisión (consultar al equipo antes de implementar)
- **P12 · Chacras y campos reales.** No hay padrón parcelario abierto de Formosa ni RENSPA nominal público. Opciones: (a) gestionar datos con Catastro/IDEF o a través del CITF; (b) ubicar productores ficticios en el punto del paraje real, sin parcela; (c) usar parcelas reales solo si una fuente oficial las publica, sin asociarlas a titulares. Cuidado: asignar un productor ficticio a una parcela real identificable puede atribuirle datos falsos a un propietario real.
- **Sectores de evaluación (decidido, D8):** se usan los sectores de K10 **tal como los armó la mesa**: misma geometría, mismos atributos (`altura_escala_compromiso_m`, `poblacion_simulada`, `acceso_simulado`), siempre rotulados `SIMULADO`. No se modifican ni se reemplazan por barrios reales.

---

## 11. Documentación (`docs/`)
- `ficha_tecnica.md` (plantilla oficial; entrega 20/11 18 h): nombre; equipo y roles; reto (Simulador); usuario y pregunta; qué funciona hoy; **qué falta para que la mesa la use**; cómo está hecha (tecnologías e IA usadas); lo que no puede decir; cómo se arranca (5 líneas); repositorio.
- `ficha_fuentes.md`: cada cifra visible (valor, fuente, categoría, fecha), incluidos los supuestos.
- `registro_limpieza.md`: plantilla oficial con la auditoría de K1.
- `contrato_api.md`, `arquitectura.md`, `seguridad.md`, `decisiones.md`.

## 12. Calidad
- Backend: ruff + pytest (limpieza K1 con los números de 4.5; escenario del ejemplo; RBAC; validaciones 4xx; calculadora ganadera; verificador K6; parser de mensajes).
- Web y mobile: TypeScript estricto, ESLint, `tsc --noEmit`, vitest/jest con un test del flujo principal.
- CI opcional en GitHub Actions (lint + tests).
- README: levantar todo (docker-compose + web + Expo), usuarios de demo, prueba manual del flujo principal y del caso inválido, cómo generar la APK con EAS.

---

## 13. Fases (con criterio de aceptación)

**Fase 0 · Decisiones y esqueleto**
Confirmar con el usuario las decisiones `PENDIENTE` (1.2). Monorepo, `.gitignore`, `.env.example`, docker-compose (PostGIS), backend `/salud`, web y app Expo que muestran la leyenda y consultan `/salud`. README inicial.
✅ Todo levanta según el README; web y app muestran "backend OK".

**Fase 1 · Datos y seguridad base**
Limpieza K1, carga K3/K10, datos simulados y seeds, modelo de datos con migraciones, auth (registro, login, refresh, roles), auditoría de accesos.
✅ Tests de limpieza y de auth/RBAC en verde.

**Fase 2 · Motor**
Escenario, ISAD (SIMULADO), recomendador, asignación, alternativas, ruteo, Arca Productiva, cuadrillas, ingesta pluviométrica y parser, órdenes y notificaciones.
✅ Ejemplo de 8.1 correcto; casos inválidos de la sección 9 en verde.

**Fase 3 · Panel operativo web**
Monitor (serie K1 + umbrales + lluvia por origen), mapa con sectores/accesos/centros/estaciones, deslizadores, marcar caminos, recomendador, comparador, cuadrillas, emisión de órdenes, bitácora, Centinela.
✅ Guion de demo (sección 14) pasos 2 a 6.

**Fase 4 · Portal público**
Landing 3D con fallback 2D, sección El Niño, selector de perfiles, registro de ciudadanía y productores, área "mi cuenta".
✅ Registro de un productor con establecimiento en S4 que luego aparece en el recomendador.

**Fase 5 · App móvil**
Registro/login, perfil, solicitud de asistencia offline-first, alertas, mapa de sector y centro, modo cuadrilla. Build APK con EAS.
✅ Solicitud creada sin conexión se sincroniza y aparece en el panel; una orden emitida llega como notificación.

**Fase 6 · Entrega**
Fichas, contrato API, seguridad, prueba desde clonado limpio, tag `v1.0-entrega`, video.
✅ Lista de entrega de la sección 3 completa.

El orden de las fases 3, 4 y 5 puede paralelizarse según el reparto del equipo (P11).

## 14. Guion de demo (3 minutos)
1. Landing: el agua baja desde el Pantanal hasta Formosa; dato del corte con su categoría; un productor se registra con su establecimiento en S4.
2. Login como decisor: monitor con la serie K1 limpia y umbrales; subir el río a 7,60 m → S4 comprometido antes de la alerta; "¿cuánto tiempo queda?" con el rango de 2015-16, 2019 y oct-2026.
3. Parte de lluvia simulado de 40 mm → camino de tierra de S4 intransitable → S4 aislado; el operador marca además un acceso de ripio de S1.
4. Recomendador: familias y rodeo del productor registrado, camiones, dormidero, raciones, centro y predio receptor; comparar dos alternativas.
5. Emitir orden de evacuación preventiva para S4 → llega la notificación a la app del productor; se crea la tarea de la cuadrilla ganadera.
6. Bitácora K8 con los 6 campos; verificador K6 refutando "10,7 m" y "superó la evacuación en octubre".

## 15. Fuera de alcance del MVP (documentar como hoja de ruta)
Integración real con Meta Cloud API, gateway SMS e IVR del 103; padrones reales de SENASA/PAIPPA; GraphHopper; modelos hidrodinámicos (HEC-RAS, LISFLOOD) y teledetección SAR; inscripción de la base ante la AAIP; despliegue productivo en el data center de REFSA.

## 16. Correcciones al diseño de Gemini (no repetir sus errores)
- Picos: 9,81 m (enero 2016) y 9,72 m (junio 2019) según K1; no 9,45 m ni 8,38 m. Las alturas de 1983 (10,73 m) no tienen fuente oficial verificada.
- Datos del 16–17/11/2026 son posteriores al corte (ver P5).
- EPSG:4326 es WGS84; POSGAR 07 geográfico es EPSG:5340.
- En el ejemplo de 30 bovinos, Gemini usó 10 terneros sin vacas con cría y anunció ~90 kg/día cuando su fórmula da ~59: usar stock coherente y el valor calculado.
- Pesos del ISAD, capacidad de camiones (30) y vehículos cat. B (40) son supuestos, no normativa.
- Una consulta de expuestos con `JOIN` directo a stock duplica personas: agregar el stock antes.
- En GraphHopper la prioridad no puede superar 1.
- Tarifas de WhatsApp, artículos de resoluciones SENASA y la Decisión Administrativa 797/2022 están sin verificar: no mostrarlos como dato.

## 17. Convenciones de git
Ramas `fase-N-descripcion` o por integrante; commits en español con prefijo (`feat:`, `fix:`, `data:`, `docs:`, `test:`, `chore:`, `sec:`); nunca commitear `.env` ni datos personales.
