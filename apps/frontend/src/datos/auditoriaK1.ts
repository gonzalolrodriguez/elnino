/**
 * Resumen de la auditoría de limpieza de K1, tomado de docs/registro_limpieza.md
 * (generado por `python -m app.ingest.limpieza_k1`). Categoría: DATO OBSERVADO con alteraciones pedagógicas.
 */
export const AUDITORIA_K1 = {
  entrada: "P1_DATA_INTEGRITY_dataset_participantes_v1.csv (8347 filas, UTF-8 con BOM; no se modifica)",
  salida: "8335 registros finales (8334 válidos y 1 en cuarentena)",
  fuente: "docs/registro_limpieza.md",
  hallazgos: [
    { problema: "Filas duplicadas idénticas", cantidad: "12", tratamiento: "Se conservó la primera aparición" },
    { problema: "Fechas en otro formato", cantidad: "40 (20 dd/mm/aaaa y 20 aaaa/mm/dd)", tratamiento: "Se normalizaron sin cambiar el instante" },
    { problema: "Coma decimal", cantidad: "3", tratamiento: "Se reemplazó por punto" },
    { problema: "Unidad en centímetros", cantidad: "7", tratamiento: "Se dividió por 100" },
    { problema: "Valor físicamente imposible (98,1 m el 15/07/2012)", cantidad: "1", tratamiento: "Cuarentena: se conserva, no se reemplaza" },
    { problema: "Valores negativos", cantidad: "141", tratamiento: "Se conservaron (mínimo −0,86 m el 07/11/2024)" },
    { problema: "Días con varias mediciones", cantidad: "432", tratamiento: "No son duplicados; el máximo diario usa la mayor válida" },
    { problema: "Huecos de cobertura en 2018", cantidad: "25 días", tratamiento: "No se interpolaron" },
  ],
  controles: [
    "Máximo de la serie limpia: 9,81 m (05 y 06/01/2016).",
    "Pico de 2019: 9,72 m (02/06/2019 en la serie; otros documentos citan el 3/06 por el huso horario).",
    "01/10/2026: 2,37 m. 31/10/2026: 5,60 m.",
    "Días sin dato en toda la serie (2006 a 2026): 131; no se interpolan.",
  ],
} as const;
