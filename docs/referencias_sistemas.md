# Referencias: sistemas reales de alerta temprana y gestión de evacuaciones

> PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial
>
> Relevamiento de fuentes públicas realizado el 20/11/2026 para EvacuaFor (Equipo 3, Desafío 6). Todo lo que se afirma aquí proviene de las URLs de la sección 6 o está marcado como **inferencia** o **no verificado**. Cuando la pila tecnológica de un sistema no es pública, se dice así y no se adivina.
>
> Límites del relevamiento: se hizo con búsqueda web y lectura parcial de páginas. Varias páginas oficiales (GSMA, algunos portales gubernamentales) devolvieron error 403 o no se pudieron abrir, por lo que parte de la información se apoya en resúmenes de buscador de la fuente citada. Esos casos se marcan con "(resumen)". Antes de citar una cifra en un documento oficial de la entrega, abrir la fuente.

---

## 1. Tabla resumen

| Sistema (país) | Responsable | Qué hace | Canales | Tecnología pública | Abierto |
|---|---|---|---|---|---|
| SINAGIR / SINAME (AR) | Ministerio de Seguridad Nacional | Coordina el sistema nacional; SINAME registra datos de organismos de alerta y emergencias | Web, avisos por color | No documentada en detalle | No consta |
| INA - Sistema de Información y Alerta Hidrológico (AR) | Instituto Nacional del Agua | Monitoreo y pronóstico de ríos de la Cuenca del Plata (incluye Paraguay y Pilcomayo); es la fuente de K2/K3 | Web, geoserver, series temporales, informes diarios en PDF | URLs de mapa web, geoserver y CSV públicos; software interno no documentado | Datos sí; software no consta |
| SMN alertas (AR) | Servicio Meteorológico Nacional | Alertas meteorológicas por color | Web; feed CAP listado en el registro de la OMM | CAP | Datos sí |
| AlertAR (AR) | ENACOM / Min. Seguridad | Alerta masiva por celular (cell broadcast) | Cell broadcast | Licitación 0003/2026 de plataformas CBE y CBC; sin adjudicación confirmada en las fuentes | No aplica |
| Cemaden + Defesa Civil Alerta + S2iD (BR) | MCTI / Min. Integración y Desarrollo Regional | Monitoreo, alerta por cell broadcast y SMS, registro federal de desastres | Cell broadcast, SMS 40199, WhatsApp, Telegram | Pluviómetros, radares; S2iD sin detalle de pila | No consta |
| SINAE + MIRA (UY) | Sistema Nacional de Emergencias + PNUD | Monitor integral de riesgos y afectaciones | Web para usuarios autorizados | Plataforma GIS (Esri según resumen de PNUD; no verificado) | No consta |
| SENAPRED + SAE (CL) | Servicio Nacional de Prevención y Respuesta | Alerta por cell broadcast geolocalizada | Cell broadcast | Canal SMS-CB de operadores móviles | No aplica |
| SEN + DMH/DINAC (PY) | Secretaría de Emergencia Nacional | Alertas de crecida por nivel de río, albergues | Prensa, web | No documentada; un informe académico indica protocolo SEN-DMH, de fecha no confirmada | No consta |
| INDECI SINPAD + EDAN + SENAMHI (PE) | Instituto Nacional de Defensa Civil | Registro de emergencias y daños (EDAN), cadena de alertas técnico-científicas hasta COEN | Web, presentaciones | Arquitectura no publicada en las fuentes | No consta |
| UNGRD + IDEAM (CO) | UNGRD / IDEAM | Boletines y alertas hidrológicas; visor FEWS de niveles | Boletines, app IDEAM, visor web | Visor FEWS (posible Delft-FEWS: **inferencia** por el nombre `fews.ideam.gov.co`) | No consta |
| SNGR + Alertas Ecuador + Amaru (EC) | SNGR; Amaru es privada | Portal El Niño, visualizador de preparación; Amaru: mapa de riesgo y alertas | Web, app (Amaru) | Amaru usa Google Flood Forecasting, RainViewer, Open-Meteo, OSM, CARTO | Amaru no es oficial |
| Google Flood Hub | Google Research | Pronóstico de crecidas de ríos, cobertura global | Web, Google Search/Maps, alertas | Modelo LSTM; framework liberado en 2026 | Sí, Apache 2.0 (modelo y entrenamiento) |
| Copernicus GloFAS / EMS | Comisión Europea / ECMWF | Pronóstico global de crecidas, mapeo rápido por satélite | Web, datos | LISFLOOD (código abierto) + ensemble ECMWF IFS | Modelo abierto; datos gratuitos |
| Delft-FEWS | Deltares | Plataforma de integración de modelos y datos para pronóstico operativo | Configurable | Usada en cerca de 70 países; licencia no confirmada | Parcial: ver sección 2 |
| WebEOC | Juvare | Gestión de incidentes, recursos, ocupación de albergues (NIMS/ICS) | Web | Propietario | No |
| Sahana Eden | Sahana Software Foundation | Plataforma humanitaria: refugios, voluntarios, desaparecidos, pedidos | Web | Python; licencia MIT | Sí |
| Ushahidi | Ushahidi | Reportes ciudadanos georreferenciados | SMS, email, RSS, web, redes | API REST, Docker; AGPL (según Wikipedia) | Sí |
| FEMA IPAWS (EE.UU.) | FEMA | Pasarela de alertas autenticadas | WEA, EAS, NOAA Weather Radio, web | CAP | Estándar abierto |
| Flood warnings UK | Environment Agency | Avisos de crecida y API abierta de monitoreo | Web, avisos directos, API | API REST bajo Open Government Licence | Datos sí |
| Japón L-Alert / J-Alert | Gabinete / FDMA / MIC | Difusión de información de evacuación vía medios y apps; alertas nacionales | Medios, apps, sirenas | Plataforma común (L-Alert) | No consta |
| HOT / OSM | Humanitarian OpenStreetMap Team | Mapeo colaborativo (Tasking Manager, OpenAerialMap) | Web | Código abierto | Sí |
| ODK / KoboToolbox | Comunidad ODK / Kobo | Formularios offline para relevamiento de campo | Android, web (Enketo) | XLSForm, XForms; código abierto | Sí |

---

## 2. Sistemas por región

### 2.1 Argentina

**SINAGIR y SINAME.** La Secretaría Ejecutiva del SINAGIR depende del Ministerio de Seguridad Nacional y emite recomendaciones preventivas apoyándose en SINAME, que registra datos de organismos vinculados a alertas y emergencias. Las fuentes describen el origen de SINAME de forma inconsistente (2019 con PNUD, o un piloto institucionalizado en 2023). La resolución de 2023 lista como objetivo un sistema de alerta multiamenaza en tiempo real con información georreferenciada. No encontré documentación de su pila tecnológica. Fuentes: [1], [2], [3].

**INA - Sistema de Información y Alerta Hidrológico.** Opera desde 1983 la alerta de la Cuenca del Plata (cinco países) con más de 600 estaciones. Publica informes diarios en PDF, un mapa web con geoserver, series temporales y un repositorio https. Los informes de Paraguay incluyen niveles previstos en Formosa y Puerto Pilcomayo con umbrales de alerta y evacuación, y el estado de las estaciones de bombeo de la defensa de la ciudad de Formosa. Es la fuente de K2 y K3 del kit. Fuentes: [4], [5], [6].

**SMN.** Emite alertas amarillo/naranja/rojo. El registro de autoridades de alerta de la OMM lista un feed CAP del SMN (`ssl.smn.gob.ar/CAP/AR.php`); no verifiqué que siga activo. Una nota gubernamental indica que los avisos a muy corto plazo están disponibles en formato CAP. Fuentes: [7], [8].

**AlertAR.** ENACOM fijó cell broadcast como tecnología base (Res. 960/2025 y 1387/2025) y abrió la Licitación Pública 0003/2026 para las plataformas CBE y CBC. El Ministerio de Seguridad afirma cobertura potencial del 99,9 % de la población (afirmación oficial, no verificada de forma independiente). Un pedido de informes legislativo pregunta por el estado de la adjudicación, lo que sugiere que no estaba confirmada. **No pude confirmar que esté operativo.** Fuentes: [9], [10].

**Formosa/Chaco.** No encontré una plataforma provincial de Defensa Civil con app o portal de alerta de inundaciones. Esto es ausencia en una búsqueda, no prueba de inexistencia. Sí aparece el sistema de alerta del Pilcomayo de la Comisión Nacional del Pilcomayo, con semáforo (amarillo/naranja/rojo) y umbrales por escala (en Pozo Hondo: naranja 5,50 m, rojo 6,50 m, según nota de enero 2026), y una nota de opinión que atribuye al proyecto Gran Chaco Proadapt un sistema de alerta que dio varios días de aviso en la crecida de 2014. Fuentes: [11], [12].

### 2.2 Brasil

**Cemaden.** Creado en 2011 por decreto. Monitorea con pluviómetros automáticos (3.100 en 2018 según su informe de gestión), radares y estaciones hidrológicas, y envía alertas al CENAD, que las reenvía a las Defensas Civiles estaduales y municipales. Según una nota periodística, los alertas van a Defensa Civil y no directamente al público. Fuentes: [13], [14].

**Defesa Civil Alerta y SMS 40199.** Dos canales: SMS por registro de CEP al 40199 (y WhatsApp), y cell broadcast sin registro, solo 4G/5G. El gobierno lo describe como complemento de SMS, TV paga, WhatsApp, Telegram y Google Public Alerts. Las fuentes difieren sobre la cobertura regional del cell broadcast; no consulté el mapa oficial vigente. Fuentes: [15], [16].

**S2iD.** Plataforma federal para registrar desastres y solicitar reconocimiento federal y recursos; los entes federativos habilitan a sus usuarios. Es un sistema de registro administrativo, no de gestión operativa de evacuación. Fuentes: [17].

### 2.3 Uruguay

**SINAE y MIRA.** Monitor Integral de Riesgos y Afectaciones, desarrollado con el Fondo de Innovación del PNUD y presentado en 2019. Reúne información de instituciones y, según PNUD, de la población vía redes sociales. La página oficial lista visores (histórico de eventos, Índice de Riesgo por Eventos Extremos, Pérdida Anual Esperada para cultivos y **ganadería por sequía**) y acceso restringido a usuarios autorizados. El PNUD señala que corre sobre una plataforma GIS de Esri: **resumen de buscador, no lo pude confirmar en la página oficial**. Fuentes: [18], [19].

### 2.4 Chile

**SENAPRED y SAE.** Cell broadcast georreferenciado, "ante una emergencia que derive en la necesidad de evacuar". No usa la red regular de datos móviles, por lo que no se satura. Desde 2017 todos los celulares vendidos en Chile son compatibles. Se hacen pruebas mensuales silenciosas y calendarios de pruebas comunales. Críticas documentadas: en Angol el aviso llegó con la inundación ya en curso; SENAPRED lo define como complemento de la evacuación en terreno. Quién activa y con qué criterio: no verificado. Fuentes: [20], [21], [22].

### 2.5 Paraguay

**SEN y DMH/DINAC.** Las notas de prensa muestran alertas por nivel del río Paraguay en Asunción y apertura de albergues. Un informe académico indica que el país no tenía sistema de alerta temprana y que se redactó un protocolo SEN-DMH/DINAC; sin fecha confirmada. No pude verificar el estado actual ni la pila tecnológica. Fuentes: [23].

### 2.6 Perú

**INDECI: SINPAD, EDAN y COEN.** SINPAD registra emergencias, declaratorias y damnificados con el formato EDAN (evaluación de daños y análisis de necesidades). La cadena de alertas va de SENAMHI y otras entidades técnico-científicas al COEN y a los gobiernos regionales. No hay descripción oficial de la arquitectura de SINPAD en las fuentes. Fuentes: [24], [25].

### 2.7 Colombia

**UNGRD e IDEAM.** IDEAM opera un servicio de pronósticos y alertas desde 2011, publica boletines al SNGRD con alertas hidrológicas por área hidrográfica, una app con alertas y un visor de niveles (`fews.ideam.gov.co`). Distingue aviso, alerta e información. Que ese visor sea Delft-FEWS es una **inferencia** por el nombre; no lo confirmé. No encontré datos sobre plataformas propias de la UNGRD. Fuente: [26].

### 2.8 Ecuador

**SNGR, Alertas Ecuador, Alístate Ecuador y Amaru.** SNGR presentó el portal Alertas Ecuador y el visualizador Alístate Ecuador sobre capacidades de preparación y respuesta ante El Niño. Amaru es una app privada (Bonsai Digital Development) que calcula un índice de riesgo 0-100 con cinco variables y reúne datos de Google Flood Forecasting, RainViewer, Open-Meteo, OpenStreetMap y CARTO; declara no ser fuente oficial. La normativa de ARCOTEL prevé un Cell Broadcast Center de los operadores y una entidad de cell broadcast operada por ECU911; no confirmé que esté operativo. Fuentes: [27], [28], [29].

### 2.9 Sistemas internacionales

**Google Flood Hub.** Pronóstico de crecidas fluviales con cobertura de 100 países con datos verificados y hasta 150 con calibres virtuales (actualización de noviembre 2024), horizonte de siete días; acceso gratuito. El 3/06/2026 Google liberó bajo Apache 2.0 el framework de hidrología (repo `google-research/flood-forecasting`, PyTorch, LSTM), con la versión original y la v2 que alimenta Flood Hub; entrena con el dataset abierto Caravan y permite ajuste fino local. El Instituto Hidrometeorológico checo lo probó y construyó un adaptador a Delft-FEWS. Las cifras de población alcanzada difieren entre fuentes de Google (700 millones vs. 2.000 millones); no las usar sin verificar. Fuentes: [30], [31], [32].

**Copernicus GloFAS y EMS.** Pronóstico global con el ensemble IFS de ECMWF y el modelo abierto LISFLOOD (v4.0, resolución 0,05°, julio 2023). Una página indica horizonte de 15 días y otras de 30; verificar en documentación vigente. Incluye mapeo rápido de inundación y evaluación de impacto, y pretarea de imágenes satelitales. Fuentes: [33].

**Delft-FEWS.** Plataforma de Deltares para integrar modelos y datos en pronóstico operativo; Deltares informa uso en cerca de 70 países desde 1999. Se describe como "software experto gratuito" con licencia de usuario final; **no pude confirmar si el código fuente es público ni su licencia** (la configuración comunitaria OpenFEWS sí es MIT, pero es solo configuración). Fuentes: [34], [35].

**WebEOC (Juvare).** Plataforma web propietaria alineada con NIMS/ICS: gestión de incidentes, solicitudes y despliegue de recursos y personal, ocupación y estado de albergues con mapas. Las capacidades son las que declara el fabricante. Fuentes: [36].

**Sahana Eden.** "Kit de desarrollo rápido de aplicaciones para ayuda humanitaria y gestión de emergencias", licencia MIT, Python con estructura MVC. Según descripciones de OSGeo incluye registro de refugios (ubicación, capacidad, distribución), gestión de voluntarios, personas desaparecidas, identificación de víctimas, pedidos y registro de organizaciones. No confirmé el framework exacto ni los módulos en el repositorio. Fuentes: [37], [38].

**Ushahidi.** Reportes ciudadanos georreferenciados por SMS, email, RSS, web y redes; v3 bajo AGPL según Wikipedia; backend con API REST y Docker. Estado actual de mantenimiento y licencia: no verificados en documentación propia. Fuentes: [39].

**FEMA IPAWS y WEA.** Pasarela nacional de alertas autenticadas desde más de 1.800 autoridades; los mensajes se redactan en software compatible con CAP, entran a IPAWS-OPEN en formato CAP y se distribuyen a operadores (WEA), EAS, NOAA Weather Radio y servicios web. FEMA no revisa ni aprueba los mensajes; no hay costo por enviar o recibir. Fuentes: [40].

**Reino Unido.** La Environment Agency ofrece una API abierta de monitoreo de crecidas (avisos y alertas, niveles y caudales cada 15 minutos aproximadamente) bajo Open Government Licence; solo Inglaterra. Floodline Warnings Direct llega a más de 1,1 millones de propiedades. No encontré una API distinta de "check for flooding". Fuentes: [41].

**Japón.** L-Alert es una plataforma común por la que municipios envían información de desastre a medios y apps (operativa desde junio de 2011, todas las prefecturas adheridas en abril de 2018). J-Alert (FDMA) es para alertas nacionales. La escala de niveles de evacuación: solo confirmé el nivel 3 (evacuación de ancianos) y el 4 (evacuar); no verifiqué el resto. Fuentes: [42].

**HOT/OSM.** Tasking Manager divide trabajos de mapeo en tareas, y OpenAerialMap aloja imágenes abiertas; ambos de código abierto. Caso documentado: inundaciones de Nigeria 2024. Fuentes: [43].

**ODK y KoboToolbox.** Formularios offline sobre el estándar XLSForm/XForms, con app Android (KoboCollect/ODK Collect) y formularios web (Enketo); datos guardados en el dispositivo hasta tener conexión. Las fuentes encontradas no documentan casos de desastre específicos. Fuentes: [44].

---

## 3. Qué hace EvacuaFor que estos no

Cada punto se limita a lo respaldado por las fuentes revisadas. "No encontré" significa ausencia en este relevamiento; no prueba que ningún sistema lo haga.

1. **Evacuación de producción (ganado, colmenas) como módulo operativo.** En el relevamiento, la única mención de ganadería en un sistema oficial fue MIRA, con visores de pérdida esperada de cultivos y ganadería por sequía (análisis de riesgo, no logística de traslado). Para evacuación de ganado solo aparecen guías de papel y proyectos académicos o propuestos (CALE de UC Davis, un prototipo estudiantil de UIC), que a su vez no consta que estén desplegados [45]. EvacuaFor calcula camiones, dormidero, lotes y raciones.
2. **Simulador con supuestos explícitos y rotulados.** Los sistemas relevados son de monitoreo, alerta o registro. No encontré en ellos un simulador de "qué pasa si" que combine altura de río, lluvia y caminos cerrados con supuestos declarados. (Amaru calcula un índice 0-100 sin que las fuentes describan sus supuestos.)
3. **Aislamiento de sectores por accesos (caminos marcables como no transitables) integrado al recomendador.** No encontré esta función en los sistemas revisados; WebEOC maneja recursos y albergues, no ruteo por accesos según la descripción del fabricante.
4. **Brecha entre alerta y logística.** SAE, Defesa Civil Alerta y AlertAR son canales de aviso; Chile lo define como complemento de la evacuación en terreno. EvacuaFor cubre lo que sigue al aviso: asignación a centros, cuadrillas y órdenes con bitácora.
5. **Bitácora de decisión con responsable por rol y evidencia.** No encontré un equivalente público en los sistemas revisados. (S2iD registra desastres para reconocimiento federal, otro propósito.)
6. **Confirmación y reporte ciudadano de dos vías.** Ushahidi y Sahana cubren reportes y refugios, pero son plataformas genéricas que requieren configurar y operar. EvacuaFor integra solicitudes de asistencia con el sector, la orden y la cuadrilla. **Inferencia**: esto es integración, no una capacidad que otros no tengan por separado.
7. **Honestidad frente a la incertidumbre.** Categorías de dato visibles, panel de límites y verificación de afirmaciones de IA (K6). No encontré esto como funcionalidad en los sistemas revisados.

Lo que EvacuaFor **no** hace y estos sí: pronóstico hidrológico propio (GloFAS, Flood Hub, INA), alerta masiva por cell broadcast (SAE, Defesa Civil Alerta), integración operativa con autoridades reales, e interoperabilidad CAP completa. Hay que decirlo en el pitch.

---

## 4. Qué podemos adoptar (hoja de ruta)

Esfuerzos son estimaciones del equipo (**inferencia**), no medidos.

| # | Qué | Para qué | Esfuerzo | Dependencias |
|---|---|---|---|---|
| A1 | Exportar las órdenes de EvacuaFor como mensajes **CAP** 1.2 (XML) | Interoperar con el feed del SMN, IPAWS y futuros emisores como AlertAR | Bajo-medio (2-3 días; el esquema es público) | Definir campos (área = polígono del sector K10, urgencia, certeza). Ninguna cuenta externa |
| A2 | Consumir el feed CAP del SMN para mostrar alertas meteorológicas con su categoría `DOCUMENTO DE REFERENCIA` | Complementar lluvia (P8) | Bajo | Verificar que el feed siga activo; regla de datos posteriores al corte (P5) |
| A3 | Modo "cell broadcast" documentado: la orden genera un texto CAP listo para un operador | Dejar el camino preparado para AlertAR sin simular una infraestructura que no existe | Bajo (documentación y plantilla) | Adjudicación de AlertAR no confirmada; no prometer integración |
| A4 | Formularios de campo estilo **XLSForm/ODK** (EDAN simplificado) para cuadrillas | Relevamiento offline estandarizado; export a CSV | Medio | Decidir si se usa Kobo/ODK real o se replica el formato en la app |
| A5 | Integrar el framework **google-research/flood-forecasting** (Apache 2.0) o consultar Flood Hub como `REFERENCIA` | Pronóstico de caudal/nivel con rango de incertidumbre, sin construir un modelo | Alto (requiere datos, entrenamiento, validación) | Datos de las estaciones del INA; GPU; Caravan. Probablemente fuera del MVP |
| A6 | Adaptador hacia **Delft-FEWS** | Integrarse con sistemas hidrológicos operativos (el checo ya lo hizo) | Alto | Confirmar licencia de Delft-FEWS; relevante solo si una autoridad lo usara |
| A7 | Tomar de **Sahana Eden** el modelo de registro de refugios (capacidad, ocupación, servicios) como referencia de campos | Validar el esquema de `centros_recepcion` | Bajo (lectura) | Ninguna |
| A8 | Reportes ciudadanos tipo Ushahidi: categorías, verificación y capa en mapa | Mejorar la cadena recibida → verificada → asignada | Medio | Ya existe `solicitudes_asistencia` |
| A9 | Publicar datos con licencia abierta y API documentada (modelo UK EA) | Reutilización por terceros | Bajo-medio | Decisión del equipo sobre licencia |
| A10 | Cargar capas en OSM/HOT Tasking Manager (caminos y edificios del corredor) | Mejorar la red vial para ruteo | Medio | Comunidad OSM Argentina; fuera del alcance del evento |

Recomendación: priorizar A1 a A3 y A7, que se hacen sin depender de terceros y fortalecen la diferencia del proyecto con estándares reales. Dejar A5 y A6 como hoja de ruta.

---

## 5. Frases para el pitch de 3 minutos

> "Argentina, Brasil y Chile ya tienen o están implementando alertas masivas por celular; eso avisa, pero no organiza la evacuación. EvacuaFor cubre el paso siguiente: a dónde va cada familia, con qué camiones, y también a dónde va el ganado."

> "En los sistemas públicos que relevamos no encontramos un módulo que organice el traslado de producción ganadera ni un simulador con supuestos declarados; el nuestro lo hace, y cada cifra lleva su categoría y su fuente."

> "No reemplazamos el pronóstico del INA ni las alertas oficiales; las usamos como dato de entrada y dejamos registrada, por rol, la decisión humana de evacuar."

(Aclaración para quien presente: "no encontramos" refleja un relevamiento de fuentes públicas, no un estudio exhaustivo. No decir "ningún sistema del mundo".)

---

## 6. Fuentes (fecha de acceso: 20/11/2026)

**Argentina**
- [1] Presidencia de la Nación, SINAGIR/SINAME: https://www.argentina.gob.ar/noticias/presentamos-el-sistema-nacional-de-alerta-y-monitoreo-de-emergencias-los-paises-del
- [2] Boletín Oficial, resolución de 2023 sobre SINAME: https://www.boletinoficial.gob.ar/detalleAviso/primera/284635/20230418
- [3] Presidencia de la Nación, centro nacional de alerta y monitoreo: https://www.argentina.gob.ar/noticias/inauguramos-el-primer-centro-nacional-de-alerta-y-monitoreo-de-emergencias
- [4] INA, alerta hidrológica (reportes diarios, ejemplo): https://alerta.ina.gob.ar/ina/06-INFORMES/diario/pdf/reporte_diario_2026-03-16.pdf
- [5] INA, presentación COHIFE 14/07/2026 (accesos a productos): https://icaa.gov.ar/wp-content/uploads/2026/08/INA.-Presentacion_COHIFE_20260714.pdf
- [6] INA, informe Paraguay (ejemplo): https://www.ina.gob.ar/archivos/alerta/Informe_Paraguay_2024-12-30.pdf
- [7] Registro de autoridades de alerta de la OMM (SMN): https://alertingauthority.wmo.int/authorities.php?recId=4
- [8] Presidencia de la Nación, avisos del SMN en CAP: https://www.argentina.gob.ar/node/230279
- [9] Marval O'Farrell Mairal, aprobación del programa AlertAR: https://www.marval.com/publicacion/se-aprueba-el-programa-sistema-de-alerta-temprana-alertar-17401
- [10] MobileTime, licitación AlertAR (13/07/2026): https://mobiletime.la/noticias/13/07/2026/licitacion-alertar-argentina/
- [11] La Nación (Paraguay), Pilcomayo, monitoreo (23/01/2026): https://www.lanacion.com.py/negocios/2026/01/23/tras-el-repunte-del-caudal-del-rio-pilcomayo-los-monitoreos-tecnicos-continuan-en-la-zona/
- [12] La Nación (Argentina), "Inundaciones: la organización social es la mejor defensa": https://www.lanacion.com.ar/opinion/inundaciones-la-organizacion-social-es-la-mejor-defensa-nid2124149/

**Brasil**
- [13] Cemaden, sobre el Cemaden: https://www.gov.br/cemaden/pt-br/paginas/sobre-o-cemaden
- [14] Cemaden, informe de gestión 2018: https://www.gov.br/cemaden/pt-br/acesso-a-informacao/institucional-1/termo-de-compromisso-de-gestao/Relatorio_TCG_2018.pdf
- [15] gov.br, registro para avisos de desastres (SMS 40199): https://www.gov.br/pt-br/servicos/solicitar-cadastro-para-recebimento-de-avisos-e-alertas-de-desastres
- [16] Agência gov, un año de Defesa Civil Alerta: https://agenciagov.ebc.com.br/noticias/202508/um-ano-do-defesa-civil-alerta-425-mensagens-emitidas-e-milhares-de-vidas-protegidas-com-a-nova-tecnologia-de-prevencao
- [17] MDR, S2iD (acceso al sistema): https://www.gov.br/mdr/pt-br/assuntos/protecao-e-defesa-civil/sistema-integrado-de-informacoes-sobre-desastres/01_m0-acesso-ao-sistema.pdf

**Uruguay, Chile, Paraguay, Perú, Colombia, Ecuador**
- [18] SINAE, MIRA: https://www.gub.uy/sistema-nacional-emergencias/mira
- [19] PNUD Uruguay, MIRA: https://www.undp.org/es/node/275221
- [20] GSMA, caso SAE Chile: https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/gsma_resources/chiles-emergency-alert-system-the-role-of-mobile-network-operators-in-early-warning-systems/ (la página devolvió 403; se usó el resumen de búsqueda)
- [21] El Mostrador, SAE de SENAPRED (3/08/2025): https://www.elmostrador.cl/datos-utiles/2025/08/03/alerta-sae-asi-funciona-el-sistema-de-senapred-que-avisa-en-caso-de-peligro/
- [22] 24horas, falencias de la alerta SAE: https://www.24horas.cl/las-falencias-de-la-alerta-sae-ante-distintos-tipos-de-catastrofes
- [23] Informe UC (Paraguay), protocolo SEN-DMH: https://cta.uc.edu.py/wp-content/uploads/2020/12/CompilaciondeResuktados14_INV_440.pdf
- [24] INDECI ante el Congreso (SINPAD/EDAN): https://www.congreso.gob.pe/Docs/comisiones2021/CES-emergencias-desastres-covid19/files/ppt2025/exposiciÓn_31_marzo_2025.pdf
- [25] Cruz Roja/INDECI, sistema de alerta temprana: https://www.climatecentre.org/downloads/files/Brochure%20Tecnico%20-%20Sist%20de%20Alerta%20Temprana%20-%20final.pdf
- [26] IDEAM, alertas (presentación ITU 2017): https://www.itu.int/en/ITU-D/Emergency-Telecommunications/Documents/2017/Bogota/Presentations/S4_Desde%20la%20Óptica%20de%20las%20Alertas%20Tempranas%20Emitidas%20por%20Instituto%20de%20Hidrología%20Meteorologí_Sr%20Cristian%20Collazos.pdf
- [27] Primicias, Amaru: https://www.primicias.ec/ciencia-tecnologia/lluvias-inundaciones-ecuador-guayaquil-amaru-aplicacion-alertas-135827/
- [28] Vistazo, quién está detrás de Amaru (14/11/2026): https://www.vistazo.com/tendencias/tecnologia/2026-11-14-amaru-aplicacion-advierte-riesgos-fenomeno-creadores-AC11317337
- [29] ARCOTEL, Resolución 2022-0096 (cell broadcast): https://www.arcotel.gob.ec/wp-content/uploads/downloads/2022/03/Resolucion-ARCOTEL-2022-0096.pdf

**Internacionales**
- [30] Google Research, liberación del framework de hidrología (3/06/2026): https://research.google/blog/the-next-chapter-in-flood-resilience-open-sourcing-googles-hydrology-framework/
- [31] Google, cobertura de Flood Hub: https://blog.google/outreach-initiatives/sustainability/flood-hub-ai-flood-forecasting-more-countries/
- [32] Nature 2024, pronóstico global en cuencas sin aforo: https://www.nature.com/articles/s41586-024-07145-1.pdf
- [33] GloFAS, productos: https://global-flood.emergency.copernicus.eu/technical-information/products
- [34] Deltares, Delft-FEWS: https://oss.deltares.nl/web/delft-fews
- [35] Deltares, OpenFEWS (configuración, MIT): https://awesome.ecosyste.ms/projects/github.com%2Fdeltares%2Fcanopenfews
- [36] Juvare, WebEOC (vendedor): https://www.juvare.com/state-local-government/
- [37] Sahana Eden, repositorio: https://github.com/sahana/eden
- [38] OSGeo, resumen de Sahana: https://live-archive.osgeo.org/5.0/ja/overview/sahana_overview.html
- [39] Wikipedia y BID, Ushahidi: https://en.wikipedia.org/wiki/Ushahidi y https://knowledge.iadb.org/en/code-development/open-source-solutions/ushahidi
- [40] FEMA, IPAWS y CAP: https://www.fema.gov/emergency-managers/practitioners/integrated-public-alert-warning-system/public-safety-officials/alerting-authorities y https://www.fema.gov/sites/default/files/2020-06/CAP-implementation-fact-sheet_09-13-2019.pdf
- [41] Environment Agency, API de monitoreo de crecidas: https://environment.data.gov.uk/flood-monitoring/doc/reference
- [42] Gabinete de Japón, L-Alert y evacuación: https://www.bousai.go.jp/pdf/pam3-2.pdf
- [43] OSM wiki, HOT Tasking Manager y caso Nigeria 2024: https://wiki.openstreetmap.org/wiki/Tasking_Manager y https://wiki.openstreetmap.org/wiki/2024_Nigeria_Floods
- [44] KoboToolbox: https://kobotoolbox.org/about-us/software
- [45] Ganado y evacuación (UC Davis CALE, USDA NIFA): https://portal.nifa.usda.gov/enterprise-search/cris_projects/1032858

---

## 7. Lo que no pude verificar

- Estado operativo actual de AlertAR (Argentina), del cell broadcast de Ecuador y la cobertura regional del de Brasil.
- Licencia y disponibilidad de código fuente de Delft-FEWS; si `fews.ideam.gov.co` es Delft-FEWS.
- Tecnología de MIRA (Esri) en la página oficial; módulos y fuentes de datos de MIRA.
- Pila tecnológica de SINAME, SINPAD, S2iD, SEN (Paraguay) y del sistema del INA.
- Quién activa el SAE de Chile y con qué criterios.
- Escala completa de niveles de evacuación de Japón (solo confirmé niveles 3 y 4).
- Existencia de herramientas provinciales de Formosa o Chaco: no encontré, pero fue una sola búsqueda.
- Sahana Eden: framework exacto y módulo de refugios en el repositorio; estado de mantenimiento y licencia vigente de Ushahidi.
