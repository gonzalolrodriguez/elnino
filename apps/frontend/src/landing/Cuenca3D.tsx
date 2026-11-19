import { Html, Line, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { hexDe } from "../estilo/paleta";
import {
  bordesDe,
  cargarMalla,
  centroide,
  elevEn,
  EXAGERACION_VERTICAL,
  lineasDe,
  nombreDepartamento,
  urlRelieve,
  type DatosRelieve,
  type LonLat,
  type Malla,
} from "../relieve/datos";
import { HITOS_RELIEVE, limitesDeBbox, proyectar } from "./geometria";

/**
 * Escena 3D de la cuenca: el agua baja desde Mato Grosso y el Pantanal por el río Paraguay hasta Puerto Formosa y
 * la confluencia con el Paraná, sobre el relieve real (DEM) con sus curvas de nivel.
 *
 * Todo el movimiento sale de refs dentro de `useFrame` (ningún estado de React por cuadro):
 *  - la cámara sigue una spline Catmull-Rom (objetivo) con una trayectoria de órbita (ángulo, altura, distancia)
 *    y suavizado exponencial independiente de los cuadros por segundo;
 *  - el agua es una cinta con shader (estrías que fluyen, frente luminoso y brillo suave en los bordes);
 *  - los rótulos aparecen cuando el frente del agua pasa por cada hito.
 */

// Colores en RGB para WebGL, resueltos desde los tokens semánticos del sistema visual.
const C = {
  fondo: hexDe("oscuro.bg"),
  tinta: hexDe("limo.950"),
  agua: hexDe("rio.400"),
  aguaClara: hexDe("agua.100"),
  orilla: hexDe("limo.800"),
  departamento: hexDe("pizarra.50"),
  provincia: hexDe("pizarra.50"),
  hito: hexDe("pizarra.50"),
};

const FUENTE_HTML = "'Atkinson Hyperlegible Next Variable', 'Segoe UI', system-ui, sans-serif";
const ESCALA = 0.01; // 1 unidad = 100 km en horizontal
const K_VERT = EXAGERACION_VERTICAL * 1e-5; // unidades por metro de elevación, con la exageración vertical
const DURACION_S = 13;
const ANCHO_LG = 992; // px: desde aquí el hero pone el texto a la izquierda
const SUBMUESTREO = 2; // la malla del DEM se interpola (bicúbica) al doble para sombrear sin facetas

/**
 * Parámetros de revisión visual (no afectan al uso normal):
 *  ?escena=final  salta al encuadre final con la deriva en reposo
 *  ?escena=0.4    congela la animación en el 40 % del recorrido
 */
const PARAMS = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
const ESCENA_PARAM = PARAMS.get("escena");
const P_FIJO = ESCENA_PARAM === "final" ? 1 : ESCENA_PARAM !== null && !Number.isNaN(Number(ESCENA_PARAM)) ? Math.min(1, Math.max(0, Number(ESCENA_PARAM))) : null;

// Encuadre final: punto al que mira la cámara (centro de Formosa) y trayectoria de la cámara.
const FINAL = { lon: -59.7, lat: -25.4 };
const DESPLAZAMIENTO_X = 0.07; // fracción del ancho que se corre la escena a la derecha (deja libre el texto)
const DESPLAZAMIENTO_Y = 0.02;
// Claves de la órbita (ángulo en rad desde el sur hacia el este, altura y distancia en unidades de escena).
const ORBITA = [
  new THREE.Vector3(3.6, 2.1, 3.4),
  new THREE.Vector3(2.7, 1.7, 2.7),
  new THREE.Vector3(1.4, 2.3, 3.4),
  new THREE.Vector3(0.85, 4.6, 4.6),
];

const lerp = THREE.MathUtils.lerp;
const suave = THREE.MathUtils.smoothstep;
const masSuave = THREE.MathUtils.smootherstep;
const amortiguar = (dt: number, k: number) => 1 - Math.exp(-dt * k);

type Proy = {
  /** Posición en la escena de un lon/lat con su elevación real en metros (sobre el mínimo del área). */
  aEscena: (lon: number, lat: number, elevM: number, lev?: number) => THREE.Vector3;
};

function crearProy(datos: DatosRelieve, minM: number): Proy {
  const l = limitesDeBbox(datos.meta.cuenca.bbox);
  const cx = (l.xMin + l.xMax) / 2;
  const cy = (l.yMin + l.yMax) / 2;
  return {
    aEscena: (lon, lat, elevM, lev = 0) => {
      const [x, y] = proyectar(lon, lat);
      return new THREE.Vector3((x - cx) * ESCALA, (elevM - minM) * K_VERT + lev, -(y - cy) * ESCALA);
    },
  };
}

// ----------------------------------------------------------------------------- terreno

const cr = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

/** Elevación interpolada con Catmull-Rom bicúbica sobre la malla del DEM (índices fraccionarios). */
function bicubica(m: Malla, fx: number, fy: number): number {
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const px = (x: number) => Math.min(m.nx - 1, Math.max(0, x));
  const py = (y: number) => Math.min(m.ny - 1, Math.max(0, y));
  const fila = (j: number) => {
    const o = py(j) * m.nx;
    return cr(m.z[o + px(x0 - 1)], m.z[o + px(x0)], m.z[o + px(x0 + 1)], m.z[o + px(x0 + 2)], tx);
  };
  return cr(fila(y0 - 1), fila(y0), fila(y0 + 1), fila(y0 + 2), ty);
}

function Terreno({ malla, proy }: { malla: Malla; proy: Proy }) {
  const textura = useLoader(THREE.TextureLoader, urlRelieve("tinte_cuenca.png"));
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 8;
  const geom = useMemo(() => {
    const { bbox } = malla;
    const nx = (malla.nx - 1) * SUBMUESTREO + 1;
    const ny = (malla.ny - 1) * SUBMUESTREO + 1;
    const pos = new Float32Array(nx * ny * 3);
    const uv = new Float32Array(nx * ny * 2);
    for (let i = 0; i < ny; i++) {
      const fy = (i / (ny - 1)) * (malla.ny - 1);
      for (let j = 0; j < nx; j++) {
        const fx = (j / (nx - 1)) * (malla.nx - 1);
        const k = i * nx + j;
        const lon = bbox[0] + ((bbox[2] - bbox[0]) * j) / (nx - 1);
        const lat = bbox[3] - ((bbox[3] - bbox[1]) * i) / (ny - 1);
        const p = proy.aEscena(lon, lat, bicubica(malla, fx, fy));
        pos[k * 3] = p.x;
        pos[k * 3 + 1] = p.y;
        pos[k * 3 + 2] = p.z;
        uv[k * 2] = j / (nx - 1);
        uv[k * 2 + 1] = 1 - i / (ny - 1);
      }
    }
    const idx = new Uint32Array((nx - 1) * (ny - 1) * 6);
    let t = 0;
    for (let i = 0; i < ny - 1; i++) {
      for (let j = 0; j < nx - 1; j++) {
        const a = i * nx + j;
        const b = a + 1;
        const c = a + nx;
        const d = c + 1;
        idx[t++] = a;
        idx[t++] = c;
        idx[t++] = b;
        idx[t++] = b;
        idx[t++] = c;
        idx[t++] = d;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    return g;
  }, [malla, proy]);

  // Los bordes del modelo se desvanecen hacia el fondo (sin cortes secos) y el relieve recibe luz suave.
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: textura, roughness: 0.96, metalness: 0, transparent: true });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vBorde;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvBorde = uv;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vBorde;")
        .replace(
          "#include <opaque_fragment>",
          // Distancia al borde del modelo en km aproximados (ancho ~880 km, alto ~1530 km).
          "float dBorde = min(min(vBorde.x, 1.0 - vBorde.x) * 880.0, min(vBorde.y, 1.0 - vBorde.y) * 1530.0);\ndiffuseColor.a *= smoothstep(0.0, 140.0, dBorde);\n#include <opaque_fragment>",
        );
    };
    return m;
  }, [textura]);

  return <mesh geometry={geom} material={material} renderOrder={-1} />;
}

function Curvas({ datos, proy }: { datos: DatosRelieve; proy: Proy }) {
  const { menores, mayores } = useMemo(() => {
    const acumular = (maestra: boolean) => {
      const v: number[] = [];
      for (const f of datos.curvas.features) {
        if (Boolean(f.properties.maestra) !== maestra) continue;
        const e = Number(f.properties.elev_m);
        for (const ln of lineasDe(f)) {
          for (let i = 0; i < ln.length - 1; i++) {
            const a = proy.aEscena(ln[i][0], ln[i][1], e, 0.004);
            const b = proy.aEscena(ln[i + 1][0], ln[i + 1][1], e, 0.004);
            v.push(a.x, a.y, a.z, b.x, b.y, b.z);
          }
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(v), 3));
      return g;
    };
    return { menores: acumular(false), mayores: acumular(true) };
  }, [datos, proy]);
  return (
    <>
      <lineSegments geometry={menores} renderOrder={1}>
        <lineBasicMaterial color={C.tinta} transparent opacity={0.2} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={mayores} renderOrder={1}>
        <lineBasicMaterial color={C.tinta} transparent opacity={0.45} depthWrite={false} />
      </lineSegments>
    </>
  );
}

function Limites({ datos, malla, proy, rotular }: { datos: DatosRelieve; malla: Malla; proy: Proy; rotular: boolean }) {
  const sobre = (ln: LonLat[], lev: number) => ln.map(([lon, lat]) => proy.aEscena(lon, lat, elevEn(malla, lon, lat), lev));
  const prov = useMemo(() => datos.provincia.features.flatMap((f) => bordesDe(f).map((ln) => sobre(ln, 0.012))), [datos, malla, proy]); // eslint-disable-line react-hooks/exhaustive-deps
  const deps = useMemo(
    () =>
      datos.departamentos.features.map((f) => ({
        nombre: nombreDepartamento(f),
        lineas: bordesDe(f).map((ln) => sobre(ln, 0.01)),
        centro: (() => {
          const [lon, lat] = centroide(f);
          return proy.aEscena(lon, lat, elevEn(malla, lon, lat), 0.03);
        })(),
      })),
    [datos, malla, proy], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return (
    <>
      {prov.map((pts, i) => (
        <Line key={`p${i}`} points={pts} color={C.provincia} lineWidth={1.6} transparent opacity={0.7} depthTest={false} renderOrder={6} />
      ))}
      {deps.flatMap((d) =>
        d.lineas.map((pts, i) => (
          <Line key={`${d.nombre}-${i}`} points={pts} color={C.departamento} lineWidth={0.8} transparent opacity={0.28} depthTest={false} renderOrder={4} />
        )),
      )}
      {rotular &&
        deps.map((d) => (
          <Html key={d.nombre} position={d.centro} center style={{ pointerEvents: "none" }} zIndexRange={[1, 0]}>
            <div
              data-etiqueta-escena=""
              data-etiqueta-departamento=""
              data-rotulo-departamento={d.nombre}
              style={{
                font: `600 10.5px ${FUENTE_HTML}`,
                color: "rgba(246,248,251,0.78)",
                textShadow: "0 1px 3px rgba(9,19,31,0.9), 0 0 8px rgba(9,19,31,0.7)",
                whiteSpace: "nowrap",
                letterSpacing: "0.02em",
                animation: "aparecer-rotulo 700ms var(--ease-out) both",
              }}
            >
              {d.nombre}
            </div>
          </Html>
        ))}
    </>
  );
}

// ------------------------------------------------------------------------------- agua

const VERT_AGUA = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Cinta del río: v cruza el cauce (0 a 1), u corre a lo largo (0 a 1). Detrás del frente el agua fluye; delante, el cauce se ve tenue.
const FRAG_AGUA = /* glsl */ `
  uniform float uTiempo;
  uniform float uFrente;
  uniform float uLargo;
  uniform float uBrillo;
  uniform vec3 uColor;
  uniform vec3 uClaro;
  uniform vec3 uOrilla;
  varying vec2 vUv;

  float estria(float x, float v, float vel, float freq) {
    float f = sin((x * freq - uTiempo * vel) * 6.2831853 + v * 2.2);
    return smoothstep(0.35, 1.0, f * 0.5 + 0.5);
  }

  void main() {
    float cruce = abs(vUv.y * 2.0 - 1.0);
    float cuerpo = 1.0 - smoothstep(0.55, 1.0, cruce);
    float llego = 1.0 - smoothstep(uFrente - 0.02, uFrente, vUv.x);
    float x = vUv.x * uLargo;
    float flujo = estria(x, vUv.y, 0.5, 0.9) * 0.6 + estria(x, vUv.y * 1.7, 0.85, 2.3) * 0.4;
    flujo *= 1.0 - cruce * 0.6;
    vec3 col = mix(uOrilla, uColor, smoothstep(1.0, 0.45, cruce));
    col = mix(col, uClaro, flujo * 0.75 * llego);
    float cabeza = exp(-pow((vUv.x - uFrente) / 0.012, 2.0)) * (1.0 - cruce * 0.5);
    col += uClaro * cabeza * 0.9;
    float alfa = cuerpo * mix(0.28, 0.96, llego) + cabeza * 0.5 * cuerpo;
    gl_FragColor = vec4(col * uBrillo, alfa);
    #include <colorspace_fragment>
  }
`;

const FRAG_HALO = /* glsl */ `
  uniform float uFrente;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float cruce = abs(vUv.y * 2.0 - 1.0);
    float llego = 1.0 - smoothstep(uFrente - 0.03, uFrente, vUv.x);
    float cabeza = exp(-pow((vUv.x - uFrente) / 0.03, 2.0));
    float a = (1.0 - cruce) * (1.0 - cruce) * (0.16 * llego + 0.5 * cabeza);
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }
`;

type Rio = { id: string; principal: boolean; curva: THREE.CatmullRomCurve3; largo: number };

/** Cinta que sigue la curva del río (apoyada sobre el relieve), con u = fracción de recorrido y v = ancho. */
function geometriaCinta(curva: THREE.Curve<THREE.Vector3>, ancho: number, muestras: number) {
  const pos = new Float32Array(muestras * 2 * 3);
  const uv = new Float32Array(muestras * 2 * 2);
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  const lado = new THREE.Vector3();
  for (let i = 0; i < muestras; i++) {
    const u = i / (muestras - 1);
    curva.getPointAt(u, p);
    curva.getTangentAt(u, t);
    lado.set(-t.z, 0, t.x).normalize().multiplyScalar(ancho / 2);
    pos.set([p.x - lado.x, p.y, p.z - lado.z, p.x + lado.x, p.y, p.z + lado.z], i * 6);
    uv.set([u, 0, u, 1], i * 4);
    if (i < muestras - 1) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function Agua({ rio, frente }: { rio: Rio; frente: React.MutableRefObject<number> }) {
  const ancho = rio.principal ? 0.05 : 0.028;
  const { cinta, halo, matCinta, matHalo } = useMemo(() => {
    const n = Math.max(200, Math.min(900, Math.round(rio.largo * 160)));
    const cinta = geometriaCinta(rio.curva, ancho, n);
    const halo = geometriaCinta(rio.curva, ancho * 3.4, n);
    const matCinta = new THREE.ShaderMaterial({
      vertexShader: VERT_AGUA,
      fragmentShader: FRAG_AGUA,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      uniforms: {
        uTiempo: { value: 0 },
        uFrente: { value: 0 },
        uLargo: { value: rio.largo * 6 },
        uBrillo: { value: rio.principal ? 1.12 : 1 },
        uColor: { value: new THREE.Color(C.agua) },
        uClaro: { value: new THREE.Color(C.aguaClara) },
        uOrilla: { value: new THREE.Color(C.orilla) },
      },
    });
    const matHalo = new THREE.ShaderMaterial({
      vertexShader: VERT_AGUA,
      fragmentShader: FRAG_HALO,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uFrente: { value: 0 }, uColor: { value: new THREE.Color(C.agua) } },
    });
    return { cinta, halo, matCinta, matHalo };
  }, [rio, ancho]);

  useFrame(({ clock }) => {
    matCinta.uniforms.uTiempo.value = clock.elapsedTime;
    matCinta.uniforms.uFrente.value = frente.current;
    matHalo.uniforms.uFrente.value = frente.current;
  });

  useEffect(
    () => () => {
      cinta.dispose();
      halo.dispose();
      matCinta.dispose();
      matHalo.dispose();
    },
    [cinta, halo, matCinta, matHalo],
  );

  return (
    <>
      <mesh geometry={halo} material={matHalo} renderOrder={2} frustumCulled={false} />
      <mesh geometry={cinta} material={matCinta} renderOrder={3} frustumCulled={false} />
    </>
  );
}

// ------------------------------------------------------------------------------ hitos

type DatosHito = { id: string; nombre: string; posicion: THREE.Vector3; u: number; principal: boolean; lado: "izq" | "der" | "der-abajo" };

const LADO_HITO: Record<string, DatosHito["lado"]> = { asuncion: "izq", pilcomayo: "der-abajo", pantanal: "izq", matogrosso: "der", confluencia: "der", formosa: "der" };
const TRANSFORM_LADO: Record<DatosHito["lado"], string> = {
  izq: "translate(calc(-100% - 12px), -50%)",
  der: "translate(12px, -50%)",
  "der-abajo": "translate(12px, 12%)",
};

function Hito({ h, frente }: { h: DatosHito; frente: React.MutableRefObject<number> }) {
  const punto = useRef<THREE.Mesh>(null);
  const anillo = useRef<THREE.Mesh>(null);
  const rotulo = useRef<HTMLDivElement>(null);
  useFrame(({ clock }) => {
    const r = suave(frente.current, h.u - 0.004, h.u + 0.012);
    if (rotulo.current) {
      rotulo.current.style.opacity = r.toFixed(3);
      rotulo.current.style.transform = `${TRANSFORM_LADO[h.lado]} translateY(${((1 - r) * 6).toFixed(1)}px)`;
    }
    if (punto.current) punto.current.scale.setScalar(Math.max(0.001, r));
    if (anillo.current) {
      const f = (clock.elapsedTime * 0.5) % 1;
      anillo.current.scale.setScalar((1 + f * 2.4) * r + 0.001);
      (anillo.current.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - f) * r;
    }
  });
  const radio = h.principal ? 0.04 : 0.024;
  return (
    <group position={h.posicion}>
      <mesh ref={punto} position={[0, 0.03, 0]}>
        <sphereGeometry args={[radio, 20, 20]} />
        <meshBasicMaterial color={C.hito} toneMapped={false} />
      </mesh>
      <mesh ref={anillo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.055, 0.068, 48]} />
        <meshBasicMaterial color={C.hito} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <Html position={[0, 0.04, 0]} style={{ pointerEvents: "none" }} zIndexRange={[2, 0]}>
        <div
          ref={rotulo}
          data-etiqueta-escena=""
          data-etiqueta-hito={h.id}
          style={{
            font: `${h.principal ? 700 : 600} ${h.principal ? 13.5 : 12}px ${FUENTE_HTML}`,
            color: h.principal ? "#0E1B2C" : "#F6F8FB",
            background: h.principal ? "rgba(246,248,251,0.96)" : "rgba(14,27,44,0.72)",
            padding: h.principal ? "4px 11px" : "3px 9px",
            borderRadius: 999,
            border: h.principal ? "none" : "1px solid rgba(246,248,251,0.16)",
            whiteSpace: "nowrap",
            opacity: 0,
            willChange: "opacity, transform",
          }}
        >
          {h.nombre}
        </div>
      </Html>
    </group>
  );
}

// ------------------------------------------------------------------------------ cámara

/** Corre la escena a la derecha en pantallas anchas para que el texto y el panel no tapen la zona de interés. */
function Encuadre() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (size.width >= ANCHO_LG) cam.setViewOffset(size.width, size.height, -size.width * DESPLAZAMIENTO_X, size.height * DESPLAZAMIENTO_Y, size.width, size.height);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

function Escena({ datos, malla, alListo, alTerminar }: { datos: DatosRelieve; malla: Malla; alListo: () => void; alTerminar: () => void }) {
  const proy = useMemo(() => crearProy(datos, malla.min), [datos, malla]);
  const { camera, scene, pointer } = useThree();
  const [terminado, setTerminado] = useState(false);

  const rios: Rio[] = useMemo(
    () =>
      datos.rio.features.map((f) => {
        const ln = lineasDe(f).sort((a, b) => b.length - a.length)[0];
        const pts = ln.map(([lon, lat]) => proy.aEscena(lon, lat, elevEn(malla, lon, lat), 0.012));
        const curva = new THREE.CatmullRomCurve3(pts, false, "centripetal");
        curva.arcLengthDivisions = 3000;
        return { id: String(f.properties.id), principal: f.properties.rol === "principal", curva, largo: curva.getLength() };
      }),
    [datos, malla, proy],
  );
  const paraguay = rios.find((r) => r.principal) ?? rios[0];

  const hitos: DatosHito[] = useMemo(
    () =>
      HITOS_RELIEVE.map((h) => {
        const pos = proy.aEscena(h.lon, h.lat, elevEn(malla, h.lon, h.lat), 0.02);
        let mejor = 0;
        let dMin = Infinity;
        for (let i = 0; i <= 1000; i++) {
          const p = paraguay.curva.getPointAt(i / 1000);
          const d = Math.hypot(p.x - pos.x, p.z - pos.z);
          if (d < dMin) {
            dMin = d;
            mejor = i / 1000;
          }
        }
        return { id: h.id, nombre: h.nombre, posicion: pos, u: h.id === "matogrosso" ? 0 : mejor, principal: Boolean(h.principal), lado: LADO_HITO[h.id] ?? "der" };
      }),
    [proy, malla, paraguay],
  );
  const uFormosa = hitos.find((h) => h.id === "formosa")?.u ?? 0.8;

  // Trayectoria del objetivo: spline Catmull-Rom por puntos del río hasta Puerto Formosa y de ahí al encuadre final.
  const trayecto = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const N = 8;
    for (let k = 0; k <= N; k++) pts.push(paraguay.curva.getPointAt(uFormosa * (0.035 + (0.965 * k) / N)).clone());
    const formosa = pts[pts.length - 1];
    const destino = proy.aEscena(FINAL.lon, FINAL.lat, elevEn(malla, FINAL.lon, FINAL.lat));
    pts.push(formosa.clone().lerp(destino, 0.55).setY(lerp(formosa.y, destino.y, 0.4)), destino);
    const curva = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    curva.arcLengthDivisions = 2000;
    // Fracción del trayecto (por longitud) en que se llega a Puerto Formosa.
    const aFormosa = new THREE.CatmullRomCurve3(pts.slice(0, N + 1), false, "centripetal").getLength() / curva.getLength();
    return { curva, aFormosa: Math.min(0.95, aFormosa), destino };
  }, [paraguay, uFormosa, proy, malla]);
  const orbita = useMemo(() => new THREE.CatmullRomCurve3(ORBITA, false, "catmullrom", 0.5), []);

  const frente = useRef(0);
  const tiempo = useRef(0);
  const inactivo = useRef(0);
  const iniciado = useRef(false);
  const fin = useRef(false);
  const objetivo = useRef(new THREE.Vector3());
  const posicion = useRef(new THREE.Vector3());
  const tmp = useMemo(() => ({ t: new THREE.Vector3(), o: new THREE.Vector3(), d: new THREE.Vector3() }), []);

  useEffect(() => {
    scene.background = new THREE.Color(C.fondo);
    scene.fog = new THREE.Fog(C.fondo, 6.5, 19);
    return () => {
      scene.fog = null;
      scene.background = null;
    };
  }, [scene]);

  useFrame((_, dtReal) => {
    const dt = Math.min(dtReal, 0.05); // un cuadro largo (pestaña en segundo plano) no hace saltar la cámara
    if (P_FIJO === null) tiempo.current += dt;
    const p = P_FIJO ?? Math.min(1, tiempo.current / DURACION_S);
    const a = masSuave(p, 0, 1); // arranque y llegada suaves; velocidad máxima a mitad de recorrido

    // Objetivo sobre la spline y avance del frente del agua (llega a Formosa con la cámara y sigue hasta el Paraná).
    trayecto.curva.getPointAt(a, tmp.t);
    const aF = trayecto.aFormosa;
    frente.current = a <= aF ? uFormosa * (a / aF) : lerp(uFormosa, 1.02, masSuave((a - aF) / (1 - aF), 0, 1));

    // Órbita: ángulo, altura y distancia (con deriva muy lenta en reposo y paralaje del puntero).
    orbita.getPoint(a, tmp.o);
    let [ang, alt, dist] = [tmp.o.x, tmp.o.y, tmp.o.z];
    const reposo = p >= 1;
    if (reposo) {
      inactivo.current += dt;
      const w = masSuave(inactivo.current / 4, 0, 1);
      ang += Math.sin(inactivo.current * 0.085) * 0.16 * w;
      alt += Math.sin(inactivo.current * 0.12 + 1) * 0.12 * w;
      dist += Math.cos(inactivo.current * 0.07) * 0.1 * w;
    }
    const dx = Math.sin(ang) * dist;
    const dz = Math.cos(ang) * dist;
    const deseada = tmp.d.copy(tmp.t);
    deseada.x += dx + pointer.x * 0.22;
    deseada.y += alt + pointer.y * 0.1;
    deseada.z += dz;

    if (!iniciado.current) {
      objetivo.current.copy(tmp.t);
      posicion.current.copy(deseada);
      iniciado.current = true;
      alListo();
    } else {
      const k = amortiguar(dt, 7);
      objetivo.current.lerp(tmp.t, k);
      posicion.current.lerp(deseada, k);
    }
    camera.position.copy(posicion.current);
    camera.lookAt(objetivo.current);

    if (reposo && !fin.current) {
      fin.current = true;
      setTerminado(true);
      alTerminar();
    }
  });

  return (
    <>
      <Encuadre />
      <hemisphereLight args={["#B7CDE8", "#1B2B40", 1.05]} />
      <directionalLight position={[-7, 4.5, -5]} intensity={2.3} color="#FFF3E0" />
      <Terreno malla={malla} proy={proy} />
      <Curvas datos={datos} proy={proy} />
      <Limites datos={datos} malla={malla} proy={proy} rotular={terminado} />
      {rios.map((r) => (
        <Agua key={r.id} rio={r} frente={frente} />
      ))}
      {hitos.map((h) => (
        <Hito key={h.id} h={h} frente={frente} />
      ))}
    </>
  );
}

export default function Cuenca3D({ datos, onTerminar }: { datos: DatosRelieve; onTerminar?: () => void }) {
  const [malla, setMalla] = useState<Malla | null>(null);
  const [listo, setListo] = useState(false);
  const [calidad, setCalidad] = useState(2);
  const [visible, setVisible] = useState(true);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let activo = true;
    cargarMalla()
      .then((m) => activo && setMalla(m))
      .catch(() => undefined);
    return () => {
      activo = false;
    };
  }, []);

  // Fuera de pantalla (el usuario bajó por la página) se detiene el dibujo para no gastar batería.
  useEffect(() => {
    const el = raiz.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={raiz} role="img" aria-label="Escena 3D del relieve de la cuenca: el agua baja por el río Paraguay desde Mato Grosso y el Pantanal hasta Puerto Formosa y la confluencia con el Paraná" style={{ position: "absolute", inset: 0, opacity: listo ? 1 : 0, transition: "opacity 900ms cubic-bezier(0.23, 1, 0.32, 1)" }}>
      {malla && (
        <Canvas
          dpr={[1, calidad]}
          frameloop={visible ? "always" : "never"}
          camera={{ fov: 38, near: 0.1, far: 60, position: [0, 4, 6] }}
          gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
        >
          <PerformanceMonitor onDecline={() => setCalidad(1)} flipflops={2} />
          <Escena datos={datos} malla={malla} alListo={() => setListo(true)} alTerminar={() => onTerminar?.()} />
        </Canvas>
      )}
    </div>
  );
}
