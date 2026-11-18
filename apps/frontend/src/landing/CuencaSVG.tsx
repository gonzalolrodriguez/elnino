import { CURSOS_APROXIMADOS, HITOS, limites, proyectar, proyectarCurso, type Curso } from "./geometria";

/** Respaldo 2D del esquema de la cuenca: sin WebGL o con preferencia de menos movimiento. */
export function CuencaSVG({ cursos = CURSOS_APROXIMADOS }: { cursos?: Curso[] }) {
  const l = limites(cursos, 60);
  const ancho = l.xMax - l.xMin;
  const alto = l.yMax - l.yMin;
  const aSvg = ([x, y]: [number, number]): [number, number] => [x - l.xMin, l.yMax - y];
  const d = (c: Curso) =>
    proyectarCurso(c)
      .map((p, i) => {
        const [x, y] = aSvg(p);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <svg
      viewBox={`0 0 ${ancho.toFixed(0)} ${alto.toFixed(0)}`}
      role="img"
      aria-label="Esquema ilustrativo de la cuenca: del Pantanal por el río Paraguay, pasando por Asunción, Puerto Pilcomayo y Puerto Formosa, hasta la confluencia con el Paraná"
      style={{ width: "100%", height: "100%" }}
      preserveAspectRatio="xMidYMid meet"
    >
      <rect width="100%" height="100%" fill="none" />
      {cursos.map((c) => (
        <path
          key={c.id}
          d={d(c)}
          fill="none"
          stroke={c.id === "paraguay" ? "#8FD0C8" : "#4FA39C"}
          strokeWidth={c.id === "paraguay" ? 7 : 5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {HITOS.map((h) => {
        const [x, y] = aSvg(proyectar(h.lon, h.lat));
        return (
          <g key={h.id}>
            <circle cx={x} cy={y} r={h.principal ? 10 : 6} fill={h.principal ? "#D99A1E" : "#EAEFEC"} />
            <text
              x={x + 14}
              y={y + 5}
              fill={h.principal ? "#F7C860" : "#EAEFEC"}
              fontSize={h.principal ? 22 : 18}
              fontWeight={h.principal ? 700 : 500}
              fontFamily="Segoe UI, system-ui, sans-serif"
            >
              {h.nombre}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
