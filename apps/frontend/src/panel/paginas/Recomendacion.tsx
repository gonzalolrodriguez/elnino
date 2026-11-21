import { Alert, AlertIcon, Box, Button, Flex, SimpleGrid, Text } from "@chakra-ui/react";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import { AlertaError } from "../../components/Formulario";
import { etiquetaOrigenLluvia } from "../../lib/etiquetas";
import { IconoMira } from "../../components/iconos/Iconos";
import { api } from "../api";
import { CabeceraPagina } from "../CabeceraPagina";
import { useEscenario } from "../EscenarioContext";
import { Comparador } from "../recomendacion/Comparador";
import { LineaFactibilidad } from "../recomendacion/Factibilidad";
import { fmtValor, NOMBRE_VEREDICTO } from "../recomendacion/formato";
import { Dato, Plegable } from "../recomendacion/piezas";
import { type Prioridad, Parametros } from "../recomendacion/Parametros";
import { ResumenPlan } from "../recomendacion/ResumenPlan";
import { TarjetaSector } from "../recomendacion/TarjetaSector";
import type { PronosticoLluvia, Recomendacion } from "../tipos";
import { fmtM, fmtNum, Seccion } from "../ui";

// Se reexportan para quien ya los importaba desde esta página.
export { fmtValor, LineaFactibilidad, NOMBRE_VEREDICTO };

/** Escenario vigente (se cambia en Mapa y simulador) y parámetros de la recomendación, con el botón de generar. */
function BloqueEscenario({
  prioridad,
  onPrioridad,
  pronostico,
  onPronostico,
  hogares,
  onHogares,
  cargando,
  onGenerar,
}: {
  prioridad: Prioridad;
  onPrioridad: (p: Prioridad) => void;
  pronostico: PronosticoLluvia | null;
  onPronostico: (p: PronosticoLluvia | null) => void;
  hogares: boolean;
  onHogares: (h: boolean) => void;
  cargando: boolean;
  onGenerar: () => void;
}) {
  const { entrada } = useEscenario();
  const [plegado, setPlegado] = useState(false);
  return (
    <Seccion
      titulo="Escenario y parámetros"
      categoria="SIMULADO"
      id="sec-escenario"
      derecha={
        <Button as={RouterLink} to="/comando/mapa" variant="link" minH="2.75rem" textDecoration="underline" fontWeight={600}>
          Cambiar en Mapa y simulador
        </Button>
      }
    >
      <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4} mb={5} pb={5} borderBottom="1px solid" borderColor="borde" data-testid="escenario-resumen">
        <Dato etiqueta="Altura del río en Puerto Formosa" valor={fmtM(entrada.altura_formosa_m)} />
        <Dato etiqueta="Lluvia del escenario" valor={`${fmtNum(entrada.lluvia_mm)} mm`} nota={etiquetaOrigenLluvia(entrada.lluvia_origen)} />
        <Dato etiqueta="Caminos cerrados" valor={fmtNum(entrada.caminos_cerrados.length)} />
      </SimpleGrid>
      <Parametros prioridad={prioridad} onPrioridad={onPrioridad} pronostico={pronostico} onPronostico={onPronostico} hogares={hogares} onHogares={onHogares} plegado={plegado} onAlternarPlegado={() => setPlegado((p) => !p)} />
      <Button
        mt={5}
        w={{ base: "100%", md: "auto" }}
        onClick={() => {
          setPlegado(true);
          onGenerar();
        }}
        isLoading={cargando}
      >
        Generar recomendación
      </Button>
    </Seccion>
  );
}

function BloqueResultado({ r }: { r: Recomendacion | null }) {
  const ids = r?.recomendacion.sectores.map((s) => s.id) ?? [];
  return (
    <Seccion titulo="Recomendación por sector" categoria={r?.categoria ?? "SIMULADO"} id="sec-reco">
      {!r ? (
        <Text color="textoSuave" maxW="70ch">
          Todavía no hay recomendación. Revisá el escenario y los parámetros y tocá «Generar recomendación».
        </Text>
      ) : (
        <Box data-testid="recomendacion">
          <Flex justify="space-between" align="flex-start" gap={3} wrap="wrap" mb={4}>
            <Box maxW="52ch">
              <Text fontWeight={600}>{r.etiqueta}</Text>
              {ids.length > 0 && (
                <Text textStyle="microdato">
                  Preparar orden solo precarga el formulario de Órdenes ({ids.join(", ")}): la emite una persona con rol de decisor.
                </Text>
              )}
            </Box>
            {ids.length > 0 && (
              <Button as={RouterLink} to={`/comando/ordenes?sectores=${ids.join(",")}`} w={{ base: "100%", md: "auto" }}>
                Preparar orden con estos sectores
              </Button>
            )}
          </Flex>
          <ResumenPlan p={r.recomendacion} />
          {ids.length === 0 ? (
            <Alert status="success" mt={4}>
              <AlertIcon />
              Ningún sector está comprometido ni en riesgo con estos valores: no hay nada que recomendar evacuar.
            </Alert>
          ) : (
            <Flex direction="column" gap={4} mt={5}>
              {r.recomendacion.sectores.map((s) => (
                <TarjetaSector key={s.id} s={s} />
              ))}
            </Flex>
          )}
          {r.limites.length > 0 && (
            <Plegable mt={5} resumen="Límites de esta recomendación">
              <Flex as="ul" direction="column" gap={1.5} listStyleType="disc" pl={4} color="textoSuave">
                {r.limites.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </Flex>
            </Plegable>
          )}
        </Box>
      )}
    </Seccion>
  );
}

export default function PaginaRecomendacion() {
  const { entrada } = useEscenario();
  const [pronostico, setPronostico] = useState<PronosticoLluvia | null>(null);
  const [hogares, setHogares] = useState(false);
  const [prioridad, setPrioridad] = useState<Prioridad>("riesgo");
  const [r, setR] = useState<Recomendacion | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [cargando, setCargando] = useState(false);

  async function generar() {
    setCargando(true);
    setError(null);
    try {
      setR(await api.recomendacion(entrada, prioridad, pronostico ?? undefined, hogares));
    } catch (e) {
      setError(e);
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <CabeceraPagina
        titulo="Recomendación y alternativas"
        icono={<IconoMira tam="1.5rem" />}
        ayuda={
          <span data-testid="etiqueta-recomendacion">
            Se recomienda; no es una orden. La orden la emite una persona con rol de decisor (
            <RouterLink to="/comando/ordenes" style={{ textDecoration: "underline" }}>
              sección Órdenes
            </RouterLink>
            ) y queda registrada.
          </span>
        }
      />
      <BloqueEscenario
        prioridad={prioridad}
        onPrioridad={setPrioridad}
        pronostico={pronostico}
        onPronostico={setPronostico}
        hogares={hogares}
        onHogares={setHogares}
        cargando={cargando}
        onGenerar={() => void generar()}
      />
      <AlertaError error={error} />
      <BloqueResultado r={r} />
      <Comparador pronostico={pronostico} hogares={hogares} />
    </>
  );
}
