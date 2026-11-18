import { hexDe } from "../estilo/paleta";
import { bordesDe, centroide, lineasDe, nombreDepartamento, urlRelieve, type DatosRelieve, type FeatureGeo, type LonLat } from "../relieve/datos";
import { CURSOS_APROXIMADOS, HITOS, HITOS_RELIEVE, limites, limitesDeBbox, proyectar, proyectarCurso, type Curso } from "./geometria";

const ARIA_RELIEVE =
  "Mapa de relieve de la cuenca, en vista en planta: curvas de nivel y color según la altitud desde las nacientes del río Paraguay en Mato Grosso hasta la confluencia con el Paraná, con el límite y los nueve departamentos de Formosa, el río Paraguay, Asunción, Puerto Pilcomayo y Puerto Formosa";

type Props = { cursos?: Curso[]; datos?: DatosRelieve | null };

/**
 * Respaldo 2D de la escena de la cuenca (sin WebGL o con preferencia de menos movimiento).
 * Con `datos` dibuja el relieve real: tinte hipsométrico, curvas de nivel, límite y departamentos de Formosa,
 * río Paraguay y hitos. Sin `datos` (cargando o sin archivos) cae al esquema ilustrativo de siempre.
 */
export function CuencaSVG({ cursos = CURSOS_APROXIMADOS, datos = null }: Props) {
  return datos ? <CuencaRelieveSVG datos={datos} /> : <CuencaEsquemaSVG cursos={cursos} />;
}

function CuencaRelieveSVG({ datos }: { datos: DatosRelieve }) {
  const l = limitesDeBbox(datos.meta.cuenca.bbox);
  const ancho = l.xMax - l.xMin;
  const alto = l.yMax - l.yMin;
  const aSvg = ([lon, lat]: LonLat): [number, number] => {
    const [x, y] = proyectar(lon, lat);
    return [x - l.xMin, l.yMax - y];
  };
  const trazo = (lineas: LonLat[][], cerrar = false) =>
    lineas
      .map(
        (ln) =>
          ln
            .map((p, i) => {
              const [x, y] = aSvg(p);
              return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
            })
            .join(" ") + (cerrar ? "Z" : ""),
      )
      .join(" ");
  const menores = datos.curvas.features.filter((f) => !f.properties.maestra);
  const mayores = datos.curvas.features.filter((f) => f.properties.maestra);
  const dUnion = (fs: FeatureGeo[]) => fs.map((f) => trazo(lineasDe(f))).join(" ");
  const tinta = hexDe("limo.950");

  return (
    <svg
      data-relieve="real"
      viewBox={`0 0 ${ancho.toFixed(0)} ${alto.toFixed(0)}`}
      role="img"
      aria-label={ARIA_RELIEVE}
      style={{ width: "100%", height: "100%" }}
      preserveAspectRatio="xMidYMid meet"
    >
      <image href={urlRelieve("tinte_cuenca.png")} x={0} y={0} width={ancho} height={alto} preserveAspectRatio="none" />
      <path data-capa="curvas-menores" d={dUnion(menores)} fill="none" stroke={tinta} strokeOpacity={0.4} strokeWidth={0.7} vectorEffect="non-scaling-stroke" />
      <path data-capa="curvas-mayores" d={dUnion(mayores)} fill="none" stroke={tinta} strokeOpacity={0.8} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
      <g data-capa="departamentos" fill="none" stroke={hexDe("cuenca.hito")} strokeOpacity={0.85} strokeWidth={0.9}>
        {datos.departamentos.features.map((f) => (
          <path key={String(f.properties.codigo ?? nombreDepartamento(f))} data-departamento={nombreDepartamento(f)} d={trazo(bordesDe(f), true)} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
      {datos.provincia.features.map((f, i) => (
        <path key={i} data-capa="provincia" d={trazo(bordesDe(f), true)} fill="none" stroke={hexDe("cuenca.hitoTexto")} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      ))}
      {datos.rio.features.map((f) => (
        <path
          key={String(f.properties.id)}
          data-capa="rio"
          d={trazo(lineasDe(f))}
          fill="none"
          stroke={hexDe(f.properties.rol === "principal" ? "cuenca.rioPrincipal" : "cuenca.afluente")}
          strokeWidth={f.properties.rol === "principal" ? 3 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {datos.departamentos.features.map((f) => {
        const [x, y] = aSvg(centroide(f));
        return (
          <text
            key={`n-${String(f.properties.codigo)}`}
            data-etiqueta-escena=""
            data-rotulo-departamento={nombreDepartamento(f)}
            x={x}
            y={y}
            textAnchor="middle"
            fontSize={22}
            fill={hexDe("pizarra.50")}
            stroke={tinta}
            strokeWidth={4}
            paintOrder="stroke"
            fontFamily="inherit"
          >
            {nombreDepartamento(f)}
          </text>
        );
      })}
      {HITOS_RELIEVE.map((h) => {
        const [x, y] = aSvg([h.lon, h.lat]);
        return (
          <g key={h.id}>
            <circle cx={x} cy={y} r={h.principal ? 10 : 6} fill={h.principal ? hexDe("cuenca.hitoPrincipal") : hexDe("cuenca.hito")} stroke={tinta} strokeWidth={2} />
            <text
              data-etiqueta-escena=""
              x={x + 14}
              y={y + 5}
              fill={h.principal ? hexDe("cuenca.hitoTexto") : hexDe("cuenca.hito")}
              stroke={tinta}
              strokeWidth={4}
              paintOrder="stroke"
              fontSize={h.principal ? 26 : 22}
              fontWeight={h.principal ? 700 : 500}
              fontFamily="inherit"
            >
              {h.nombre}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Esquema ilustrativo (cursos digitalizados a mano): solo si no se pudieron cargar los datos de relieve. */
function CuencaEsquemaSVG({ cursos }: { cursos: Curso[] }) {
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
          stroke={c.id === "paraguay" ? hexDe("cuenca.rioPrincipal") : hexDe("cuenca.afluente")}
          strokeWidth={c.id === "paraguay" ? 7 : 5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {HITOS.map((h) => {
        const [x, y] = aSvg(proyectar(h.lon, h.lat));
        return (
          <g key={h.id}>
            <circle cx={x} cy={y} r={h.principal ? 10 : 6} fill={h.principal ? hexDe("cuenca.hitoPrincipal") : hexDe("cuenca.hito")} />
            <text
              data-etiqueta-escena=""
              x={x + 14}
              y={y + 5}
              fill={h.principal ? hexDe("cuenca.hitoTexto") : hexDe("cuenca.hito")}
              fontSize={h.principal ? 22 : 18}
              fontWeight={h.principal ? 700 : 500}
              fontFamily="inherit"
            >
              {h.nombre}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
