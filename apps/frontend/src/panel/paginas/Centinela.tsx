import { Box, Flex, List, ListItem, Table, Tbody, Td, Text, Th, Thead, Tr } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { Insignia } from "../../components/Insignia";
import { TablaDesplazable } from "../../components/TablaDesplazable";
import { AUDITORIA_K1 } from "../../datos/auditoriaK1";
import { etiquetaCodigo } from "../../lib/etiquetas";
import { useCarga } from "../../lib/useCarga";
import { IconoAlerta, IconoEscudo, IconoInfo, IconoTilde } from "../../components/iconos/Iconos";
import { api } from "../api";
import { CabeceraPagina } from "../CabeceraPagina";
import { APILAR, Cargando, categoriaComun, Chip, Cifra, fmtNum, Seccion, type TonoChip } from "../ui";

/** Veredicto de la API: tono e ícono propios, para que no dependa solo del color. */
function aspectoVeredicto(v: string): { tono: TonoChip; icono: ReactNode } {
  if (v.startsWith("REFUTADA") || v === "FALSA") return { tono: "alerta", icono: <IconoAlerta tam="1em" /> };
  if (v.startsWith("RESPALDADA") || v === "VERDADERA") return { tono: "ok", icono: <IconoTilde tam="1em" /> };
  return { tono: "neutro", icono: <IconoInfo tam="1em" /> };
}

function Veredicto({ v }: { v: string }) {
  const a = aspectoVeredicto(v);
  return (
    <Chip tono={a.tono} icono={a.icono} whiteSpace="normal" textAlign="left">
      {v}
    </Chip>
  );
}

/** Nombre llano de una fuente o documento del kit: "K6_informe_IA.pdf" y "K6" pasan a "Informe de inteligencia artificial (K6)". */
function nombreLlano(texto: string): string {
  const m = /^(K\d+)(?:[_.\s-][\w.\s-]*)?$/i.exec(texto.trim());
  return m ? etiquetaCodigo(m[1]) : texto;
}

const entero = (re: RegExp, texto: string): number | null => {
  const m = re.exec(texto);
  return m ? Number(m[1]) : null;
};

/** Cifras de la auditoría de K1, sacadas del mismo resumen que la tabla para que no haya dos fuentes. */
const FILAS_RECIBIDAS = entero(/\((\d+) filas/, AUDITORIA_K1.entrada);
const REGISTROS_FINALES = entero(/^(\d+)/, AUDITORIA_K1.salida);
const EN_CUARENTENA = entero(/(\d+) en cuarentena/, AUDITORIA_K1.salida);

export default function Centinela() {
  const k6 = useCarga(() => api.k6());
  const k7 = useCarga(() => api.k7());
  const catK6 = k6.estado === "ok" ? categoriaComun(k6.datos.afirmaciones.map((a) => a.categoria)) : undefined;
  const catK7 = k7.estado === "ok" ? categoriaComun(k7.datos.relaciones.map((r) => r.categoria)) : undefined;
  return (
    <>
      <CabeceraPagina
        titulo="Auditoría de datos (Centinela)"
        icono={<IconoEscudo tam="1.5rem" />}
        ayuda="Qué se corrigió en la serie del río y qué afirmaciones del informe de inteligencia artificial y del esquema de ríos se sostienen con los datos."
      />

      <Seccion titulo={`Limpieza de la ${etiquetaCodigo("K1", { conCodigo: false }).toLowerCase()} (K1)`} categoria="DATO OBSERVADO" id="sec-k1">
        <Flex gap={5} wrap="wrap" mb={4}>
          {FILAS_RECIBIDAS !== null && <Cifra etiqueta="Filas recibidas" valor={fmtNum(FILAS_RECIBIDAS)} categoria="DATO OBSERVADO" omitirCategoria />}
          {REGISTROS_FINALES !== null && <Cifra etiqueta="Registros finales" valor={fmtNum(REGISTROS_FINALES)} categoria="DATO OBSERVADO" omitirCategoria />}
          {EN_CUARENTENA !== null && <Cifra etiqueta="En cuarentena" valor={fmtNum(EN_CUARENTENA)} categoria="DATO OBSERVADO" omitirCategoria />}
        </Flex>
        <Text maxW="70ch" mb={3}>
          El archivo original no se modifica: cada corrección genera una serie nueva y queda anotada.
        </Text>
        <TablaDesplazable etiqueta="Hallazgos de la limpieza de la serie histórica">
          <Table size="sm" aria-label="Hallazgos de la limpieza de la serie histórica" sx={APILAR}>
            <Thead>
              <Tr>
                <Th>Problema</Th>
                <Th>Registros</Th>
                <Th>Tratamiento</Th>
              </Tr>
            </Thead>
            <Tbody>
              {AUDITORIA_K1.hallazgos.map((h) => (
                <Tr key={h.problema}>
                  <Td whiteSpace="normal">{h.problema}</Td>
                  <Td whiteSpace="normal" data-etiqueta="Registros">
                    {h.cantidad}
                  </Td>
                  <Td whiteSpace="normal" data-etiqueta="Tratamiento">
                    {h.tratamiento}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TablaDesplazable>
        <Text textStyle="rotulo" mt={4} mb={1}>
          Controles de la serie limpia
        </Text>
        <List styleType="disc" pl={5} spacing={1} maxW="70ch">
          {AUDITORIA_K1.controles.map((c) => (
            <ListItem key={c}>{c}</ListItem>
          ))}
        </List>
        <Text textStyle="microdato" mt={3} maxW="70ch">
          La serie conserva alteraciones pedagógicas deliberadas: no es oficial ni apta para decisiones operativas.
        </Text>
      </Seccion>

      <Seccion titulo={`Verificador del ${etiquetaCodigo("K6", { conCodigo: false }).toLowerCase()} (K6)`} categoria={catK6} sinCategoria={!catK6} id="sec-k6">
        <Cargando
          carga={k6}
          esVacio={(d) => d.afirmaciones.length === 0}
          vacio="No hay afirmaciones para verificar."
          hijos={(d) => (
            <>
              <Text maxW="70ch" mb={4}>
                {nombreLlano(d.informe)}. {d.nota}
              </Text>
              <List>
                {d.afirmaciones.map((a, i) => (
                  <ListItem key={a.id} py={3} borderTop="1px solid" borderColor="borde" _first={{ borderTop: "none", pt: 0 }} data-testid={`k6-${a.id}`}>
                    <Flex align="center" columnGap={3} rowGap={1.5} wrap="wrap" mb={1}>
                      <Text as="span" fontWeight={700}>
                        Afirmación {i + 1}
                      </Text>
                      <Veredicto v={a.veredicto} />
                      {!catK6 && <Insignia categoria={a.categoria} />}
                    </Flex>
                    <Text fontWeight={600} maxW="70ch">
                      {a.afirmacion}
                    </Text>
                    <Text maxW="70ch">{a.evidencia}</Text>
                    <Text textStyle="microdato" mt={0.5}>
                      Fuente: {nombreLlano(a.fuente)}
                    </Text>
                  </ListItem>
                ))}
              </List>
            </>
          )}
        />
      </Seccion>

      <Seccion titulo={`Verificador de la ${etiquetaCodigo("K7", { conCodigo: false }).toLowerCase()} (K7)`} categoria={catK7} sinCategoria={!catK7} id="sec-k7">
        <Cargando
          carga={k7}
          esVacio={(d) => d.relaciones.length === 0}
          vacio="No hay relaciones para verificar."
          hijos={(d) => (
            <>
              <Text maxW="70ch" mb={4}>
                {nombreLlano(d.esquema)}. {d.nota}
              </Text>
              <List>
                {d.relaciones.map((r, i) => (
                  <ListItem key={r.id} py={3} borderTop="1px solid" borderColor="borde" _first={{ borderTop: "none", pt: 0 }} data-testid={`k7-${r.id}`}>
                    <Flex align="center" columnGap={3} rowGap={1.5} wrap="wrap" mb={1}>
                      <Text as="span" fontWeight={700}>
                        Relación {i + 1}
                      </Text>
                      <Veredicto v={r.veredicto} />
                      {!catK7 && <Insignia categoria={r.categoria} />}
                    </Flex>
                    <Text fontWeight={600} maxW="70ch">
                      {r.relacion}
                    </Text>
                    <Text maxW="70ch">
                      {r.correccion}
                      {r.evidencia_cartografica ? ` ${r.evidencia_cartografica}` : ""}
                    </Text>
                    <Box textStyle="microdato" mt={0.5}>
                      <Text as="span">Verificado con: {r.verificado_con}.</Text> <Text as="span">Fuente: {nombreLlano(r.fuente)}.</Text>
                    </Box>
                  </ListItem>
                ))}
              </List>
            </>
          )}
        />
      </Seccion>
    </>
  );
}
