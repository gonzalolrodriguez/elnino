import { useEffect, useMemo, useRef } from "react";

import { SECTORES_K10 } from "../datos/kit";
import { ESTADOS } from "../estilo/estados";
import { hexDe } from "../estilo/paleta";
import { calcularAgua, coloresTerrazas, estadoSector, INTERVALO_TERRAZA_M, terraza } from "./inundacion";
import type { DatosInundacion } from "./useInundacion";

const KM_LON = 111.32 * Math.cos((-26.19 * Math.PI) / 180);
const KM_LAT = 110.57;

const aRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/**
 * Respaldo 2D de la visualización de inundación (sin WebGL o con preferencia de menos movimiento): mismas terrazas
 * de relieve, curvas cada 1 m y llenado por sector que la escena 3D, sin animación. Dibuja en un canvas y superpone
 * el contorno y la etiqueta de cada sector. La tabla de sectores es el equivalente en texto.
 */
export function Inundacion2D({ datos, altura }: { datos: DatosInundacion; altura: number }) {
  const { malla } = datos;
  const lienzo = useRef<HTMLCanvasElement>(null);
  const terrazas = useMemo(() => coloresTerrazas(malla.min, malla.max).colores.map(aRgb), [malla]);
  const base = useMemo(() => terraza(malla.min), [malla]);
  const agua = useMemo(() => ({ somera: aRgb(hexDe("rio.300")), honda: aRgb(hexDe("rio.600")) }), []);

  useEffect(() => {
    const cv = lienzo.current;
    if (!cv) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = cv.getContext("2d");
    } catch {
      ctx = null;
    }
    if (!ctx) return;
    const { nx, ny, z } = malla;
    const { prof } = calcularAgua(malla, datos.ordenes, altura, datos.cauce);
    const img = ctx.createImageData(nx, ny);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const b = terraza(z[k], INTERVALO_TERRAZA_M);
        let c = terrazas[Math.min(Math.max(b - base, 0), terrazas.length - 1)];
        // Curva de nivel: la celda tiene una vecina (este o sur) en otra terraza.
        const borde = (i < nx - 1 && terraza(z[k + 1]) !== b) || (j < ny - 1 && terraza(z[k + nx]) !== b);
        if (borde) c = c.map((v) => v * 0.55);
        const p = prof[k];
        if (p > 0) {
          const t = Math.min(p / 2.5, 1);
          const w = agua.somera.map((v, q) => v + (agua.honda[q] - v) * t);
          const a = Math.min(p / 0.3, 1) * 0.86;
          c = c.map((v, q) => v * (1 - a) + w[q] * a);
        }
        img.data.set([c[0], c[1], c[2], 255], k * 4);
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [malla, datos, altura, terrazas, base, agua]);

  const [o, s, e, n] = malla.bbox;
  const aspecto = ((e - o) * KM_LON) / ((n - s) * KM_LAT);
  const pc = (lon: number) => `${((lon - o) / (e - o)) * 100}%`;
  const pcY = (lat: number) => `${((n - lat) / (n - s)) * 100}%`;

  return (
    <div
      role="img"
      aria-label="Mapa 2D del relieve de los cuatro sectores K10 con el agua que avanza al subir la altura simulada. La tabla de sectores contiene la misma información en texto."
      style={{ position: "relative", width: "100%", maxHeight: "100%", aspectRatio: String(aspecto), margin: "0 auto", background: hexDe("pizarra.100") }}
    >
      <canvas ref={lienzo} width={malla.nx} height={malla.ny} data-capa="inundacion-2d" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {SECTORES_K10.map((sec) => {
          const est = estadoSector(sec, altura);
          const st = ESTADOS[est];
          const pts = sec.anillo.map(([lo, la]) => `${((lo - o) / (e - o)) * 100},${((n - la) / (n - s)) * 100}`).join(" ");
          return (
            <polygon
              key={sec.id}
              points={pts}
              fill="none"
              stroke={st.stroke}
              strokeWidth={est === "comprometido" ? 4 : 2.5}
              strokeDasharray={est === "en_riesgo" ? "8 5" : undefined}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
      {SECTORES_K10.map((sec) => {
        const est = estadoSector(sec, altura);
        const st = ESTADOS[est];
        const lons = sec.anillo.map((p) => p[0]);
        const lats = sec.anillo.map((p) => p[1]);
        return (
          <div
            key={sec.id}
            aria-hidden="true"
            style={{
              position: "absolute",
              left: pc((Math.min(...lons) + Math.max(...lons)) / 2),
              top: pcY((Math.min(...lats) + Math.max(...lats)) / 2),
              transform: "translate(-50%, -50%)",
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: "nowrap",
              background: "rgba(255,255,255,0.92)",
              color: hexDe("pizarra.900"),
              border: `2px ${est === "en_riesgo" ? "dashed" : "solid"} ${st.stroke}`,
              borderRadius: 8,
              padding: "2px 7px",
              pointerEvents: "none",
            }}
          >
            {sec.id} · {st.texto}
          </div>
        );
      })}
    </div>
  );
}
