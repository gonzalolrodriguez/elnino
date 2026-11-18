import { Html, Line, OrbitControls } from "@react-three/drei";
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

// Colores en RGB para WebGL, resueltos desde los tokens semánticos del sistema visual.
const C = {
  hito: hexDe("cuenca.hito"),
  hitoPrincipal: hexDe("cuenca.hitoPrincipal"),
  sobreAmbar: hexDe("cuenca.sobreAmbar"),
  rotulo: hexDe("nav.bg"),
  rioPrincipal: hexDe("cuenca.rioPrincipal"),
  afluente: hexDe("cuenca.afluente"),
  espuma: hexDe("cuenca.espuma"),
  tinta: hexDe("limo.950"),
  departamento: hexDe("pizarra.50"),
  provincia: hexDe("cuenca.hitoTexto"),
};

const ESCALA = 0.01; // 1 unidad = 100 km en horizontal
const K_VERT = EXAGERACION_VERTICAL * 1e-5; // unidades por metro de elevación, con la exageración vertical
const DURACION_S = 9;
/** `?escena=final` salta la animación al encuadre final (para capturas y revisión visual). */
const SALTAR = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("escena") === "final";
const ANCHO_LG = 992; // px: desde aquí el hero pone el texto a la izquierda

// Encuadre final (ajustable): lon/lat del punto al que mira la cámara y desplazamiento de la cámara.
// Ajuste fino de revisión visual: ?ajuste=lon,lat,dx,dy,dz,ox,oy
const AJ = typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("ajuste")?.split(",").map(Number) ?? []) : [];
const pr = (i: number, v: number) => (AJ.length > i ? AJ[i] : v);
const FINAL = { lon: pr(0, -59.8), lat: pr(1, -25.0), desp: [pr(2, 3.5), pr(3, 4.8), pr(4, 3.2)] as const };
const INICIO = { desp: [0.6, 5.2, 6.2] as const };
const DESPLAZAMIENTO_X = pr(5, 0.05); // fracción del ancho que se corre la escena a la derecha (deja libre el texto)
const DESPLAZAMIENTO_Y = pr(6, 0.1); // fracción del alto que se corre hacia arriba (deja libre la escala)

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

const suavizar = (t: number) => t * t * (3 - 2 * t);

function Terreno({ malla, proy }: { malla: Malla; proy: Proy }) {
  const textura = useLoader(THREE.TextureLoader, urlRelieve("tinte_cuenca.png"));
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  const geom = useMemo(() => {
    const { nx, ny, bbox, z } = malla;
    const pos = new Float32Array(nx * ny * 3);
    const uv = new Float32Array(nx * ny * 2);
    for (let i = 0; i < ny; i++) {
      const lat = bbox[3] - ((bbox[3] - bbox[1]) * i) / (ny - 1);
      for (let j = 0; j < nx; j++) {
        const lon = bbox[0] + ((bbox[2] - bbox[0]) * j) / (nx - 1);
        const p = proy.aEscena(lon, lat, z[i * nx + j]);
        const k = i * nx + j;
        pos.set([p.x, p.y, p.z], k * 3);
        uv.set([j / (nx - 1), 1 - i / (ny - 1)], k * 2);
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
        idx.set([a, c, b, b, c, d], t);
        t += 6;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    return g;
  }, [malla, proy]);
  return (
    <mesh geometry={geom}>
      <meshBasicMaterial map={textura} toneMapped={false} />
    </mesh>
  );
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
            const a = proy.aEscena(ln[i][0], ln[i][1], e, 0.006);
            const b = proy.aEscena(ln[i + 1][0], ln[i + 1][1], e, 0.006);
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
      <lineSegments geometry={menores}>
        <lineBasicMaterial color={C.tinta} transparent opacity={0.42} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={mayores}>
        <lineBasicMaterial color={C.tinta} transparent opacity={0.9} depthWrite={false} />
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
        <group key={`p${i}`}>
          <Line points={pts} color={C.tinta} lineWidth={4} transparent opacity={0.6} depthTest={false} renderOrder={5} />
          <Line points={pts} color={C.provincia} lineWidth={2} transparent depthTest={false} renderOrder={6} />
        </group>
      ))}
      {deps.flatMap((d) =>
        d.lineas.map((pts, i) => (
          <group key={`${d.nombre}-${i}`}>
            <Line points={pts} color={C.tinta} lineWidth={3} transparent opacity={0.55} depthTest={false} renderOrder={3} />
            <Line points={pts} color={C.departamento} lineWidth={1.2} transparent depthTest={false} renderOrder={4} />
          </group>
        )),
      )}
      {rotular &&
        deps.map((d) => (
          <Html key={d.nombre} position={d.centro} center style={{ pointerEvents: "none" }} zIndexRange={[1, 0]}>
            <div
              data-etiqueta-escena=""
              data-rotulo-departamento={d.nombre}
              style={{
                font: "600 11px 'Public Sans Variable', 'Segoe UI', system-ui, sans-serif",
                color: C.departamento,
                background: "rgba(14,24,24,0.62)",
                padding: "1px 5px",
                borderRadius: 2,
                whiteSpace: "nowrap",
                letterSpacing: "0.02em",
              }}
            >
              {d.nombre}
            </div>
          </Html>
        ))}
    </>
  );
}

function Particulas({ curva, n, velocidad, color, tam }: { curva: THREE.Curve<THREE.Vector3>; n: number; velocidad: number; color: string; tam: number }) {
  const ref = useRef<THREE.Points>(null);
  const { base, lateral } = useMemo(() => {
    const b = new Float32Array(n);
    const lat = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      b[i] = i / n;
      lat[i * 2] = (Math.random() - 0.5) * 0.05;
      lat[i * 2 + 1] = Math.random() * 0.02;
    }
    return { base: b, lateral: lat };
  }, [n]);
  const posiciones = useMemo(() => new Float32Array(n * 3), [n]);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * velocidad;
    for (let i = 0; i < n; i++) {
      const u = (base[i] + t) % 1;
      curva.getPointAt(u, tmp);
      posiciones[i * 3] = tmp.x + lateral[i * 2];
      posiciones[i * 3 + 1] = tmp.y + 0.012 + lateral[i * 2 + 1];
      posiciones[i * 3 + 2] = tmp.z + lateral[i * 2];
    }
    const attr = ref.current?.geometry.getAttribute("position");
    if (attr) attr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[posiciones, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={tam} sizeAttenuation transparent opacity={0.95} depthWrite={false} />
    </points>
  );
}

function Hito({ posicion, nombre, principal, dy = 0 }: { posicion: THREE.Vector3; nombre: string; principal?: boolean; dy?: number }) {
  const anillo = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!anillo.current) return;
    const s = 1 + ((clock.getElapsedTime() * 0.6) % 1) * 2.2;
    anillo.current.scale.setScalar(s);
    (anillo.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - (s - 1) / 2.2);
  });
  return (
    <group position={posicion}>
      <mesh position={[0, 0.03, 0]}>
        <sphereGeometry args={[principal ? 0.045 : 0.025, 16, 16]} />
        <meshBasicMaterial color={principal ? C.hitoPrincipal : C.hito} />
      </mesh>
      {principal && (
        <mesh ref={anillo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.06, 0.07, 48]} />
          <meshBasicMaterial color={C.hitoPrincipal} transparent depthWrite={false} />
        </mesh>
      )}
      <Html position={[0.06, 0.12 + dy, 0]} style={{ pointerEvents: "none" }} zIndexRange={[1, 0]}>
        <div
          data-etiqueta-escena=""
          style={{
            font: `${principal ? 700 : 500} ${principal ? 14 : 12}px 'Public Sans Variable', 'Segoe UI', system-ui, sans-serif`,
            color: principal ? C.sobreAmbar : C.hito,
            background: principal ? C.hitoPrincipal : C.rotulo,
            padding: "2px 6px",
            borderRadius: 2,
            whiteSpace: "nowrap",
          }}
        >
          {nombre}
        </div>
      </Html>
    </group>
  );
}

/** Corre la escena a la derecha en pantallas anchas para que el texto y la escala no tapen la zona de interés. */
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

function Escena({ datos, malla, onTerminar }: { datos: DatosRelieve; malla: Malla; onTerminar: () => void }) {
  const proy = useMemo(() => crearProy(datos, malla.min), [datos, malla]);
  const { camera } = useThree();
  const [terminado, setTerminado] = useState(false);

  const rios = useMemo(
    () =>
      datos.rio.features.map((f) => {
        const ln = lineasDe(f).sort((a, b) => b.length - a.length)[0];
        const pts = ln.map(([lon, lat]) => proy.aEscena(lon, lat, elevEn(malla, lon, lat), 0.014));
        const curva = new THREE.CatmullRomCurve3(pts, false, "centripetal");
        curva.arcLengthDivisions = 3000;
        return { id: String(f.properties.id), principal: f.properties.rol === "principal", pts, curva };
      }),
    [datos, malla, proy],
  );
  const paraguay = rios.find((r) => r.principal) ?? rios[0];

  const formosa = useMemo(() => {
    const h = HITOS_RELIEVE.find((x) => x.id === "formosa");
    return proy.aEscena(h?.lon ?? -58.183, h?.lat ?? -26.183, 0);
  }, [proy]);
  const uFormosa = useMemo(() => {
    let mejor = 0;
    let dMin = Infinity;
    for (let i = 0; i <= 800; i++) {
      const p = paraguay.curva.getPointAt(i / 800);
      const d = Math.hypot(p.x - formosa.x, p.z - formosa.z);
      if (d < dMin) {
        dMin = d;
        mejor = i / 800;
      }
    }
    return mejor;
  }, [paraguay, formosa]);
  const destino = useMemo(() => proy.aEscena(FINAL.lon, FINAL.lat, elevEn(malla, FINAL.lon, FINAL.lat)), [proy, malla]);

  const inicio = useRef<number | null>(null);
  const hecho = useRef(false);
  const objetivo = useMemo(() => new THREE.Vector3(), []);
  const punto = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    if (hecho.current) return;
    inicio.current ??= clock.getElapsedTime();
    const p = SALTAR ? 1 : Math.min(1, (clock.getElapsedTime() - inicio.current) / DURACION_S);
    const e = suavizar(suavizar(p));
    paraguay.curva.getPointAt(uFormosa * Math.min(1, e / 0.72), punto);
    const w = suavizar(Math.min(1, Math.max(0, (e - 0.5) / 0.5)));
    objetivo.lerpVectors(punto, destino, w);
    camera.position.set(
      objetivo.x + INICIO.desp[0] + (FINAL.desp[0] - INICIO.desp[0]) * e,
      objetivo.y + INICIO.desp[1] + (FINAL.desp[1] - INICIO.desp[1]) * e,
      objetivo.z + INICIO.desp[2] + (FINAL.desp[2] - INICIO.desp[2]) * e,
    );
    camera.lookAt(objetivo);
    if (p >= 1) {
      hecho.current = true;
      setTerminado(true);
      onTerminar();
    }
  });

  useEffect(() => {
    camera.position.set(INICIO.desp[0], INICIO.desp[1] + 1, INICIO.desp[2]);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return (
    <>
      <Encuadre />
      <Terreno malla={malla} proy={proy} />
      <Curvas datos={datos} proy={proy} />
      <Limites datos={datos} malla={malla} proy={proy} rotular={terminado} />
      {rios.map((r) => (
        <Line key={r.id} points={r.curva.getPoints(500)} color={r.principal ? C.rioPrincipal : C.afluente} lineWidth={r.principal ? 3 : 2} />
      ))}
      {rios.map((r) => (
        <Particulas key={`p-${r.id}`} curva={r.curva} n={r.principal ? 620 : 160} velocidad={r.principal ? 0.03 : 0.045} color={C.espuma} tam={r.principal ? 0.045 : 0.035} />
      ))}
      {HITOS_RELIEVE.map((h) => (
        <Hito key={h.id} posicion={proy.aEscena(h.lon, h.lat, elevEn(malla, h.lon, h.lat), 0.02)} nombre={h.nombre} principal={h.principal} dy={h.id === "pilcomayo" ? -0.17 : 0} />
      ))}
      {terminado && <ControlesFinales objetivo={destino} />}
    </>
  );
}

function ControlesFinales({ objetivo }: { objetivo: THREE.Vector3 }) {
  return <OrbitControls target={objetivo} enablePan={false} enableZoom={false} minPolarAngle={0.5} maxPolarAngle={1.2} />;
}

export default function Cuenca3D({ datos, onTerminar }: { datos: DatosRelieve; onTerminar?: () => void }) {
  const [malla, setMalla] = useState<Malla | null>(null);
  useEffect(() => {
    let activo = true;
    cargarMalla()
      .then((m) => activo && setMalla(m))
      .catch(() => undefined);
    return () => {
      activo = false;
    };
  }, []);
  if (!malla) return null;
  return (
    <Canvas dpr={[1, 2]} camera={{ fov: 42, near: 0.1, far: 80, position: [0, 6, 6] }} gl={{ antialias: true, alpha: true }}>
      <Escena datos={datos} malla={malla} onTerminar={() => onTerminar?.()} />
    </Canvas>
  );
}
