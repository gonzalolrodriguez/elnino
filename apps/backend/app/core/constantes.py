"""Constantes de la plataforma (reglas de la mesa)."""

LEYENDA = "PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial"

CATEGORIAS = ["DATO OBSERVADO", "DOCUMENTO DE REFERENCIA", "SIMULADO"]

FECHA_CORTE = "2026-10-31"

VERSION = "0.1.0"

LIMITES = [
    "El kit no incluye lluvia observada (la planilla de precipitaciones está vacía).",
    "No existe pronóstico hidrológico más allá de 15 días; las extrapolaciones son supuestos.",
    "El kit no incluye cotas reales.",
    "El kit no incluye barrios reales.",
    "El kit no incluye caminos ni centros de recepción reales; los centros y su capacidad son SIMULADO.",
    "No hay alturas anteriores a 2006 con fuente oficial verificada (1983, 1992 y 1998 no se muestran).",
    "Decidir una evacuación, definir recorridos y disponer recursos corresponde a las autoridades; "
    "la plataforma solo recomienda y simula.",
]
