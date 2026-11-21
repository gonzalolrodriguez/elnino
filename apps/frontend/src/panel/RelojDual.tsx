import { Box, Button, ButtonGroup, Flex, Text } from "@chakra-ui/react";
import { CATEGORIAS } from "@evacuaciones/shared";
import { useMemo, useState } from "react";

import { Dial } from "../components/TresRelojes";
import { Insignia } from "../components/Insignia";
import { LLUVIA_CORTA_RIPIO_MM, LLUVIA_CORTA_TIERRA_MM, SECTORES_K10, UMBRAL_ALERTA, UMBRAL_EVACUACION } from "../datos/kit";
import { PAL } from "../estilo/paleta";
import { distanciaAUmbral, fraccion } from "../lib/relojes";
import { useEscenario } from "./EscenarioContext";
import {
  horasHastaAltura,
  horasHastaLluvia,
  mensajeExpuesto,
  proyectarSector,
  RITMO_LLUVIA_MM_H_DEFECTO,
  RITMOS_LLUVIA_MM_H,
  sectorMasExpuesto,
  textoHoras,
  textoRangoHoras,
  type AccesoProy,
  type RangoHoras,
} from "./proyeccion";
import type { AccesoProps } from "./tipos";
import { fmtM, fmtNum } from "./ui";

const TAMANO_DIAL = "6rem";

/** Tono del mensaje según la urgencia: ya ocurrió o antes de 24 h, antes de 72 h, más tarde. */
function tono(r: RangoHoras): { bg: string; fg: string; borde: string } {
  if (r.minimo <= 24) return { bg: "evacuacion.50", fg: "evacuacion.800", borde: "evacuacion.200" };
  if (r.minimo <= 72) return { bg: "alerta.50", fg: "alerta.800", borde: "alerta.200" };
  return { bg: "pizarra.100", fg: "pizarra.700", borde: "pizarra.200" };
}

/**
 * Reloj dual río/barro con cuenta regresiva por sector (SIMULADO). Se recalcula en vivo con el deslizador, sin consultar
 * al backend: es una proyección con supuestos. El estado oficial (K10) sigue saliendo de "Calcular escenario".
 */
export function RelojDual({ accesos }: { accesos: AccesoProps[] }) {
  const { entrada, alturaVisual, escenarioSimulado } = useEscenario();
  const [ritmo, setRitmo] = useState<number>(RITMO_LLUVIA_MM_H_DEFECTO);
  const altura = alturaVisual ?? entrada.altura_formosa_m;
  const lluvia = Math.max(0, entrada.lluvia_mm);

  const accesosProy = useMemo<AccesoProy[]>(
    () => accesos.map((a) => ({ id: a.id, sector_id: a.sector_id, superficie: a.superficie, cerrado: !a.transitable || entrada.caminos_cerrados.includes(a.id) })),
    [accesos, entrada.caminos_cerrados],
  );
  const proyecciones = useMemo(
    () => SECTORES_K10.map((s) => proyectarSector({ id: s.id, nombre: s.nombre, compromiso_m: s.compromiso_m }, accesosProy, altura, lluvia, ritmo)),
    [accesosProy, altura, lluvia, ritmo],
  );
  const expuesto = sectorMasExpuesto(proyecciones);

  const distAlerta = distanciaAUmbral(altura, UMBRAL_ALERTA);
  const rioAlerta = horasHastaAltura(altura, UMBRAL_ALERTA);
  const barroTierra = horasHastaLluvia(lluvia, LLUVIA_CORTA_TIERRA_MM, ritmo);
  const barroRipio = horasHastaLluvia(lluvia, LLUVIA_CORTA_RIPIO_MM, ritmo);
  const t = expuesto ? tono(expuesto.rango) : tono({ minimo: Infinity, maximo: Infinity });

  return (
    <Box data-testid="reloj-dual">
      {expuesto && (
        <Box px={3} py={2.5} mb={3} borderRadius="lg" border="1px solid" bg={t.bg} color={t.fg} borderColor={t.borde} role="status" aria-live="polite">
          <Text textStyle="cifra" fontSize={{ base: "1.15rem", md: "1.3rem" }} data-testid="reloj-dual-mensaje">
            {mensajeExpuesto(expuesto)}
          </Text>
          <Text fontSize="xs" mt={0.5}>
            Primer evento del sector más expuesto: el menor de los dos relojes. Proyección SIMULADA.
          </Text>
        </Box>
      )}

      <Flex gap={3} wrap="wrap" justify="space-around">
        <Flex direction="column" align="center" flex="1 1 9rem" minW={0} data-testid="reloj-dual-rio">
          <Dial
            orden={0}
            tamano={TAMANO_DIAL}
            f={fraccion(altura, UMBRAL_EVACUACION)}
            color={PAL.agua[700]}
            marcas={[{ f: fraccion(UMBRAL_ALERTA, UMBRAL_EVACUACION), color: PAL.alerta[600] }]}
            etiqueta={`Reloj del río: ${fmtM(altura)} de ${fmtM(UMBRAL_EVACUACION)} de evacuación; alerta en ${fmtM(UMBRAL_ALERTA)}`}
            centro={
              <>
                <Text textStyle="cifra" fontSize="1.05rem">
                  {distAlerta.alcanzado ? "Superada" : fmtM(distAlerta.faltaM)}
                </Text>
                <Text fontSize="10px" color="textoSuave" lineHeight={1.2}>
                  {distAlerta.alcanzado ? "la alerta" : "a la alerta"}
                </Text>
              </>
            }
          />
          <Text textStyle="rotulo" color="texto" mt={1}>
            Río
          </Text>
          <Text fontSize="xs" textAlign="center" data-testid="reloj-dual-rio-texto">
            {fmtM(altura)} ({escenarioSimulado || alturaVisual !== null ? "SIMULADO" : "DATO OBSERVADO"}). Alerta: {textoRangoHoras(rioAlerta)}.
          </Text>
        </Flex>

        <Flex direction="column" align="center" flex="1 1 9rem" minW={0} data-testid="reloj-dual-barro">
          <Dial
            orden={1}
            tamano={TAMANO_DIAL}
            f={fraccion(lluvia, LLUVIA_CORTA_RIPIO_MM)}
            color={PAL.alerta[600]}
            marcas={[
              { f: fraccion(LLUVIA_CORTA_TIERRA_MM, LLUVIA_CORTA_RIPIO_MM), color: PAL.alerta[800] },
              { f: 1, color: PAL.evacuacion[700] },
            ]}
            etiqueta={`Reloj del barro: ${fmtNum(lluvia)} mm; la tierra se corta con ${LLUVIA_CORTA_TIERRA_MM} mm y el ripio con ${LLUVIA_CORTA_RIPIO_MM} mm`}
            centro={
              <>
                <Text textStyle="cifra" fontSize="1.05rem">
                  {fmtNum(lluvia)} mm
                </Text>
                <Text fontSize="10px" color="textoSuave" lineHeight={1.2}>
                  de lluvia
                </Text>
              </>
            }
          />
          <Text textStyle="rotulo" color="texto" mt={1}>
            Barro
          </Text>
          <Text fontSize="xs" textAlign="center" data-testid="reloj-dual-barro-texto">
            Tierra: {barroTierra <= 0 ? "cortada" : `se corta en ${textoHoras(barroTierra)}`}. Ripio: {barroRipio <= 0 ? "cortado" : `se corta en ${textoHoras(barroRipio)}`}.
          </Text>
        </Flex>
      </Flex>

      <Flex align="center" gap={2} wrap="wrap" mt={3}>
        <Text textStyle="rotulo" id="ritmo-lluvia-etiqueta">
          Ritmo de lluvia (SUPUESTO):
        </Text>
        <ButtonGroup size="xs" isAttached variant="outline" role="group" aria-labelledby="ritmo-lluvia-etiqueta">
          {RITMOS_LLUVIA_MM_H.map((r) => (
            <Button key={r} onClick={() => setRitmo(r)} aria-pressed={ritmo === r} variant={ritmo === r ? "solid" : "outline"}>
              {r} mm/h
            </Button>
          ))}
        </ButtonGroup>
      </Flex>

      <Box as="table" w="100%" mt={3} fontSize="xs" aria-label="Cuenta regresiva por sector" sx={{ "th, td": { py: 1, px: 1, textAlign: "left", borderBottom: "1px solid", borderColor: "borde" } }}>
        <thead>
          <tr>
            <th>Sector</th>
            <th>Comprometido (río)</th>
            <th>Aislado (río + barro)</th>
          </tr>
        </thead>
        <tbody>
          {proyecciones.map((p) => (
            <tr key={p.id} data-testid={`reloj-dual-${p.id}`} style={expuesto?.id === p.id ? { fontWeight: 700 } : undefined}>
              <td>{p.id}</td>
              <td>{textoRangoHoras(p.compromiso)}</td>
              <td>{p.aislamiento ? textoRangoHoras(p.aislamiento) : "sin accesos"}</td>
            </tr>
          ))}
        </tbody>
      </Box>

      <Flex gap={2} align="center" wrap="wrap" mt={3}>
        <Insignia categoria={CATEGORIAS.SIMULADO} />
        <Text as="span" fontSize="xs" color="textoSuave">
          Sectores y accesos K10 (SIMULADO).
        </Text>
      </Flex>
      <Box mt={2} p={2.5} bg="cat.simulado.bg" color="cat.simulado.fg" border="1px dashed" borderColor="cat.simulado.borde" borderRadius="lg" fontSize="xs" data-testid="reloj-dual-supuestos">
        <strong>SUPUESTO:</strong> el río sube en línea recta entre 0,36 m/día (mayor suba diaria de 2019) y 0,1077 m/día (promedio de octubre de 2026); la lluvia cae a {ritmo} mm/h
        constantes; la tierra se corta con 30 mm y el ripio con 80 mm; un acceso de tierra se anega cuando su sector se compromete. No es un pronóstico: el INA no pronostica a más de 15 días.
        El estado oficial del sector (K10) es el de «Calcular escenario».
      </Box>
    </Box>
  );
}
