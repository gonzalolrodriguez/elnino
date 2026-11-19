import { Box, Flex, Text } from "@chakra-ui/react";

type Punto = { lat: number; lon: number };

const ANCHO = 320;
const ALTO = 200;
const MARGEN = 28;

/** Distancia en metros entre dos puntos (haversine), para el texto del mapa. */
export function distanciaM(a: Punto, b: Punto): number {
  const R = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const fmtDistancia = (m: number | null | undefined): string =>
  m === null || m === undefined ? "sin dato" : m < 1000 ? `${Math.round(m).toLocaleString("es-AR")} m` : `${(m / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} km`;

/**
 * Esquema local del punto de destino marcado por la cuadrilla frente al centro de recepción elegido (y el origen del pedido).
 * No usa mapa base ni servicios externos: sirve para ver a ojo qué tan cerca quedó. Cada punto tiene su forma y su rótulo.
 */
export function MiniMapaDestino({ destino, centro, origen, centroNombre, distanciaM: distanciaDeclarada }: { destino: Punto; centro: Punto | null; origen: Punto | null; centroNombre: string | null; distanciaM: number | null }) {
  const puntos = [destino, centro, origen].filter((p): p is Punto => p !== null);
  const lat0 = puntos.reduce((s, p) => s + p.lat, 0) / puntos.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = puntos.map((p) => p.lon * k);
  const ys = puntos.map((p) => p.lat);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const rangoX = Math.max(...xs) - minX;
  const rangoY = Math.max(...ys) - minY;
  const escala = Math.min(rangoX > 0 ? (ANCHO - 2 * MARGEN) / rangoX : Infinity, rangoY > 0 ? (ALTO - 2 * MARGEN) / rangoY : Infinity);
  const e = Number.isFinite(escala) ? escala : 1;
  const pos = (p: Punto) => ({
    x: ANCHO / 2 + (p.lon * k - minX - rangoX / 2) * e,
    y: ALTO / 2 - (p.lat - minY - rangoY / 2) * e,
  });
  const d = pos(destino);
  const c = centro ? pos(centro) : null;
  const o = origen ? pos(origen) : null;
  const dist = distanciaDeclarada ?? (centro ? distanciaM(destino, centro) : null);
  const descripcion = `Esquema sin escala: destino marcado${centro ? `, centro ${centroNombre ?? "elegido"} a ${fmtDistancia(dist)}` : ", sin centro elegido"}${origen ? " y origen del pedido" : ""}.`;
  return (
    <Box data-testid="mini-mapa-destino">
      <Box as="svg" viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label={descripcion} w="100%" maxW="22rem" bg="pizarra.50" border="1px solid" borderColor="borde" borderRadius="lg">
        {o && (
          <line x1={o.x} y1={o.y} x2={d.x} y2={d.y} stroke="#66768A" strokeWidth="1.5" strokeDasharray="4 4" />
        )}
        {c && <line x1={c.x} y1={c.y} x2={d.x} y2={d.y} stroke="#B42318" strokeWidth="2" />}
        {o && <polygon points={`${o.x},${o.y - 7} ${o.x + 7},${o.y + 6} ${o.x - 7},${o.y + 6}`} fill="#66768A" stroke="#fff" strokeWidth="1.5" />}
        {c && <rect x={c.x - 6} y={c.y - 6} width="12" height="12" fill="#1E5AA0" stroke="#fff" strokeWidth="1.5" />}
        <circle cx={d.x} cy={d.y} r="7" fill="#2F7D5B" stroke="#fff" strokeWidth="1.5" />
      </Box>
      <Flex gap={4} wrap="wrap" fontSize="xs" mt={1} color="textoSuave">
        <span>● Destino marcado</span>
        {centro && <span>■ {centroNombre ?? "Centro elegido"}</span>}
        {origen && <span>▲ Origen del pedido</span>}
      </Flex>
      {centro ? (
        <Text fontSize="sm" mt={1} data-testid="distancia-a-centro">
          El destino quedó a <strong>{fmtDistancia(dist)}</strong> del centro.
        </Text>
      ) : (
        <Text fontSize="sm" mt={1}>
          No se eligió un centro de recepción: no hay distancia para comparar.
        </Text>
      )}
    </Box>
  );
}
