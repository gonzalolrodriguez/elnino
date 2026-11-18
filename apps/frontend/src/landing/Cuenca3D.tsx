import { Html, Line, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { CURSOS_APROXIMADOS, HITOS, limites, proyectar, proyectarCurso, type Curso } from "./geometria";

const ESCALA = 0.01; // 1 unidad = 100 km
const DURACION_S = 9;

type Props = { cursos?: Curso[] };

function util(cursos: Curso[]) {
  const l = limites(cursos);
  const cx = (l.xMin + l.xMax) / 2;
  const cy = (l.yMin + l.yMax) / 2;
  const aEscena = (x: number, y: number) => new THREE.Vector3((x - cx) * ESCALA, 0, -(y - cy) * ESCALA);
  return { l, aEscena };
}

function suavizar(t: number) {
  return t * t * (3 - 2 * t);
}

function Particulas({ curva, n, velocidad, color, tam }: { curva: THREE.Curve<THREE.Vector3>; n: number; velocidad: number; color: string; tam: number }) {
  const ref = useRef<THREE.Points>(null);
  const { base, lateral } = useMemo(() => {
    const b = new Float32Array(n);
    const lat = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      b[i] = i / n;
      lat[i * 2] = (Math.random() - 0.5) * 0.07;
      lat[i * 2 + 1] = Math.random() * 0.04;
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
      posiciones[i * 3 + 1] = 0.02 + lateral[i * 2 + 1];
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
      <pointsMaterial color={color} size={tam} sizeAttenuation transparent opacity={0.9} depthWrite={false} />
    </points>
  );
}

function Hito({ posicion, nombre, principal }: { posicion: THREE.Vector3; nombre: string; principal?: boolean }) {
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
        <meshBasicMaterial color={principal ? "#D99A1E" : "#EAEFEC"} />
      </mesh>
      {principal && (
        <mesh ref={anillo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.06, 0.07, 48]} />
          <meshBasicMaterial color="#D99A1E" transparent depthWrite={false} />
        </mesh>
      )}
      <Html position={[0.06, 0.12, 0]} style={{ pointerEvents: "none" }} zIndexRange={[5, 0]}>
        <div
          style={{
            font: `${principal ? 700 : 500} ${principal ? 13 : 11}px 'Segoe UI', system-ui, sans-serif`,
            color: principal ? "#1B1200" : "#EAEFEC",
            background: principal ? "#D99A1E" : "rgba(14,33,37,0.72)",
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

function Escena({ cursos, onTerminar }: { cursos: Curso[]; onTerminar: () => void }) {
  const { aEscena } = useMemo(() => util(cursos), [cursos]);
  const { camera } = useThree();

  const datos = useMemo(() => {
    return cursos.map((c) => {
      const pts = proyectarCurso(c).map(([x, y]) => aEscena(x, y));
      return { curso: c, pts, curva: new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5) };
    });
  }, [cursos, aEscena]);

  const paraguay = datos.find((d) => d.curso.id === "paraguay") ?? datos[0];
  const formosa = useMemo(() => {
    const h = HITOS.find((x) => x.id === "formosa");
    const [x, y] = proyectar(h?.lon ?? -58.183, h?.lat ?? -26.183);
    return aEscena(x, y);
  }, [aEscena]);

  const uFormosa = useMemo(() => {
    let mejor = 0;
    let dMin = Infinity;
    for (let i = 0; i <= 600; i++) {
      const d = paraguay.curva.getPointAt(i / 600).distanceTo(formosa);
      if (d < dMin) {
        dMin = d;
        mejor = i / 600;
      }
    }
    return mejor;
  }, [paraguay, formosa]);

  const inicio = useRef<number | null>(null);
  const terminado = useRef(false);
  const objetivo = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    if (terminado.current) return;
    inicio.current ??= clock.getElapsedTime();
    const p = Math.min(1, (clock.getElapsedTime() - inicio.current) / DURACION_S);
    const e = suavizar(suavizar(p));
    paraguay.curva.getPointAt(uFormosa * e, objetivo);
    const d = 1 - e;
    camera.position.set(objetivo.x + 1.7 * e + 0.3 * d, 1.5 + 9.5 * d, objetivo.z + 2.6 * e + 7 * d);
    camera.lookAt(objetivo);
    if (p >= 1) {
      terminado.current = true;
      onTerminar();
    }
  });

  useEffect(() => {
    // Posición inicial antes del primer cuadro.
    camera.position.set(0, 11, 9);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  const pantanal = HITOS.find((h) => h.id === "pantanal");
  const posPantanal = pantanal ? aEscena(...proyectar(pantanal.lon, pantanal.lat)) : null;

  return (
    <>
      <gridHelper args={[26, 52, "#1F4A50", "#16373C"]} position={[0, -0.001, 0]} />
      {posPantanal && (
        <mesh position={[posPantanal.x, 0.005, posPantanal.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.8, 40]} />
          <meshBasicMaterial color="#2F8F8A" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      )}
      {datos.map((d) => (
        <Line
          key={d.curso.id}
          points={d.curva.getPoints(160)}
          color={d.curso.id === "paraguay" ? "#8FD0C8" : "#4FA39C"}
          lineWidth={d.curso.id === "paraguay" ? 3 : 2}
        />
      ))}
      {datos.map((d) => (
        <Particulas
          key={`p-${d.curso.id}`}
          curva={d.curva}
          n={d.curso.id === "paraguay" ? 520 : 160}
          velocidad={d.curso.id === "paraguay" ? 0.035 : 0.05}
          color="#E8FBF7"
          tam={d.curso.id === "paraguay" ? 0.05 : 0.04}
        />
      ))}
      {HITOS.map((h) => (
        <Hito key={h.id} posicion={aEscena(...proyectar(h.lon, h.lat))} nombre={h.nombre} principal={h.principal} />
      ))}
    </>
  );
}

function Controles({ activo, cursos }: { activo: boolean; cursos: Curso[] }) {
  const { camera } = useThree();
  const [objetivo] = useState(() => new THREE.Vector3());
  useEffect(() => {
    if (!activo) return;
    // El objetivo final de la cámara es Puerto Formosa.
    const h = HITOS.find((x) => x.id === "formosa");
    if (!h) return;
    const { aEscena } = util(cursos);
    objetivo.copy(aEscena(...proyectar(h.lon, h.lat)));
  }, [activo, objetivo, cursos]);
  if (!activo) return null;
  return (
    <OrbitControls
      target={objetivo}
      enablePan={false}
      enableZoom={false}
      minPolarAngle={0.5}
      maxPolarAngle={1.35}
      camera={camera}
    />
  );
}

export default function Cuenca3D({ cursos = CURSOS_APROXIMADOS }: Props) {
  const [listo, setListo] = useState(false);
  return (
    <Canvas dpr={[1, 2]} camera={{ fov: 42, near: 0.1, far: 80, position: [0, 11, 9] }} gl={{ antialias: true, alpha: true }}>
      <Escena cursos={cursos} onTerminar={() => setListo(true)} />
      <Controles activo={listo} cursos={cursos} />
    </Canvas>
  );
}
