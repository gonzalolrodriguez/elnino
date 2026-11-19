# Constancias de evacuación y validación cruzada (cuadrilla + evacuado)

**Pedido del usuario (19/11/2026):** que la cuadrilla cierre cada tarea con constancia (ubicación de destino georreferenciada, multimedia y texto) y que el evacuado pueda corroborarla. Así el mando ve qué se hizo, qué está en curso y qué falta, con validación de los dos lados.

**Estado actual verificado:** el modelo `Tarea` solo tiene `estado` y `checklist`. No guarda quién cerró, el destino, fotos ni notas (`apps/backend/app/db/modelos.py:393`).

**Orden:** se empieza cuando termine el escritor de backend de `auditoria-integral` (C2/C3), porque comparte archivos con él (`operacion.py`, `modelos.py`, migraciones). Después, la web (tablero D1 y vistas de constancia) y la app (Monitor, cierre de cuadrilla, confirmación del evacuado) van en paralelo.

## Diseño

- **Cierre de tarea con constancia** (rol cuadrilla):
  - lat/lon de destino tomados por GPS;
  - centro de destino del catálogo;
  - personas y animales trasladados;
  - hasta N fotos (mismas reglas de tamaño y tipo MIME que los adjuntos de solicitudes);
  - nota;
  - rol operativo firmante;
  - fecha y hora.

  Funciona offline con la cola. Es idempotente (`Idempotency-Key`).
- **Confirmación del evacuado:** al cerrar, se crea una notificación para el solicitante: "¿Llegaste a X? Sí / No / Hubo un problema".
  - Responde por la app o por SMS simulado con `SI <codigo>` / `NO <codigo>`.
  - No bloquea: sin respuesta, la evacuación queda "cerrada por la cuadrilla, sin confirmar".
- **Estados de la evacuación:**
  - pendiente;
  - en curso;
  - cerrada por la cuadrilla;
  - verificada (coinciden la cuadrilla y el evacuado);
  - con discrepancia: el evacuado dice que no, o el destino está a más de X m del centro elegido (SUPUESTO en `supuestos.yaml`). Genera un aviso al operador.
- **Tablero:**
  - realizadas, en curso y pendientes por sector;
  - porcentaje de verificadas;
  - discrepancias abiertas;
  - mapa de origen a destino (solo roles operativos).
- **Privacidad (Ley 25.326):**
  - la ubicación del evacuado solo la ven los roles operativos, con registro en la bitácora de accesos;
  - en las fotos se pide el lugar o el transporte, no caras ni menores;
  - en la demo todo es SIMULADO;
  - la discrepancia es una marca para revisar, no una acusación.

## Tareas

| ID | Tarea | Ruta | Estado |
|---|---|---|---|
| F1 | Backend: migración y modelo de constancia; endpoints de cierre con constancia y adjuntos, de confirmación del evacuado (app y SMS) y de estados de evacuación. Conteos en `/panel/resumen`. Tests. | escritor backend (después de C2/C3) | Hecha |
| F2 | Web: vista de constancias y discrepancias en el panel; bloques en el tablero D1; mapa de origen a destino. | escritor web (junto con D1) | Pendiente |
| F3 | App: cierre con constancia en la pantalla de cuadrilla (GPS, centro, fotos, nota, offline); confirmación del evacuado en Alertas o Estado de tu sector. | escritor mobile (junto con el Monitor) | Hecho (adef8fa): cola offline en dos tiempos con Idempotency-Key estable, tarjeta de confirmación (app y SMS con aviso del teléfono registrado, reemplazo al reabrir), bloque evacuaciones del Monitor, envío sin GPS con referencia. tsc sin errores, jest 220/220, expo export android correcto |

## Evidencia F1 (backend, 19/11/2026)

- Commits en `rediseno-v2`: `fix: solicitudes aceptan referencia de ubicación sin coordenadas` (tarea aparte pedida por el coordinador), `feat: constancias de evacuación, confirmación del evacuado y tablero de evacuaciones` y `docs: contrato, openapi y seguridad de constancias de evacuación`.
- Migración `0006` aplicada en la base de desarrollo (`alembic upgrade head` del contenedor); el seed dejó 3 constancias SIMULADO (verificada, sin confirmar y con discrepancia).
- Checks: `ruff check .` limpio; `ruff format --check app tests` limpio; `pytest -q`: 281 pasadas; `curl /api/v1/salud`: `{"estado":"ok",...}`.
- Cambio en una prueba existente: `test_tareas_cuadrilla_actualiza_las_suyas_y_transiciones` ahora elige una tarea `pendiente` (las tareas ya cerradas con constancia por otras pruebas y el seed ya no sirven para ese caso).
- Decisiones: respuesta del evacuado única (otra distinta: 409); el estado se deriva; `verificadas_pct` se calcula sobre las evacuaciones ya cerradas por la cuadrilla; sin tope de almacenamiento por persona para fotos del personal operativo; sin límite de intentos por código SMS (hoja de ruta).
- Revisión de seguridad (19/11/2026): la confirmación por SMS quedó ligada al teléfono del solicitante, con respuesta genérica única, límite de 5 intentos fallidos por remitente y hora, códigos de 8 caracteres con vigencia de 72 h y reapertura por un operador (`sec: confirmación por SMS ligada al teléfono del solicitante, con límite e intentos y vencimiento`).
