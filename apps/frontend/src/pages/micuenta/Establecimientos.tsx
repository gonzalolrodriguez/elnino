import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import { CATEGORIAS } from "@evacuaciones/shared";
import type { ReactElement } from "react";

import { IconoEdificio, IconoMascota, IconoPunto, IconoTilde } from "../../components/iconos/Iconos";
import { Insignia } from "../../components/Insignia";
import type { Dic } from "./Avisos";
import { Dato, RejillaDatos } from "./Panel";

type Stock = { especie: string; categoria_animal: string; cantidad: number };

/** Nombre llano de cada especie del vocabulario cerrado del servidor (singular, plural). */
const ESPECIE: Record<string, [string, string]> = {
  bovino: ["bovino", "bovinos"],
  ovino: ["ovino", "ovinos"],
  caprino: ["caprino", "caprinos"],
  porcino: ["porcino", "porcinos"],
  equino: ["equino", "equinos"],
  apicultura: ["colmena", "colmenas"],
};

const stockDe = (e: Dic): Stock[] =>
  Array.isArray(e.stock)
    ? (e.stock as Dic[])
        .filter((s) => typeof s.cantidad === "number")
        .map((s) => ({ especie: String(s.especie ?? ""), categoria_animal: String(s.categoria_animal ?? ""), cantidad: Number(s.cantidad) }))
    : [];

const sumar = (lista: Stock[], f: (s: Stock) => boolean) => lista.filter(f).reduce((n, s) => n + s.cantidad, 0);

/** Rótulo de una línea de stock: la categoría que cargó el productor («Vaca con cría»); sin categoría, la especie. */
function rotuloStock(s: Stock): string {
  const [singular, plural] = ESPECIE[s.especie] ?? [s.especie, s.especie];
  const nombre = s.categoria_animal.trim() || (s.cantidad === 1 ? singular : plural);
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

function Rotulo({ icono, children }: { icono: ReactElement; children: string }) {
  return (
    <Flex as="span" align="center" gap={1.5} px={3} py={1} borderRadius="full" bg="limo.50" color="limo.800" fontSize="sm" fontWeight={600} minW={0}>
      <Box aria-hidden="true" display="flex" flex="none">
        {icono}
      </Box>
      <span>{children}</span>
    </Flex>
  );
}

/**
 * Establecimientos del productor con la misma estructura que «Mi grupo familiar»: cifras arriba, una tarjeta por
 * establecimiento con su sector, su acceso y su stock. El sector es SIMULADO (una sola insignia para el bloque).
 */
export function Establecimientos({ lista }: { lista: Dic[] }) {
  const todos = lista.flatMap(stockDe);
  const bovinos = sumar(todos, (s) => s.especie === "bovino");
  const colmenas = sumar(todos, (s) => s.especie === "apicultura");
  const otros = sumar(todos, (s) => s.especie !== "bovino" && s.especie !== "apicultura");
  const hayStock = todos.length > 0;
  const hayRotuloSector = lista.some((e) => e.sector_id !== undefined && e.sector_id !== null);
  return (
    <Box data-testid="establecimientos">
      <RejillaDatos>
        <Dato icono={<IconoEdificio tam="1.5rem" />} valor={lista.length} rotulo={lista.length === 1 ? "Establecimiento" : "Establecimientos"} />
        <Dato icono={<IconoMascota tam="1.5rem" />} valor={hayStock ? bovinos : null} rotulo="Bovinos" />
        <Dato icono={<IconoMascota tam="1.5rem" />} valor={hayStock ? otros : null} rotulo="Otros animales" />
        <Dato icono={<IconoPunto tam="1.5rem" />} valor={hayStock ? colmenas : null} rotulo="Colmenas" />
      </RejillaDatos>
      {hayRotuloSector && (
        <Flex align="center" gap={2} mt={5} fontSize="sm">
          <span>Sector de cada establecimiento</span>
          <Insignia categoria={CATEGORIAS.SIMULADO} />
        </Flex>
      )}
      <Box as="ul" listStyleType="none" m={0} p={0} mt={4} display="grid" gap={3}>
        {lista.map((e, i) => {
          const stock = stockDe(e);
          return (
            <Box as="li" key={String(e.id ?? i)} border="1px solid" borderColor="borde" borderRadius="xl" p={4} bg="fondo">
              <Flex align="center" justify="space-between" gap={3} wrap="wrap" mb={2}>
                <Heading as="h3" size="sm" minW={0} overflowWrap="anywhere">
                  {String(e.nombre ?? "Establecimiento")}
                </Heading>
                {e.sector_id !== undefined && e.sector_id !== null && (
                  <Flex as="span" align="center" gap={1.5} px={2.5} py="2px" borderRadius="full" bg="agua.100" color="agua.800" fontSize="sm" fontWeight={600}>
                    <IconoTilde tam="1rem" strokeWidth={2.25} />
                    Sector {String(e.sector_id)}
                  </Flex>
                )}
              </Flex>
              <Flex gap={2} wrap="wrap" mb={stock.length > 0 ? 3 : 0}>
                {typeof e.renspa === "string" && e.renspa && <Rotulo icono={<IconoEdificio tam="1rem" />}>{`RENSPA ${e.renspa}`}</Rotulo>}
                {typeof e.acceso_habitual === "string" && e.acceso_habitual && <Rotulo icono={<IconoPunto tam="1rem" />}>{`Acceso: ${e.acceso_habitual}`}</Rotulo>}
              </Flex>
              {stock.length > 0 ? (
                <Box as="ul" listStyleType="none" m={0} p={0} display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }} columnGap={6} rowGap={1}>
                  {stock.map((s, j) => (
                    <Flex as="li" key={j} justify="space-between" gap={3} py={1} borderBottom="1px solid" borderColor="borde" sx={{ fontVariantNumeric: "tabular-nums" }}>
                      <span>{rotuloStock(s)}</span>
                      <strong>{s.cantidad.toLocaleString("es-AR")}</strong>
                    </Flex>
                  ))}
                </Box>
              ) : (
                <Text textStyle="microdato" mt={2}>
                  Todavía no cargaste los animales de este establecimiento.
                </Text>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
