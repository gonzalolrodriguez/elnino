import { Box, Flex, Text } from "@chakra-ui/react";

import { Insignia } from "../components/Insignia";
import { fechaLarga } from "../datos/kit";
import { Plegable } from "../components/Plegable";
import { EXAGERACION_VERTICAL, fmtM, marcasLeyenda, type MetaRelieve } from "./datos";

const ROTULAR = [60, 100, 200, 300, 500];

/**
 * Leyenda de la planialtimetría de la cuenca. Siempre visible: la nota de "esquema ilustrativo", la exageración vertical
 * y la categoría. Plegado: rampa de altitud con los extremos reales del área, intervalo de curvas de nivel y fuentes.
 * Sirve a la escena 3D y al respaldo 2D (mismos datos, mismo texto).
 */
export function LeyendaRelieve({ meta, vista }: { meta: MetaRelieve; vista: "3d" | "2d" }) {
  const c = meta.cuenca;
  const marcas = marcasLeyenda(c.rampa, c.min_m, c.max_m, ROTULAR);
  const degradado = `linear-gradient(90deg, ${marcas.map((m) => `${m.color} ${(m.pos * 100).toFixed(1)}%`).join(", ")})`;
  const rotulos = marcas.filter((m) => m.rotulo);
  return (
    <Box
      as="figure"
      data-testid="leyenda-relieve"
      className="sobre-oscuro"
      bg="rgba(14,27,44,0.72)"
      color="oscuro.suave"
      px={3.5}
      py={1}
      borderRadius="xl"
      w="19rem"
      maxW="100%"
      fontSize="xs"
      lineHeight={1.45}
      m={0}
      style={{ backdropFilter: "blur(8px)" }}
    >
      <Text as="figcaption" fontWeight={600} color="oscuro.fg" pt={1.5}>
        Esquema ilustrativo, no a escala cartográfica
      </Text>
      <Text fontWeight={400}>
        {vista === "3d"
          ? `Exageración vertical ×${EXAGERACION_VERTICAL} (desniveles ampliados ${EXAGERACION_VERTICAL} veces)`
          : `Exageración vertical: ninguna en esta vista en planta (la escena 3D usa ×${EXAGERACION_VERTICAL})`}
      </Text>
      <Flex gap={2} align="center" wrap="wrap" mt={1.5}>
        <Insignia categoria="DOCUMENTO DE REFERENCIA" onDark />
        <Text as="span">Descarga {fechaLarga(meta.fecha_descarga)}</Text>
      </Flex>
      <Plegable titulo={<span style={{ fontSize: "0.75rem" }}>Leyenda de altitud y fuentes</span>} tono="oscuro">
        <Box pb={2}>
          <Text fontWeight={600} color="oscuro.fg" mb={1}>
            Altitud (m sobre el nivel del mar)
          </Text>
          <Box h="9px" borderRadius="full" style={{ background: degradado }} aria-hidden="true" />
          <Box position="relative" h="14px" aria-hidden="true">
            {rotulos.map((m, i) => (
              <Text
                as="span"
                key={m.valor}
                position="absolute"
                top="1px"
                left={`${m.pos * 100}%`}
                transform={i === 0 ? "none" : i === rotulos.length - 1 ? "translateX(-100%)" : "translateX(-50%)"}
              >
                {fmtM(m.valor)}
              </Text>
            ))}
          </Box>
          <Text>
            Área: de {fmtM(c.min_m)} a {fmtM(c.max_m)} m. Curvas de nivel cada {c.intervalo} (línea gruesa: curvas maestras).
          </Text>
          <Text mt={1.5}>
            Relieve: AWS Terrain Tiles (SRTM y otras fuentes), celdas de ~1 km y error vertical de varios metros. Río Paraguay: Natural Earth 1:10M. Límites: IGN. En la escena se agrega
            sombreado de luz. No sirve para cotas de inundación.
          </Text>
        </Box>
      </Plegable>
    </Box>
  );
}
