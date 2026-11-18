import { Box, Flex, Text } from "@chakra-ui/react";

import { Insignia } from "../components/Insignia";
import { EXAGERACION_VERTICAL, fmtM, marcasLeyenda, type MetaRelieve } from "./datos";

const ROTULAR = [60, 100, 200, 300, 500];

/**
 * Leyenda de la planialtimetría de la cuenca: rampa de altitud con los extremos reales del área,
 * intervalo de las curvas de nivel, exageración vertical, fuente y categoría. Sirve a la escena 3D y
 * al respaldo 2D (mismos datos, mismo texto). Compacta: el detalle de fuentes va en un desplegable.
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
      bg="limo.900"
      color="pizarra.100"
      px={3}
      py={2}
      borderRadius="sm"
      w="17rem"
      maxW="100%"
      fontSize="11px"
      lineHeight={1.35}
      m={0}
    >
      <Text as="figcaption" fontWeight={700} fontSize="xs" mb={1}>
        Altitud (m sobre el nivel del mar)
      </Text>
      <Box h="9px" borderRadius="1px" style={{ background: degradado }} aria-hidden="true" />
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
      <Text fontWeight={600}>
        {vista === "3d"
          ? `Exageración vertical ×${EXAGERACION_VERTICAL} (desniveles ampliados ${EXAGERACION_VERTICAL} veces)`
          : `Exageración vertical: ninguna en esta vista en planta (la escena 3D usa ×${EXAGERACION_VERTICAL})`}
      </Text>
      <Flex gap={2} align="center" wrap="wrap" mt={1}>
        <Insignia categoria="DOCUMENTO DE REFERENCIA" onDark />
        <Text as="span">Descarga {meta.fecha_descarga}</Text>
      </Flex>
      <details style={{ marginTop: 4 }}>
        <summary style={{ cursor: "pointer", color: "inherit" }}>Fuentes y límites</summary>
        <Text mt={1} color="pizarra.300">
          Relieve: AWS Terrain Tiles (SRTM y otras fuentes), celdas de ~1 km y error vertical de varios metros. Río Paraguay: Natural Earth 1:10M.
          Límites: IGN. No sirve para cotas de inundación.
        </Text>
      </details>
    </Box>
  );
}
