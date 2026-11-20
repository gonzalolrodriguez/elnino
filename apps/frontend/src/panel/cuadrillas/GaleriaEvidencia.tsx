import { Box, Flex, Link, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { adjuntoParte } from "../api";
import type { AdjuntoParte } from "../tipos";

export const esVideo = (tipo: string): boolean => /video|mp4/i.test(tipo);

/**
 * Evidencia multimedia de un parte. Las fotos y el video se piden con la sesión (llevan token) y se muestran como
 * recursos locales; las fotos se abren a tamaño completo en otra pestaña y el video se reproduce en el lugar.
 */
export function GaleriaEvidencia({ tareaId, parteId, adjuntos }: { tareaId: number; parteId: number; adjuntos: AdjuntoParte[] }) {
  const [urls, setUrls] = useState<Record<number, string>>({});
  const [fallidas, setFallidas] = useState<number[]>([]);
  const clave = adjuntos.map((a) => a.n).join(",");

  useEffect(() => {
    let activo = true;
    const creadas: string[] = [];
    for (const a of adjuntos) {
      adjuntoParte(tareaId, parteId, a.n)
        .then((b) => {
          const u = URL.createObjectURL(b);
          creadas.push(u);
          if (activo) setUrls((x) => ({ ...x, [a.n]: u }));
        })
        .catch(() => activo && setFallidas((f) => [...f, a.n]));
    }
    return () => {
      activo = false;
      creadas.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tareaId, parteId, clave]);

  if (adjuntos.length === 0) return null;
  const varios = adjuntos.length > 1;
  return (
    <Flex gap={2} wrap="wrap" mt={2} role="group" aria-label={`Evidencia del parte n.º ${parteId}`} data-testid={`evidencia-${parteId}`}>
      {adjuntos.map((a, i) => {
        const nombre = `Evidencia del parte n.º ${parteId}${varios ? `, archivo ${i + 1} de ${adjuntos.length}` : ""}`;
        const url = urls[a.n];
        if (!url) {
          return (
            <Box key={a.n} w="7rem" h="7rem" display="flex" alignItems="center" justifyContent="center" textAlign="center" fontSize="xs" color="textoSuave" bg="pizarra.100" borderRadius="md" p={1}>
              {fallidas.includes(a.n) ? "No se pudo cargar la evidencia" : "Cargando…"}
            </Box>
          );
        }
        return esVideo(a.tipo) ? (
          <Box key={a.n} maxW="22rem" w="full">
            <Box as="video" src={url} controls preload="metadata" aria-label={nombre} w="full" borderRadius="md" border="1px solid" borderColor="borde" bg="black" data-testid="evidencia-video" />
            <Text textStyle="microdato">Video · {Math.max(1, Math.round(a.bytes / 1024 / 1024))} MB</Text>
          </Box>
        ) : (
          <Link key={a.n} href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir a tamaño completo: ${nombre}`} display="block" borderRadius="md" overflow="hidden" border="1px solid" borderColor="borde">
            <Box as="img" src={url} alt={nombre} w="7rem" h="7rem" objectFit="cover" data-testid="evidencia-foto" />
          </Link>
        );
      })}
    </Flex>
  );
}
