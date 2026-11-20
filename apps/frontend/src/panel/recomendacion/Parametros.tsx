import { Box, Button, FormControl, FormLabel, Input, SimpleGrid, Text } from "@chakra-ui/react";
import { useState, type ReactNode } from "react";

import { CampoSelect } from "../../components/Formulario";
import { Opcion } from "../../components/Opcion";
import type { PronosticoLluvia } from "../tipos";

export type Prioridad = "riesgo" | "poblacion";

function Grupo({ titulo, ayuda, children }: { titulo: string; ayuda?: ReactNode; children: ReactNode }) {
  return (
    <Box as="fieldset" minW={0} border="none" p={0} m={0}>
      <Text as="legend" textStyle="cuerpo" fontWeight={700} mb={ayuda ? 0.5 : 2} p={0}>
        {titulo}
      </Text>
      {ayuda && (
        <Text textStyle="microdato" mb={3}>
          {ayuda}
        </Text>
      )}
      {children}
    </Box>
  );
}

/** Lluvia prevista simulada para evaluar la ventana seca (opcional). */
function CampoPronostico({ valor, onCambio }: { valor: PronosticoLluvia | null; onCambio: (p: PronosticoLluvia | null) => void }) {
  const [activo, setActivo] = useState(valor !== null);
  const [mm, setMm] = useState(valor ? String(valor.mm) : "100");
  const [horas, setHoras] = useState(valor ? String(valor.horas) : "24");
  const nMm = Number(mm.replace(",", "."));
  const nHoras = Number(horas.replace(",", "."));
  const valido = nMm > 0 && nMm <= 1000 && nHoras > 0 && nHoras <= 720;

  function actualizar(a: boolean, m: number, h: number) {
    onCambio(a && m > 0 && m <= 1000 && h > 0 && h <= 720 ? { mm: m, horas: h } : null);
  }

  return (
    <Grupo
      titulo="Ventana seca: lluvia prevista"
      ayuda="Opcional. Si la lluvia deja intransitable el acceso de un sector (tierra desde 30 mm, ripio desde 80 mm, supuesto del equipo), su plazo pasa a ser la hora de esa lluvia. No es un pronóstico real."
    >
      <Opcion
        etiqueta="Simular lluvia prevista"
        isChecked={activo}
        onChange={(marcado) => {
          setActivo(marcado);
          actualizar(marcado, nMm, nHoras);
        }}
      />
      <SimpleGrid columns={2} spacing={3} mt={3}>
        <FormControl isDisabled={!activo} isInvalid={activo && !(nMm > 0 && nMm <= 1000)}>
          <FormLabel htmlFor="pron-mm">Milímetros</FormLabel>
          <Input
            id="pron-mm"
            bg="superficie"
            inputMode="decimal"
            value={mm}
            onChange={(e) => {
              setMm(e.target.value);
              actualizar(activo, Number(e.target.value.replace(",", ".")), nHoras);
            }}
          />
        </FormControl>
        <FormControl isDisabled={!activo} isInvalid={activo && !(nHoras > 0 && nHoras <= 720)}>
          <FormLabel htmlFor="pron-horas">Dentro de (horas)</FormLabel>
          <Input
            id="pron-horas"
            bg="superficie"
            inputMode="decimal"
            value={horas}
            onChange={(e) => {
              setHoras(e.target.value);
              actualizar(activo, nMm, Number(e.target.value.replace(",", ".")));
            }}
          />
        </FormControl>
      </SimpleGrid>
      {activo && !valido && (
        <Text textStyle="microdato" color="evacuacion.700" fontWeight={600} mt={2} role="alert">
          Indicá entre 0 y 1.000 mm y entre 0 y 720 horas (mayores que cero).
        </Text>
      )}
    </Grupo>
  );
}

/**
 * Parámetros de la recomendación: prioridad, lluvia prevista y criterio de familias. En pantallas angostas se pliegan
 * (siguen montados, así que no pierden lo escrito); el botón de generar queda siempre a la vista.
 */
export function Parametros({
  prioridad,
  onPrioridad,
  pronostico,
  onPronostico,
  hogares,
  onHogares,
  plegado,
  onAlternarPlegado,
}: {
  prioridad: Prioridad;
  onPrioridad: (p: Prioridad) => void;
  pronostico: PronosticoLluvia | null;
  onPronostico: (p: PronosticoLluvia | null) => void;
  hogares: boolean;
  onHogares: (h: boolean) => void;
  plegado: boolean;
  onAlternarPlegado: () => void;
}) {
  return (
    <Box>
      <Button display={{ base: "inline-flex", md: "none" }} variant="outline" w="100%" justifyContent="space-between" aria-expanded={!plegado} aria-controls="reco-parametros" onClick={onAlternarPlegado}>
        Parámetros{plegado ? " (mostrar)" : " (ocultar)"}
      </Button>
      <Box id="reco-parametros" display={{ base: plegado ? "none" : "block", md: "block" }} mt={{ base: 4, md: 0 }}>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={{ base: 6, md: 8 }}>
          <Grupo titulo="Prioridad de los sectores" ayuda="Qué sector se evacua primero en el plan.">
            <CampoSelect id="reco-prioridad" etiqueta="Orden de los sectores" value={prioridad} onChange={(e) => onPrioridad(e.target.value as Prioridad)}>
              <option value="riesgo">Por riesgo (menor margen primero)</option>
              <option value="poblacion">Por población (más personas primero)</option>
            </CampoSelect>
          </Grupo>
          <CampoPronostico valor={pronostico} onCambio={onPronostico} />
          <Grupo
            titulo="Familias"
            ayuda="El plan nunca separa a una familia: viaja y se aloja entera. Si no entra en ningún centro, se avisa y decide una persona con rol autorizado. La población de los sectores de evaluación (K10) no tiene hogares: para probar el criterio se puede usar un set separado de hogares simulados (tamaños: supuesto del equipo)."
          >
            <Opcion etiqueta="Usar hogares simulados en los sectores de evaluación (K10)" isChecked={hogares} onChange={onHogares} />
          </Grupo>
        </SimpleGrid>
      </Box>
    </Box>
  );
}
