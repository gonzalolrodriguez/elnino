import { Html, Line, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";

import { SECTORES_K10 } from "../datos/kit";
import { ESTADOS } from "../estilo/estados";
import { hexDe } from "../estilo/paleta";
import { elevEn } from "../relieve/datos";
import {
  calcularAgua,
  coloresTerrazas,
  estadoSector,
  EXAGERACION_INUNDACION,
  INTERVALO_TERRAZA_M,
  latDe,
  lonDe,
} from "./inundacion";
import type { DatosInundacion } from "./useInundacion";

/**
 * Escena 3D de la inundación de los sectores K10: relieve real (DEM z14) con terrazas de color y curvas cada 1 m de
 * elevación, exagerado en vertical; el agua de cada sector llena las celdas más bajas primero. Unidad de la escena: 1 km.
 * El momento de compromiso lo da K10 (SIMULADO); el relieve solo ordena dónde avanza el agua. No es un modelo hidráulico.
 */

const FUENTE_HTML = "'Atkinson Hyperlegible Next Variable', 'Segoe UI', system-ui, sans-serif";
const KM_LON = 111.32 * Math.cos((-26.19 * Math.PI) / 180);
const KM_LAT = 110.57;
const K_VERT = EXAGERACION_INUNDACION / 1000; // km de escena por metro de elevación
const MAX_BANDAS = 40;
const GROSOR_VISUAL_M = 0.5; // grosor máximo (m, ya exagerado) de la película de agua dibujada

export type ControlVista = { acercar: () => void; alejar: () => void; girar: (rad: number) => void; restablecer: () => void };

const VISTA_INICIAL = { pos: new THREE.Vector3(0, 7.4, 10.2), objetivo: new THREE.Vector3(0, 0.15, 0.2) };

type Geo = {
  terreno: THREE.BufferGeometry;
  agua: THREE.BufferGeometry;
  falda: THREE.BufferGeometry;
  zmin: number;
  zmax: number;
  xDe: (lon: number) => number;
  zDe: (lat: number) => number;
  yDe: (elev: number) => number;
};

function construir(datos: DatosInundacion): Geo {
  const { malla } = datos;
  const { nx, ny, z } = malla;
  const lonC = (malla.bbox[0] + malla.bbox[2]) / 2;
  const latC = (malla.bbox[1] + malla.bbox[3]) / 2;
  const zmin = Math.floor(malla.min / INTERVALO_TERRAZA_M) * INTERVALO_TERRAZA_M;
  const zmax = malla.max;
  const xDe = (lon: number) => (lon - lonC) * KM_LON;
  const zDe = (lat: number) => -(lat - latC) * KM_LAT;
  const yDe = (e: number) => (e - zmin) * K_VERT;

  const pos = new Float32Array(nx * ny * 3);
  const elev = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      pos[k * 3] = xDe(lonDe(malla, i));
      pos[k * 3 + 1] = yDe(z[k]);
      pos[k * 3 + 2] = zDe(latDe(malla, j));
      elev[k] = z[k];
    }
  }
  const idx = new Uint32Array((nx - 1) * (ny - 1) * 6);
  let q = 0;
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      idx.set([a, c, b, b, c, d], q);
      q += 6;
    }
  }
  const terreno = new THREE.BufferGeometry();
  terreno.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  terreno.setAttribute("aElev", new THREE.BufferAttribute(elev, 1));
  terreno.setIndex(new THREE.BufferAttribute(idx, 1));
  terreno.computeBoundingSphere();

  const agua = new THREE.BufferGeometry();
  agua.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3).setUsage(THREE.DynamicDrawUsage));
  agua.setAttribute("aProf", new THREE.BufferAttribute(new Float32Array(nx * ny), 1).setUsage(THREE.DynamicDrawUsage));
  agua.setIndex(new THREE.BufferAttribute(idx, 1));
  agua.boundingSphere = terreno.boundingSphere;

  // Falda: cuatro paredes hasta el plano base, para que el bloque no se vea hueco.
  const base = -0.12;
  const borde: number[][] = [];
  for (let i = 0; i < nx; i++) borde.push([0, i]);
  for (let j = 1; j < ny; j++) borde.push([j, nx - 1]);
  for (let i = nx - 2; i >= 0; i--) borde.push([ny - 1, i]);
  for (let j = ny - 2; j >= 1; j--) borde.push([j, 0]);
  const fp: number[] = [];
  const fi: number[] = [];
  borde.forEach(([j, i], n) => {
    const k = j * nx + i;
    fp.push(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2], pos[k * 3], base, pos[k * 3 + 2]);
    const s = n * 2;
    const t = ((n + 1) % borde.length) * 2;
    fi.push(s, s + 1, t, t, s + 1, t + 1);
  });
  const falda = new THREE.BufferGeometry();
  falda.setAttribute("position", new THREE.Float32BufferAttribute(fp, 3));
  falda.setIndex(fi);
  return { terreno, agua, falda, zmin, zmax, xDe, zDe, yDe };
}

const VERT_TERRENO = /* glsl */ `
attribute float aElev;
varying float vElev;
varying vec3 vPos;
void main() {
  vElev = aElev;
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG_TERRENO = /* glsl */ `
precision highp float;
uniform vec3 uRampa[${MAX_BANDAS}];
uniform float uBase;
uniform float uInt;
uniform float uN;
varying float vElev;
varying vec3 vPos;
void main() {
  float b = clamp(floor(vElev / uInt) - uBase, 0.0, uN - 1.0);
  vec3 c = uRampa[int(b)];
  vec3 n = normalize(cross(dFdx(vPos), dFdy(vPos)));
  if (n.y < 0.0) n = -n;
  float luz = dot(n, normalize(vec3(-0.45, 0.8, -0.4)));
  c *= 0.74 + 0.34 * max(luz, 0.0);
  float e = vElev / uInt;
  float ancho = max(fwidth(e), 1e-4);
  float linea = 1.0 - clamp(abs(fract(e - 0.5) - 0.5) / (ancho * 1.1), 0.0, 1.0);
  c = mix(c, c * 0.5, linea * 0.65);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

const VERT_AGUA = /* glsl */ `
attribute float aProf;
varying float vProf;
varying vec3 vPos;
void main() {
  vProf = aProf;
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG_AGUA = /* glsl */ `
precision highp float;
uniform float uTiempo;
uniform vec3 uSomera;
uniform vec3 uHonda;
varying float vProf;
varying vec3 vPos;
void main() {
  float a = smoothstep(0.0, 0.3, vProf);
  if (a < 0.02) discard;
  vec3 col = mix(uSomera, uHonda, smoothstep(0.0, 2.5, vProf));
  float onda = sin(vPos.x * 11.0 + uTiempo * 1.1) * sin(vPos.z * 9.0 - uTiempo * 0.9);
  col += onda * 0.02;
  float orilla = 1.0 - smoothstep(0.0, 0.45, vProf);
  col = mix(col, vec3(0.86, 0.95, 1.0), orilla * (0.22 + 0.1 * sin(uTiempo * 1.6 + vPos.x * 55.0)));
  gl_FragColor = vec4(col, a * 0.84);
  #include <colorspace_fragment>
}`;

function Terreno({ datos, geo, altura }: { datos: DatosInundacion; geo: Geo; altura: MutableRefObject<number> }) {
  const { malla } = datos;
  const mostrada = useRef(altura.current);
  const aplicada = useRef(Number.NaN);
  const buffer = useRef(new Float32Array(malla.nx * malla.ny));

  const tabla = useMemo(() => coloresTerrazas(geo.zmin, geo.zmax), [geo.zmin, geo.zmax]);
  const matTerreno = useMemo(() => {
    const rampa = Array.from({ length: MAX_BANDAS }, (_, k) => new THREE.Color(tabla.colores[Math.min(k, tabla.colores.length - 1)]));
    return new THREE.ShaderMaterial({
      vertexShader: VERT_TERRENO,
      fragmentShader: FRAG_TERRENO,
      uniforms: { uRampa: { value: rampa }, uBase: { value: tabla.base }, uInt: { value: INTERVALO_TERRAZA_M }, uN: { value: Math.min(tabla.colores.length, MAX_BANDAS) } },
    });
  }, [tabla]);
  const matAgua = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT_AGUA,
        fragmentShader: FRAG_AGUA,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        uniforms: { uTiempo: { value: 0 }, uSomera: { value: new THREE.Color(hexDe("rio.300")) }, uHonda: { value: new THREE.Color(hexDe("rio.600")) } },
      }),
    [],
  );
  const matFalda = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(hexDe("limo.500")), side: THREE.DoubleSide }), []);

  useEffect(
    () => () => {
      matTerreno.dispose();
      matAgua.dispose();
      matFalda.dispose();
      geo.terreno.dispose();
      geo.agua.dispose();
      geo.falda.dispose();
    },
    [matTerreno, matAgua, matFalda, geo],
  );

  useFrame((_, dt) => {
    const objetivo = altura.current;
    let h = mostrada.current;
    h += (objetivo - h) * (1 - Math.exp(-Math.min(dt, 0.1) * 7));
    if (Math.abs(objetivo - h) < 0.002) h = objetivo;
    mostrada.current = h;
    matAgua.uniforms.uTiempo.value += dt;
    if (Math.abs(h - aplicada.current) > 1e-4 || Number.isNaN(aplicada.current)) {
      aplicada.current = h;
      const { prof } = calcularAgua(malla, datos.ordenes, h, datos.cauce, buffer.current);
      const pos = geo.agua.getAttribute("position") as THREE.BufferAttribute;
      const dep = geo.agua.getAttribute("aProf") as THREE.BufferAttribute;
      const base = geo.terreno.getAttribute("position") as THREE.BufferAttribute;
      for (let k = 0; k < prof.length; k++) {
        const p = prof[k];
        // Película de agua pegada al terreno (no un bloque plano sobre las laderas); el color da la profundidad relativa. Seco = bajo el terreno.
        pos.setY(k, p > 0 ? base.getY(k) + Math.min(p, GROSOR_VISUAL_M) * K_VERT : base.getY(k) - 0.002);
        dep.setX(k, p);
      }
      pos.needsUpdate = true;
      dep.needsUpdate = true;
    }
  });

  return (
    <group>
      <mesh geometry={geo.terreno} material={matTerreno} frustumCulled={false} />
      <mesh geometry={geo.agua} material={matAgua} frustumCulled={false} renderOrder={2} />
      <mesh geometry={geo.falda} material={matFalda} frustumCulled={false} />
    </group>
  );
}

function Sectores({ datos, geo, altura }: { datos: DatosInundacion; geo: Geo; altura: number }) {
  return (
    <>
      {SECTORES_K10.map((s) => {
        const est = estadoSector(s, altura);
        const st = ESTADOS[est];
        const pts = s.anillo.map(([lo, la]) => new THREE.Vector3(geo.xDe(lo), geo.yDe(elevEn(datos.malla, lo, la)) + 0.03, geo.zDe(la)));
        const lons = s.anillo.map((p) => p[0]);
        const lats = s.anillo.map((p) => p[1]);
        const cLon = (Math.min(...lons) + Math.max(...lons)) / 2;
        const cLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        const ancla = new THREE.Vector3(geo.xDe(cLon), geo.yDe(elevEn(datos.malla, cLon, cLat)) + 0.45, geo.zDe(cLat));
        return (
          <group key={s.id}>
            <Line points={pts} color={st.stroke} lineWidth={est === "comprometido" ? 4 : 2.5} dashed={est === "en_riesgo"} dashSize={0.09} gapSize={0.06} />
            <Html position={ancla} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
              <div
                style={{
                  fontFamily: FUENTE_HTML,
                  fontSize: 12,
                  lineHeight: 1.25,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  background: "rgba(255,255,255,0.92)",
                  color: hexDe("pizarra.900"),
                  border: `2px ${est === "en_riesgo" ? "dashed" : "solid"} ${st.stroke}`,
                  borderRadius: 8,
                  padding: "2px 7px",
                }}
              >
                {s.id} · {st.texto}
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

/** Cámara: vista oblicua inicial, límites de órbita (sin voltear) y controles por botones y teclado. */
const Camara = forwardRef<ControlVista, object>(function Camara(_, ref) {
  const camera = useThree((s) => s.camera);
  const controles = useRef<{ target: THREE.Vector3; update: () => void } | null>(null);
  const aspecto = useThree((s) => s.size.width / Math.max(s.size.height, 1));
  // En pantallas angostas el ancho de la escena manda: se aleja la cámara para encuadrar los cuatro sectores.
  const factor = Math.max(1, Math.pow(1.45 / Math.max(aspecto, 0.3), 0.6));
  // Más cenital en pantallas angostas: la escena es cuadrada y así aprovecha mejor el alto.
  const alto = aspecto < 1 ? 1.35 : 1;
  const inicial = useMemo(() => {
    const v = VISTA_INICIAL.pos.clone().sub(VISTA_INICIAL.objetivo);
    v.y *= alto;
    return VISTA_INICIAL.objetivo.clone().add(v.multiplyScalar(factor));
  }, [factor, alto]);
  useEffect(() => {
    camera.position.copy(inicial);
    camera.lookAt(VISTA_INICIAL.objetivo);
  }, [camera, inicial]);
  useImperativeHandle(
    ref,
    () => ({
      acercar: () => escalar(0.8),
      alejar: () => escalar(1.25),
      girar: (rad) => {
        const c = controles.current;
        if (!c) return;
        const v = camera.position.clone().sub(c.target);
        v.applyAxisAngle(new THREE.Vector3(0, 1, 0), rad);
        camera.position.copy(c.target).add(v);
        c.update();
      },
      restablecer: () => {
        const c = controles.current;
        if (!c) return;
        c.target.copy(VISTA_INICIAL.objetivo);
        camera.position.copy(inicial);
        c.update();
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [camera, inicial],
  );
  function escalar(f: number) {
    const c = controles.current;
    if (!c) return;
    const v = camera.position.clone().sub(c.target);
    const d = Math.min(Math.max(v.length() * f, 4), 34);
    camera.position.copy(c.target).add(v.setLength(d));
    c.update();
  }
  return (
    <OrbitControls
      ref={controles as never}
      makeDefault
      enablePan={false}
      enableZoom={false}
      enableDamping
      dampingFactor={0.09}
      rotateSpeed={0.6}
      minPolarAngle={0.3}
      maxPolarAngle={1.32}
      target={VISTA_INICIAL.objetivo}
    />
  );
});

/** Si el navegador pierde el contexto WebGL, se avisa para usar el respaldo 2D. */
function AvisoContexto({ alPerder }: { alPerder: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    const f = (e: Event) => {
      e.preventDefault();
      alPerder();
    };
    el.addEventListener("webglcontextlost", f);
    return () => el.removeEventListener("webglcontextlost", f);
  }, [gl, alPerder]);
  return null;
}

type Props = {
  datos: DatosInundacion;
  /** Altura simulada objetivo (m). La escena la sigue con suavizado, sin re-renderizar por cuadro. */
  altura: number;
  controlRef?: MutableRefObject<ControlVista | null>;
  onFallo?: () => void;
};

export default function Inundacion3D({ datos, altura, controlRef, onFallo }: Props) {
  const geo = useMemo(() => construir(datos), [datos]);
  const alturaRef = useRef(altura);
  alturaRef.current = altura;
  const raiz = useRef<HTMLDivElement>(null);
  const camara = useRef<ControlVista>(null);
  const [visible, setVisible] = useState(true);
  const [calidad, setCalidad] = useState(1.75);

  useEffect(() => {
    if (controlRef) controlRef.current = { acercar: () => camara.current?.acercar(), alejar: () => camara.current?.alejar(), girar: (r) => camara.current?.girar(r), restablecer: () => camara.current?.restablecer() };
  }, [controlRef]);

  // Fuera de pantalla se detiene el dibujo.
  useEffect(() => {
    const el = raiz.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Con el dedo, el deslizamiento vertical sigue desplazando la página.
  useEffect(() => {
    const canvas = raiz.current?.querySelector("canvas");
    if (canvas) canvas.style.touchAction = "pan-y";
  }, [visible]);

  return (
    <div
      ref={raiz}
      role="img"
      aria-label="Vista 3D del relieve de los cuatro sectores K10 con el agua que avanza al subir la altura simulada. La tabla de sectores contiene la misma información en texto."
      style={{ position: "absolute", inset: 0, touchAction: "pan-y" }}
    >
      <Canvas
        dpr={[1, calidad]}
        frameloop={visible ? "always" : "never"}
        camera={{ fov: 36, near: 0.1, far: 120, position: VISTA_INICIAL.pos.toArray() }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onPointerMissed={() => undefined}
        style={{ background: hexDe("pizarra.100") }}
      >
        <AvisoContexto alPerder={() => onFallo?.()} />
        <PerfCalidad bajar={() => setCalidad(1)} />
        <Camara ref={camara} />
        <Terreno datos={datos} geo={geo} altura={alturaRef} />
        <Sectores datos={datos} geo={geo} altura={altura} />
      </Canvas>
    </div>
  );
}

/** Si los cuadros tardan, baja la resolución de dibujo. */
function PerfCalidad({ bajar }: { bajar: () => void }) {
  const lentos = useRef(0);
  useFrame((_, dt) => {
    if (dt > 0.05) lentos.current += 1;
    else lentos.current = Math.max(0, lentos.current - 1);
    if (lentos.current > 40) {
      lentos.current = 0;
      bajar();
    }
  });
  return null;
}
