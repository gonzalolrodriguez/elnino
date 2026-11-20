import { Box, Button, Checkbox, Flex, FormControl, FormLabel, Heading, Input, Select, SimpleGrid, Text } from "@chakra-ui/react";
import { useState, type ReactNode } from "react";

import type { PronosticoLluvia } from "../tipos";

export type Prioridad = "riesgo" | "poblacion";

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Box as="fieldset" minW={0} border="none" p={0} m={0}>
      <Heading as="legend" size="xs" mb={2} p={0}>
        {titulo}
      </Heading>
      {children}
    </Box>
  );
}

/** Lluvia prevista SIMULADA para evaluar la ventana seca (opcional). */
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
    <Grupo titulo="Ventana seca: lluvia prevista">
      <Text textStyle="microdato" mb={2}>
        Opcional. Si la lluvia deja intransitable el acceso de un sector (tierra desde 30 mm, ripio desde 80 mm, SUPUESTO), su plazo pasa a ser la hora de esa lluvia. No es un pronóstico real.
      </Text>
      <Checkbox
        size="md"
        isChecked={activo}
        onChange={(e) => {
          setActivo(e.target.checked);
          actualizar(e.target.checked, nMm, nHoras);
        }}
      >
        Simular lluvia prevista
      </Checkbox>
      <Flex gap={3} mt={3}>
        <FormControl isDisabled={!activo} isInvalid={activo && !(nMm > 0 && nMm <= 1000)}>
          <FormLabel htmlFor="pron-mm" fontSize="sm" mb={1}>
            Milímetros
          </FormLabel>
          <Input
            id="pron-mm"
            size="sm"
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
          <FormLabel htmlFor="pron-horas" fontSize="sm" mb={1}>
            Dentro de (horas)
          </FormLabel>
          <Input
            id="pron-horas"
            size="sm"
            bg="superficie"
            inputMode="decimal"
            value={horas}
            onChange={(e) => {
              setHoras(e.target.value);
              actualizar(activo, nMm, Number(e.target.value.replace(",", ".")));
            }}
          />
        </FormControl>
      </Flex>
      {activo && !valido && (
        <Text fontSize="xs" color="umbral.textoEvacuacion" mt={1} role="alert">
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
      <Button display={{ base: "inline-flex", md: "none" }} variant="outline" size="sm" minH="2.75rem" w="100%" justifyContent="space-between" aria-expanded={!plegado} aria-controls="reco-parametros" onClick={onAlternarPlegado}>
        Parámetros{plegado ? " (mostrar)" : " (ocultar)"}
      </Button>
      <Box id="reco-parametros" display={{ base: plegado ? "none" : "block", md: "block" }} mt={{ base: 4, md: 0 }}>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={{ base: 5, md: 6 }}>
          <Grupo titulo="Prioridad de los sectores">
            <FormControl>
              <FormLabel htmlFor="reco-prioridad" fontSize="sm" mb={1}>
                Orden
              </FormLabel>
              <Select id="reco-prioridad" size="sm" bg="superficie" value={prioridad} onChange={(e) => onPrioridad(e.target.value as Prioridad)}>
                <option value="riesgo">Por riesgo (menor margen primero)</option>
                <option value="poblacion">Por población (más personas primero)</option>
              </Select>
            </FormControl>
          </Grupo>
          <CampoPronostico valor={pronostico} onCambio={onPronostico} />
          <Grupo titulo="Familias">
            <Text textStyle="microdato" mb={2}>
              El plan nunca separa a una familia: viaja y se aloja entera. Si no entra en ningún centro, se avisa y decide una persona con rol autorizado. La población de K10 no tiene hogares; para probar el criterio se puede usar un set separado de hogares SIMULADOS (tamaños SUPUESTO).
            </Text>
            <Checkbox size="md" isChecked={hogares} onChange={(e) => onHogares(e.target.checked)}>
              Usar hogares SIMULADOS para la población de K10
            </Checkbox>
          </Grupo>
        </SimpleGrid>
      </Box>
    </Box>
  );
}
