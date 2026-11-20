import { Box, Button, Flex, FormControl, FormHelperText, FormLabel, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { IconoCaja, IconoMas } from "../../components/iconos/Iconos";
import { ACEPTA_ADJUNTOS, descargarAdjuntoParte, esVideo, formatearBytes, MAX_ADJUNTOS_PARTE, sumarAdjuntos, type AdjuntoParte } from "../../lib/partes";

export type EstadoArchivo = "pendiente" | "subiendo" | "ok" | "error";
export type ProgresoArchivo = { estado: EstadoArchivo; mensaje?: string };

function urlLocal(f: File): string | null {
  try {
    return typeof URL.createObjectURL === "function" ? URL.createObjectURL(f) : null;
  } catch {
    return null;
  }
}

/** Vista previa local de un archivo elegido. */
function Previa({ archivo, url }: { archivo: File; url: string | null }) {
  if (!url) return <Flex align="center" justify="center" w="4rem" h="4rem" borderRadius="md" bg="pizarra.100" aria-hidden="true"><IconoCaja tam="1.5rem" /></Flex>;
  return esVideo(archivo.type) ? (
    <Box as="video" src={url} muted preload="metadata" w="4rem" h="4rem" objectFit="cover" borderRadius="md" aria-label={`Vista previa del video ${archivo.name}`} />
  ) : (
    <Box as="img" src={url} alt={`Vista previa de ${archivo.name}`} w="4rem" h="4rem" objectFit="cover" borderRadius="md" />
  );
}

const TEXTO_ESTADO: Record<EstadoArchivo, string> = { pendiente: "Pendiente", subiendo: "Subiendo…", ok: "Subido", error: "No se subió" };

/**
 * Selector de evidencia (hasta 5 archivos): cámara o galería, controles de tipo y tamaño en el dispositivo,
 * vistas previas y, mientras se suben, el estado de cada archivo. El servidor vuelve a validar el tipo real.
 */
export function SelectorAdjuntos({ idBase, archivos, alCambiar, progreso, bloqueado = false }: { idBase: string; archivos: File[]; alCambiar: (a: File[]) => void; progreso?: Record<number, ProgresoArchivo>; bloqueado?: boolean }) {
  const [errores, setErrores] = useState<string[]>([]);
  const refCamara = useRef<HTMLInputElement>(null);
  const refGaleria = useRef<HTMLInputElement>(null);
  const urls = useMemo(() => archivos.map(urlLocal), [archivos]);
  useEffect(() => () => urls.forEach((u) => u && typeof URL.revokeObjectURL === "function" && URL.revokeObjectURL(u)), [urls]);

  function agregar(e: React.ChangeEvent<HTMLInputElement>) {
    const nuevos = Array.from(e.target.files ?? []);
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (nuevos.length === 0) return;
    const r = sumarAdjuntos(archivos, nuevos);
    setErrores(r.errores);
    alCambiar(r.lista);
  }
  const lleno = archivos.length >= MAX_ADJUNTOS_PARTE;

  return (
    <FormControl as="fieldset" mt={3} data-testid={`adjuntos-${idBase}`}>
      <FormLabel as="legend" fontSize="sm">
        Fotos o video como evidencia (opcional, hasta {MAX_ADJUNTOS_PARTE})
      </FormLabel>
      <Flex gap={2} wrap="wrap">
        <Button type="button" variant="outline" minH="2.75rem" leftIcon={<IconoMas />} isDisabled={bloqueado || lleno} onClick={() => refCamara.current?.click()}>
          Sacar foto o video
        </Button>
        <Button type="button" variant="outline" minH="2.75rem" isDisabled={bloqueado || lleno} onClick={() => refGaleria.current?.click()}>
          Elegir de la galería
        </Button>
      </Flex>
      <input ref={refCamara} id={`adj-cam-${idBase}`} type="file" accept={ACEPTA_ADJUNTOS} capture="environment" hidden onChange={agregar} aria-label="Sacar foto o video con la cámara" />
      <input ref={refGaleria} id={`adj-gal-${idBase}`} type="file" accept={ACEPTA_ADJUNTOS} multiple hidden onChange={agregar} aria-label="Elegir fotos o videos de la galería" />
      <FormHelperText>Imágenes JPEG, PNG o WebP de hasta 5 MB; videos MP4 de hasta 20 MB. No filmes ni fotografíes caras ni menores de edad.</FormHelperText>

      {errores.length > 0 && (
        <Box mt={2} role="alert" fontSize="sm" color="evacuacion.700" data-testid="errores-adjuntos">
          {errores.map((m) => (
            <Text key={m}>{m}</Text>
          ))}
        </Box>
      )}

      {archivos.length > 0 && (
        <Flex as="ul" direction="column" gap={2} listStyleType="none" m={0} mt={3} p={0} aria-label="Archivos elegidos">
          {archivos.map((f, i) => {
            const p = progreso?.[i];
            return (
              <Flex as="li" key={`${f.name}-${i}`} gap={3} align="center" data-testid={`archivo-${i}`}>
                <Previa archivo={f} url={urls[i] ?? null} />
                <Box minW={0} flex="1">
                  <Text fontSize="sm" fontWeight={600} overflowWrap="anywhere">
                    {f.name}
                  </Text>
                  <Text textStyle="microdato">
                    {esVideo(f.type) ? "Video" : "Imagen"} · {formatearBytes(f.size)}
                    {p ? ` · ${TEXTO_ESTADO[p.estado]}` : ""}
                  </Text>
                  {p?.estado === "error" && p.mensaje && (
                    <Text fontSize="sm" color="evacuacion.700" role="alert">
                      {p.mensaje}
                    </Text>
                  )}
                </Box>
                {!bloqueado && (
                  <Button type="button" size="sm" variant="ghost" minH="2.75rem" aria-label={`Quitar ${f.name}`} onClick={() => alCambiar(archivos.filter((_, j) => j !== i))}>
                    Quitar
                  </Button>
                )}
              </Flex>
            );
          })}
        </Flex>
      )}
    </FormControl>
  );
}

/** Miniatura (imagen) o reproductor (video) de un adjunto ya subido. Se descarga con la sesión. */
export function MiniaturaAdjunto({ tareaId, parteId, adjunto }: { tareaId: number; parteId: number; adjunto: AdjuntoParte }) {
  const [url, setUrl] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    let activo = true;
    let creada: string | null = null;
    descargarAdjuntoParte(tareaId, parteId, adjunto.n)
      .then((b) => {
        if (!activo) return;
        creada = typeof URL.createObjectURL === "function" ? URL.createObjectURL(b) : null;
        if (creada) setUrl(creada);
        else setFallo(true);
      })
      .catch(() => activo && setFallo(true));
    return () => {
      activo = false;
      if (creada && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(creada);
    };
  }, [tareaId, parteId, adjunto.n]);

  const video = esVideo(adjunto.tipo);
  const etiqueta = `${video ? "Video" : "Foto"} ${adjunto.n} del parte ${parteId}`;
  if (fallo) {
    return (
      <Text fontSize="sm" color="textoSuave" data-testid={`adjunto-${parteId}-${adjunto.n}`}>
        {etiqueta}: no se pudo cargar.
      </Text>
    );
  }
  if (!url) return <Box w="5rem" h="5rem" borderRadius="md" bg="pizarra.100" data-testid={`adjunto-${parteId}-${adjunto.n}`} role="img" aria-label={`${etiqueta} (cargando)`} />;
  return video ? (
    <Box as="video" src={url} controls preload="metadata" w={{ base: "100%", sm: "14rem" }} maxH="10rem" borderRadius="md" aria-label={etiqueta} data-testid={`adjunto-${parteId}-${adjunto.n}`} />
  ) : (
    <Box as="a" href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${etiqueta} en grande`} display="inline-block">
      <Box as="img" src={url} alt={etiqueta} w="5rem" h="5rem" objectFit="cover" borderRadius="md" data-testid={`adjunto-${parteId}-${adjunto.n}`} />
    </Box>
  );
}
