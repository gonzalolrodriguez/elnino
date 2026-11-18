# Registro de limpieza de K1 · AI LAB Misión: Código Formosa
Herramienta: `python -m app.ingest.limpieza_k1` (Python, módulo estándar `csv`) · Equipo: Equipo 3 · Instituto Politécnico Formosa

> PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial

Entrada: `data/kit/P1_DATA_INTEGRITY_dataset_participantes_v1.csv` (8347 filas, UTF-8 con BOM, no se modifica). Salidas: `data/processed/k1_limpio.csv` y `data/processed/k1_diario.csv`. Los conteos se calcularon desde los datos al ejecutar el script.

| Problema encontrado en K1 | Cómo se detectó | Cantidad de registros afectados | Cómo se resolvió | Decisión que afecta a la serie |
|---|---|---|---|---|
| Filas duplicadas idénticas | mismo `obs_id` y contenido idéntico en todas las columnas | 12 | Se conservó la primera aparición y se descartaron las repetidas | Sin efecto en valores; evita contar dos veces una medición |
| `obs_id` repetido con contenido distinto | unicidad de `obs_id` tras quitar idénticas | 0 | No hubo casos; de haberlos se conservarían y se informarían | Ninguna |
| Fechas en otro formato | patrón distinto de `YYYY-MM-DD HH:MM:SS` | 40 (20 `dd/mm/aaaa` y 20 `aaaa/mm/dd`) | Se normalizaron a `YYYY-MM-DD HH:MM:SS` sin cambiar el instante | Las mediciones quedan en su día correcto |
| Coma decimal | valor con `,` | 3 | Se reemplazó por punto | Valores recuperados sin alterar su magnitud |
| Unidad en centímetros | `unidad_registro = cm` | 7 | Se dividió por 100 para expresar en metros | Valores alineados con la unidad canónica (m) |
| Valor físicamente imposible | valor > 15 m frente a una serie cuyo máximo válido es 9,81 m (2012-07-15: 98.1 m) | 1 | Cuarentena: la fila se conserva con `calidad=cuarentena`, no se reemplaza ni se corrige (falta evidencia; pendiente de verificación con la fuente INA) | Queda fuera del máximo diario; ese día sin otra medición figura vacío |
| Valores negativos | valor < 0 | 141 | Se conservaron (la escala puede registrar valores bajo cero; mínimo -0,86 m el 2024-11-07) | Se mantienen en la serie |
| Varias mediciones el mismo día | conteo de registros por fecha | 432 días | No son duplicados: se conservaron todas; el máximo diario usa la mayor válida | Serie diaria = máximo del día |
| Huecos de cobertura en 2018 | días calendario sin registro | 25 días (25 tramos sin registro entre 2018-01-06 y 2018-12-26; el resto de 2018 tiene cobertura diaria) | No se interpolaron ni se inventaron valores: quedan vacíos en `k1_diario.csv` | Las velocidades de ascenso no cruzan los huecos |

Días sin dato en toda la serie (2006-01-01 a 2026-10-31): 131. Por año: 2008: 4, 2011: 20, 2012: 29, 2013: 14, 2016: 25, 2018: 25, 2024: 14.

Comprobación final: máximo de la serie limpia = 9,81 m en 2016-01-05, 2016-01-06 (esperado: 9,81 m, enero de 2016) · cantidad de registros finales: 8335 (8334 válidos + 1 en cuarentena)

Otras comprobaciones: pico de 2019 = 9,72 m (2019-06-02 00:00; la fecha de la serie puede diferir un día de la citada en otros documentos por huso horario); 2026-10-01 = 2,37 m; 2026-10-31 = 5,60 m.

Categoría: `DATO OBSERVADO` con alteraciones pedagógicas deliberadas (no es una serie oficial ni apta para decisiones operativas).
