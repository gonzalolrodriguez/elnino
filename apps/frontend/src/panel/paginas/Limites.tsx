import { Alert, AlertIcon, List, ListItem, Text } from "@chakra-ui/react";

import { LIMITES_ESTATICOS } from "../../datos/kit";
import { useMeta } from "../../lib/useMeta";
import { IconoInfo } from "../../components/iconos/Iconos";
import { CabeceraPagina } from "../CabeceraPagina";
import { fmtFecha, Seccion } from "../ui";

/** Panel «Límites» (CLAUDE.md §3, regla 7): lo que el kit no tiene y lo que la plataforma no puede decir. */
export default function Limites() {
  const m = useMeta();
  const limites = m.estado === "ok" ? m.meta.limites : LIMITES_ESTATICOS;
  return (
    <>
      <CabeceraPagina
        titulo="Límites de los datos y de la herramienta"
        icono={<IconoInfo tam="1.5rem" />}
        ayuda="Lo que el kit no trae y lo que esta herramienta no puede afirmar. Leelo antes de apoyarte en una cifra."
      />
      {m.estado === "error" && (
        <Alert status="warning" mb={4}>
          <AlertIcon />
          El servicio no respondió: se muestra la lista incluida en la aplicación.
        </Alert>
      )}
      <Seccion titulo="Lo que el kit no tiene" id="sec-limites">
        <List styleType="disc" pl={5} spacing={2} maxW="70ch" data-testid="lista-limites">
          {limites.map((l) => (
            <ListItem key={l}>{l}</ListItem>
          ))}
        </List>
        <Text textStyle="microdato" mt={4} maxW="70ch">
          Corte de datos: {m.estado === "ok" ? fmtFecha(m.meta.fecha_corte) : "31/10/2026"}. Lo posterior solo se muestra por decisión de la mesa.
          {m.estado === "ok" && m.meta.flags.permitir_datos_post_corte ? " Los datos posteriores al corte están habilitados en este servidor." : " Los datos posteriores al corte están apagados."}
        </Text>
      </Seccion>
      <Seccion titulo="Cómo leer lo que muestra el panel" id="sec-lectura">
        <List styleType="disc" pl={5} spacing={2} maxW="70ch">
          <ListItem>Cada cifra, serie, umbral o capa lleva su categoría: DATO OBSERVADO, DOCUMENTO DE REFERENCIA o SIMULADO.</ListItem>
          <ListItem>Los sectores de evaluación, los accesos, los centros y su capacidad, las personas, los recursos y la lluvia de demostración son SIMULADO.</ListItem>
          <ListItem>Las proyecciones son lineales (SUPUESTO) y se dan como rango; no son pronósticos.</ListItem>
          <ListItem>La plataforma recomienda y simula. Decidir una evacuación, definir recorridos y disponer recursos corresponde a las autoridades; la orden la emite una persona con rol autorizado y queda en la bitácora.</ListItem>
        </List>
      </Seccion>
    </>
  );
}
