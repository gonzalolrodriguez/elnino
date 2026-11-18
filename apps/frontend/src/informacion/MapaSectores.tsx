import { MARGEN_RIESGO_M, SECTORES_K10, type Sector } from "../datos/kit";
import { ESTADOS } from "../estilo/estados";
import { hexDe } from "../estilo/paleta";
import { bordesDe, lineasDe, type LonLat } from "../relieve/datos";
import { useRelieveLocal } from "../relieve/useRelieveLocal";

const COS = Math.cos((-26.19 * Math.PI) / 180);
const MARGEN_GRADOS = 0.012;

const todos = SECTORES_K10.flatMap((s) => s.anillo);
const LON_MIN = Math.min(...todos.map((p) => p[0])) - MARGEN_GRADOS;
const LON_MAX = Math.max(...todos.map((p) => p[0])) + MARGEN_GRADOS;
const LAT_MIN = Math.min(...todos.map((p) => p[1])) - MARGEN_GRADOS;
const LAT_MAX = Math.max(...todos.map((p) => p[1])) + MARGEN_GRADOS;
const ESC = 7000; // píxeles por grado de latitud
const ANCHO = (LON_MAX - LON_MIN) * COS * ESC;
const ALTO = (LAT_MAX - LAT_MIN) * ESC;

function aX(lon: number) {
  return (lon - LON_MIN) * COS * ESC;
}
function aY(lat: number) {
  return (LAT_MAX - lat) * ESC;
}

export type EstadoSector = "normal" | "en_riesgo" | "comprometido";

export function estadoSector(s: Pick<Sector, "compromiso_m">, altura: number): EstadoSector {
  if (altura >= s.compromiso_m) return "comprometido";
  if (altura >= s.compromiso_m - MARGEN_RIESGO_M) return "en_riesgo";
  return "normal";
}

export const ESTILO_ESTADO: Record<EstadoSector, { fill: string; stroke: string; texto: string }> = ESTADOS;

const TINTA = hexDe("serie.cursor");
const TINTA_SUAVE = hexDe("serie.eje");

type Props = {
  altura?: number;
  marcador?: { lon: number; lat: number } | null;
  onElegir?: (lon: number, lat: number) => void;
  etiquetar?: boolean;
  /** Fondo de planialtimetría real (curvas de nivel del corredor y departamentos). Por defecto, activo. */
  relieve?: boolean;
};

/** Tramos de una polilínea que caen dentro del recuadro (más un vértice de margen), para no dibujar lo que queda fuera. */
function tramosVisibles(ln: LonLat[]): LonLat[][] {
  const dentro = ([lo, la]: LonLat) => lo >= LON_MIN - 0.02 && lo <= LON_MAX + 0.02 && la >= LAT_MIN - 0.02 && la <= LAT_MAX + 0.02;
  const salida: LonLat[][] = [];
  let actual: LonLat[] = [];
  ln.forEach((p, i) => {
    if (dentro(p) || (i > 0 && dentro(ln[i - 1]))) actual.push(p);
    else if (actual.length) {
      salida.push(actual);
      actual = [];
    }
  });
  if (actual.length) salida.push(actual);
  return salida.filter((t) => t.length > 1);
}

const trazo = (lineas: LonLat[][]) =>
  lineas
    .flatMap(tramosVisibles)
    .map((t) => t.map(([lo, la], i) => `${i === 0 ? "M" : "L"}${aX(lo).toFixed(1)} ${aY(la).toFixed(1)}`).join(" "))
    .join(" ");

/** Sectores K10 (SIMULADO) en SVG. Con `onElegir` permite fijar una ubicación haciendo clic. */
export function MapaSectores({ altura, marcador, onElegir, etiquetar = true, relieve = true }: Props) {
  const rel = useRelieveLocal(relieve);
  const dMenores = rel ? trazo(rel.curvas.features.filter((f) => !f.properties.maestra).flatMap(lineasDe)) : "";
  const dMayores = rel ? trazo(rel.curvas.features.filter((f) => f.properties.maestra).flatMap(lineasDe)) : "";
  const dDepartamentos = rel ? trazo(rel.departamentos.features.flatMap(bordesDe)) : "";
  function alClic(e: React.MouseEvent<SVGSVGElement>) {
    if (!onElegir) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * ANCHO;
    const py = ((e.clientY - r.top) / r.height) * ALTO;
    onElegir(Number((LON_MIN + px / (COS * ESC)).toFixed(5)), Number((LAT_MAX - py / ESC).toFixed(5)));
  }

  return (
    <svg
      viewBox={`0 0 ${ANCHO.toFixed(0)} ${ALTO.toFixed(0)}`}
      role="img"
      aria-label="Mapa esquemático de los cuatro sectores simulados K10 (S1 Norte, S2 Centro, S3 Sur, S4 Rural Este)"
      style={{ width: "100%", height: "auto", background: hexDe("superficie"), border: `1px solid ${hexDe("borde")}`, cursor: onElegir ? "crosshair" : "default" }}
      onClick={alClic}
    >
      <defs>
        <pattern id="rayado-comprometido" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="14" stroke={ESTADOS.comprometido.stroke} strokeWidth="3" />
        </pattern>
      </defs>
      {rel && (
        <g data-capa="relieve-local" aria-hidden="true" fill="none">
          <path d={dMenores} stroke={hexDe("alerta.800")} strokeOpacity={0.35} strokeWidth={1} />
          <path d={dMayores} stroke={hexDe("alerta.800")} strokeOpacity={0.7} strokeWidth={2} />
          <path d={dDepartamentos} stroke={hexDe("pizarra.700")} strokeOpacity={0.8} strokeWidth={2.5} strokeDasharray="14 8" />
        </g>
      )}
      {rel && (
        <g data-capa="relieve-local" aria-hidden="true" fill="none">
          <path d={dMenores} stroke={hexDe("alerta.800")} strokeOpacity={0.35} strokeWidth={1} />
          <path d={dMayores} stroke={hexDe("alerta.800")} strokeOpacity={0.7} strokeWidth={2} />
          <path d={dDepartamentos} stroke={hexDe("pizarra.700")} strokeOpacity={0.8} strokeWidth={2.5} strokeDasharray="14 8" />
        </g>
      )}
      {SECTORES_K10.map((s) => {
        const est = altura === undefined ? "normal" : estadoSector(s, altura);
        const st = ESTILO_ESTADO[est];
        const pts = s.anillo.map(([lo, la]) => `${aX(lo).toFixed(1)},${aY(la).toFixed(1)}`).join(" ");
        const cx = (Math.min(...s.anillo.map((p) => aX(p[0]))) + Math.max(...s.anillo.map((p) => aX(p[0])))) / 2;
        const cy = (Math.min(...s.anillo.map((p) => aY(p[1]))) + Math.max(...s.anillo.map((p) => aY(p[1])))) / 2;
        return (
          <g key={s.id}>
            <polygon points={pts} fill={st.fill} stroke={st.stroke} strokeWidth={3} strokeDasharray={est === "en_riesgo" ? "10 6" : undefined} />
            {est === "comprometido" && <polygon points={pts} fill="url(#rayado-comprometido)" opacity={0.45} />}
            {etiquetar && (
              <>
                <text x={cx} y={cy - 4} textAnchor="middle" fontSize="30" fontWeight="700" fill={TINTA}>
                  {s.id}
                </text>
                {altura !== undefined && (
                  <text x={cx} y={cy + 26} textAnchor="middle" fontSize="20" fill={TINTA}>
                    {st.texto}
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}
      {marcador && (
        <g>
          <circle cx={aX(marcador.lon)} cy={aY(marcador.lat)} r="14" fill={hexDe("mapa.marcador")} stroke={hexDe("superficie")} strokeWidth="4" />
        </g>
      )}
      <text x={ANCHO - 10} y={ALTO - 10} textAnchor="end" fontSize="18" fill={TINTA_SUAVE}>
        SIMULADO · K10 v1.0
      </text>
      {rel && (
        <text x={10} y={ALTO - 10} fontSize="14" fill={TINTA_SUAVE} data-leyenda-relieve="">
          <tspan x={10} dy="-18">
            Curvas de nivel cada {rel.meta.local.intervalo_m} m y límite departamental (IGN)
          </tspan>
          <tspan x={10} dy="18">
            DOCUMENTO DE REFERENCIA · DEM de ~75 m, error vertical de varios m
          </tspan>
        </text>
      )}
    </svg>
  );
}
