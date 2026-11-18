import { MARGEN_RIESGO_M, SECTORES_K10, type Sector } from "../datos/kit";

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

export const ESTILO_ESTADO: Record<EstadoSector, { fill: string; stroke: string; texto: string }> = {
  normal: { fill: "#EAEFEC", stroke: "#5B6B68", texto: "normal" },
  en_riesgo: { fill: "#F6D98E", stroke: "#B07A12", texto: "en riesgo" },
  comprometido: { fill: "#E58C80", stroke: "#9B2D20", texto: "comprometido" },
};

type Props = {
  altura?: number;
  marcador?: { lon: number; lat: number } | null;
  onElegir?: (lon: number, lat: number) => void;
  etiquetar?: boolean;
};

/** Sectores K10 (SIMULADO) en SVG. Con `onElegir` permite fijar una ubicación haciendo clic. */
export function MapaSectores({ altura, marcador, onElegir, etiquetar = true }: Props) {
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
      style={{ width: "100%", height: "auto", background: "white", border: "1px solid #D5DEDA", cursor: onElegir ? "crosshair" : "default" }}
      onClick={alClic}
    >
      {SECTORES_K10.map((s) => {
        const est = altura === undefined ? "normal" : estadoSector(s, altura);
        const st = ESTILO_ESTADO[est];
        const pts = s.anillo.map(([lo, la]) => `${aX(lo).toFixed(1)},${aY(la).toFixed(1)}`).join(" ");
        const cx = (Math.min(...s.anillo.map((p) => aX(p[0]))) + Math.max(...s.anillo.map((p) => aX(p[0])))) / 2;
        const cy = (Math.min(...s.anillo.map((p) => aY(p[1]))) + Math.max(...s.anillo.map((p) => aY(p[1])))) / 2;
        return (
          <g key={s.id}>
            <polygon points={pts} fill={st.fill} stroke={st.stroke} strokeWidth={3} strokeDasharray={est === "en_riesgo" ? "10 6" : undefined} />
            {etiquetar && (
              <>
                <text x={cx} y={cy - 4} textAnchor="middle" fontSize="30" fontWeight="700" fill="#13242A">
                  {s.id}
                </text>
                {altura !== undefined && (
                  <text x={cx} y={cy + 26} textAnchor="middle" fontSize="20" fill="#13242A">
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
          <circle cx={aX(marcador.lon)} cy={aY(marcador.lat)} r="14" fill="#C23B2A" stroke="white" strokeWidth="4" />
        </g>
      )}
      <text x={ANCHO - 10} y={ALTO - 10} textAnchor="end" fontSize="18" fill="#5B6B68">
        SIMULADO · K10 v1.0
      </text>
    </svg>
  );
}
