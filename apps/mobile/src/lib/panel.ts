import type { RioPanel, TiempoAUmbral } from "@/lib/servicios";

/** Número en formato es-AR (coma decimal, punto de miles), sin depender de Intl. */
export function numeroAR(n: number, decimales = 2): string {
  const [entera, dec] = Math.abs(n).toFixed(decimales).split(".");
  const miles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const signo = n < 0 && Number(Math.abs(n).toFixed(decimales)) !== 0 ? "−" : "";
  return signo + miles + (dec ? `,${dec}` : "");
}

export const metros = (n: number) => `${numeroAR(n, 2)} m`;

/** Fecha ISO `YYYY-MM-DD` (o con hora) a `dd/mm/aaaa`; si no se entiende, "—". */
export function fechaCorta(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}

/** Texto del tiempo estimado hasta un umbral (rango, nunca una sola cifra). */
export function textoTiempoAUmbral(t: TiempoAUmbral): string {
  if (t.ya_alcanzado) return `${t.objetivo} (${metros(t.valor_m)}): ya alcanzado`;
  if (t.dias_minimo === null || t.dias_maximo === null) {
    return `${t.objetivo} (${metros(t.valor_m)}): sin estimación con la tendencia actual`;
  }
  const min = numeroAR(t.dias_minimo, 1);
  const max = numeroAR(t.dias_maximo, 1);
  return `${t.objetivo} (${metros(t.valor_m)}): entre ${min} y ${max} días`;
}

/** Posiciones (0 a 1) del nivel del río y de los umbrales sobre una escala común. */
export function posicionesBarra(rio: RioPanel): { nivel: number; alerta: number; evacuacion: number } | null {
  if (!rio.disponible || rio.altura_m === undefined || !rio.umbral_alerta_m || !rio.umbral_evacuacion_m) return null;
  const tope = Math.max(rio.umbral_evacuacion_m * 1.1, rio.altura_m * 1.05);
  const f = (v: number) => Math.min(Math.max(v / tope, 0), 1);
  return { nivel: f(rio.altura_m), alerta: f(rio.umbral_alerta_m), evacuacion: f(rio.umbral_evacuacion_m) };
}

export function textoTendencia(rio: RioPanel): string | null {
  if (rio.tendencia_7d_m === null || rio.tendencia_7d_m === undefined) return null;
  const signo = rio.tendencia_7d_m > 0 ? "+" : "";
  const dia =
    rio.tendencia_7d_m_por_dia === null || rio.tendencia_7d_m_por_dia === undefined
      ? ""
      : ` (${rio.tendencia_7d_m_por_dia > 0 ? "+" : ""}${numeroAR(rio.tendencia_7d_m_por_dia, 3)} m por día)`;
  return `Tendencia de 7 días: ${signo}${numeroAR(rio.tendencia_7d_m, 2)} m${dia}`;
}
