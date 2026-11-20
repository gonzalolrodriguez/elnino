import { Badge, Box, Button, Flex, Heading, Table, Tbody, Td, Text, Th, Thead, Tr } from "@chakra-ui/react";
import { useMemo, useState } from "react";

import { Insignia } from "../../components/Insignia";
import { indiceDeFecha, type SerieDiaria } from "../../datos/kit";
import { SerieK1 } from "../../informacion/SerieK1";
import { useCarga } from "../../lib/useCarga";
import { api } from "../api";
import { useEscenario } from "../EscenarioContext";
import type { Ascenso, Lluvia, SerieFormosa } from "../tipos";
import { IconoOlas } from "../../components/iconos/Iconos";
import { CabeceraPagina } from "../CabeceraPagina";
import { Cargando, Cifra, fmtDias, fmtFecha, fmtM, fmtNum, Seccion } from "../ui";
import { TablaDesplazable } from "../../components/TablaDesplazable";

/** Convierte los puntos de la API en serie diaria con huecos (null): los días sin dato no se interpolan. */
export function aSerieDiaria(s: SerieFormosa): SerieDiaria {
  const desde = s.puntos[0].fecha;
  const hasta = s.puntos[s.puntos.length - 1].fecha;
  const valores: (number | null)[] = new Array<number | null>(indiceDeFecha(desde, hasta) + 1).fill(null);
  for (const p of s.puntos) valores[indiceDeFecha(desde, p.fecha)] = p.altura_max_m;
  return { desde, hasta, valores };
}

function SerieYCifras({ s }: { s: SerieFormosa }) {
  const serie = useMemo(() => (s.puntos.length ? aSerieDiaria(s) : null), [s]);
  return (
    <>
      <Flex gap={6} wrap="wrap" mb={4}>
        {s.ultima && <Cifra testId="monitor-ultima" etiqueta={`Última lectura (${fmtFecha(s.ultima.fecha)})`} valor={fmtM(s.ultima.altura_m)} categoria="DATO OBSERVADO" fuente="K1" fecha={s.fecha_dato} />}
        <Cifra testId="monitor-alerta" etiqueta="Alerta" valor={fmtM(s.umbrales.alerta_m)} categoria={s.umbrales.categoria} fuente="K3" fecha={s.fecha_dato} />
        <Cifra testId="monitor-evacuacion" etiqueta="Evacuación" valor={fmtM(s.umbrales.evacuacion_m)} categoria={s.umbrales.categoria} fuente="K3" fecha={s.fecha_dato} />
        {s.picos.map((p) => (
          <Cifra key={p.anio} etiqueta={`Pico de ${p.anio} (${fmtFecha(p.fecha)})`} valor={fmtM(p.altura_m)} categoria="DATO OBSERVADO" fuente="K1" />
        ))}
      </Flex>
      {serie ? <SerieK1 serie={serie} /> : <Text>La serie no tiene datos.</Text>}
      <Text fontSize="xs" color="textoSuave" mt={2}>
        {s.notas.join(" ")}
      </Text>
    </>
  );
}

const ORIGEN: Record<string, string> = {
  simulado: "simulado",
  carga_manual: "carga manual",
  parte_policial: "parte policial",
  planilla_upca: "planilla UPCA",
};

function TablaLluvia({ l }: { l: Lluvia }) {
  const porOrigen = new Map<string, number>();
  for (const x of l.lecturas) porOrigen.set(x.origen, (porOrigen.get(x.origen) ?? 0) + 1);
  return (
    <>
      {l.sin_dato_observado && (
        <Text mb={2} fontSize="sm" data-testid="lluvia-sin-observado">
          Sin dato observado en el kit: las lecturas que se muestran son cargas o datos de demostración, con su origen.
        </Text>
      )}
      <Flex gap={2} wrap="wrap" mb={3}>
        {[...porOrigen.entries()].map(([o, n]) => (
          <Badge key={o} colorScheme="gray">
            {ORIGEN[o] ?? o}: {n}
          </Badge>
        ))}
      </Flex>
      <TablaDesplazable etiqueta="Lecturas de lluvia recientes" maxH="16rem" overflowY="auto">
        <Table size="sm" variant="simple" aria-label="Lecturas de lluvia recientes">
          <Thead position="sticky" top={0} bg="superficie">
            <Tr>
              <Th>Fecha</Th>
              <Th>Turno</Th>
              <Th>Puesto</Th>
              <Th isNumeric>mm</Th>
              <Th>Origen</Th>
              <Th>Categoría</Th>
            </Tr>
          </Thead>
          <Tbody>
            {l.lecturas.map((x) => (
              <Tr key={x.id}>
                <Td>{fmtFecha(x.fecha)}</Td>
                <Td>{x.turno}</Td>
                <Td>{x.puesto_nombre}</Td>
                <Td isNumeric>{x.mm === null ? "sin medición" : fmtNum(x.mm, 1)}</Td>
                <Td>{ORIGEN[x.origen] ?? x.origen}</Td>
                <Td>
                  <Insignia categoria={x.categoria} />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TablaDesplazable>
    </>
  );
}

function BloqueAscenso({ a }: { a: Ascenso }) {
  return (
    <>
      <Text fontSize="sm" mb={2}>
        Altura de referencia: <strong>{fmtM(a.altura_actual_m)}</strong> {a.fecha_altura ? `(${fmtFecha(a.fecha_altura)}, DATO OBSERVADO)` : "(valor indicado, SIMULADO)"}.
      </Text>
      <TablaDesplazable etiqueta="Velocidades de ascenso por período" mb={4}>
        <Table size="sm" aria-label="Velocidades de ascenso por período">
          <Thead>
            <Tr>
              <Th>Período</Th>
              <Th>Mayor suba en 1 día</Th>
              <Th>Mayor suba en 7 días</Th>
              <Th>Cruces</Th>
            </Tr>
          </Thead>
          <Tbody>
            {a.periodos.map((p) => (
              <Tr key={p.periodo}>
                <Td>{p.periodo}</Td>
                <Td>{p.mayor_suba_1d ? `${fmtM(p.mayor_suba_1d.metros)} (${fmtFecha(p.mayor_suba_1d.fecha)})` : "sin dato"}</Td>
                <Td>{p.mayor_suba_7d ? `${fmtM(p.mayor_suba_7d.metros)} (${fmtFecha(p.mayor_suba_7d.fecha)})` : "sin dato"}</Td>
                <Td whiteSpace="normal">
                  {Object.entries(p.cruces)
                    .map(([u, f]) => `${u.replace(".", ",")} m: ${f ? fmtFecha(f) : "no cruzó"}`)
                    .join(" · ")}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TablaDesplazable>
      <Flex align="center" gap={2} mb={2}>
        <Heading as="h3" size="xs">
          ¿Cuánto tiempo queda?
        </Heading>
        <Insignia categoria={a.categoria_proyeccion} />
      </Flex>
      <TablaDesplazable etiqueta="Tiempo restante hasta cada umbral">
        <Table size="sm" aria-label="Tiempo restante hasta cada umbral">
          <Thead>
            <Tr>
              <Th>Objetivo</Th>
              <Th isNumeric>Altura</Th>
              <Th>Tiempo restante (rango)</Th>
              <Th>Categoría del umbral</Th>
            </Tr>
          </Thead>
          <Tbody>
            {a.tiempo_restante.map((t) => (
              <Tr key={t.objetivo}>
                <Td whiteSpace="normal">{t.objetivo}</Td>
                <Td isNumeric>{fmtM(t.valor_m)}</Td>
                <Td>{t.ya_alcanzado ? "ya alcanzado" : fmtDias(t.dias_minimo, t.dias_maximo)}</Td>
                <Td>
                  <Insignia categoria={t.categoria_del_umbral} />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TablaDesplazable>
      <Box mt={3} p={3} bg="cat.simulado.bg" color="cat.simulado.fg" border="1px dashed" borderColor="cat.simulado.borde" borderRadius="lg" fontSize="sm" data-testid="supuesto-lineal">
        <strong>Supuesto:</strong> {a.supuesto} El INA no publica pronósticos a más de {a.horizonte_pronostico_oficial_dias} días.
      </Box>
    </>
  );
}

export default function Monitor() {
  const { entrada } = useEscenario();
  const serie = useCarga(() => api.serie());
  const lluvia = useCarga(() => api.lluvia(60));
  const [alturaRef, setAlturaRef] = useState<number | undefined>(undefined);
  const ascenso = useCarga(() => api.ascenso(alturaRef), [alturaRef]);

  return (
    <>
      <CabeceraPagina titulo="Río y lluvia" icono={<IconoOlas tam="1.5rem" />} />
      <Seccion titulo="Puerto Formosa: serie diaria, umbrales y picos" categoria="DATO OBSERVADO" id="sec-serie">
        <Cargando carga={serie} hijos={(s) => <SerieYCifras s={s} />} />
      </Seccion>
      <Seccion titulo="Velocidad de ascenso y tiempo restante" categoria="DATO OBSERVADO" id="sec-ascenso" derecha={
        <Flex gap={2}>
          <Button size="xs" variant="outline" onClick={() => setAlturaRef(undefined)} isDisabled={alturaRef === undefined}>
            Usar la última lectura
          </Button>
          <Button size="xs" variant="outline" onClick={() => setAlturaRef(entrada.altura_formosa_m)} isDisabled={alturaRef === entrada.altura_formosa_m}>
            Usar la altura del simulador ({fmtM(entrada.altura_formosa_m)})
          </Button>
        </Flex>
      }>
        <Cargando carga={ascenso} hijos={(a) => <BloqueAscenso a={a} />} />
      </Seccion>
      <Seccion titulo="Lluvia por origen" id="sec-lluvia">
        <Cargando carga={lluvia} esVacio={(l) => l.n === 0} vacio="Sin dato observado en el kit y todavía no se cargó ningún parte. Cargá uno en la sección Lluvia." hijos={(l) => <TablaLluvia l={l} />} />
      </Seccion>
    </>
  );
}
