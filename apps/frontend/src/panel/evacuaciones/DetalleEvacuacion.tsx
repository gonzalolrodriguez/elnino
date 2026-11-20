import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Link,
  Text,
  Textarea,
  useDisclosure,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import { AlertaError } from "../../components/Formulario";
import { Insignia } from "../../components/Insignia";
import { etiquetaCanalConfirmacion, etiquetaMotivoDiscrepancia, etiquetaRolOperativo, fechaHora } from "../../lib/etiquetas";
import { api, fotoCierre } from "../api";
import type { Centro, Evacuacion } from "../tipos";
import { fmtNum } from "../ui";
import { ChipEvacuacion } from "./ChipEvacuacion";
import { MiniMapaDestino } from "./MiniMapaDestino";
import { RespuestaConfirmacionTexto } from "./RespuestaConfirmacion";

/** Fotos de la constancia: se piden con la sesión y se muestran como imagen local; se liberan al cerrar. */
function Fotos({ tareaId, adjuntos }: { tareaId: number; adjuntos: { n: number; mime: string }[] }) {
  const [urls, setUrls] = useState<Record<number, string>>({});
  const [fallidas, setFallidas] = useState<number[]>([]);
  // La lista se renueva sola: las fotos se vuelven a pedir solo si cambia el conjunto de adjuntos.
  const clave = adjuntos.map((a) => a.n).join(",");
  useEffect(() => {
    let activo = true;
    const creadas: string[] = [];
    for (const a of adjuntos) {
      fotoCierre(tareaId, a.n)
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
  }, [tareaId, clave]);
  if (adjuntos.length === 0) return <Text fontSize="sm">Sin fotos.</Text>;
  return (
    <Flex gap={2} wrap="wrap" data-testid="fotos-constancia">
      {adjuntos.map((a) =>
        urls[a.n] ? (
          <Box key={a.n} as="img" src={urls[a.n]} alt={`Foto ${a.n} de la constancia`} w="7rem" h="7rem" objectFit="cover" borderRadius="md" border="1px solid" borderColor="borde" />
        ) : (
          <Box key={a.n} w="7rem" h="7rem" display="flex" alignItems="center" justifyContent="center" textAlign="center" fontSize="xs" color="textoSuave" bg="pizarra.100" borderRadius="md" p={1}>
            {fallidas.includes(a.n) ? `No se pudo cargar la foto ${a.n}` : "Cargando…"}
          </Box>
        ),
      )}
    </Flex>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <Box mb={2}>
      <Text fontSize="xs" color="textoSuave">
        {etiqueta}
      </Text>
      <Box fontSize="sm">{children}</Box>
    </Box>
  );
}

function ReabrirConfirmacion({ tareaId, alReabrir }: { tareaId: number; alReabrir: () => void }) {
  const dialogo = useDisclosure();
  const cancelar = useRef<HTMLButtonElement>(null);
  const [motivo, setMotivo] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function reabrir() {
    setTrabajando(true);
    setError(null);
    try {
      await api.reabrirConfirmacion(tareaId, motivo.trim() || undefined);
      dialogo.onClose();
      setMotivo("");
      alReabrir();
    } catch (e) {
      setError(e);
    } finally {
      setTrabajando(false);
    }
  }
  return (
    <>
      <Button size="sm" variant="outline" onClick={dialogo.onOpen}>
        Reabrir confirmación
      </Button>
      <AlertDialog isOpen={dialogo.isOpen} leastDestructiveRef={cancelar} onClose={dialogo.onClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg">Reabrir la confirmación</AlertDialogHeader>
            <AlertDialogBody>
              <Text mb={3}>
                Se borra la respuesta de la persona evacuada y se le envía una consulta nueva con un código nuevo. La respuesta anterior queda registrada. Hacelo si hubo un error al responder o si hace falta volver a preguntar.
              </Text>
              <FormControl>
                <FormLabel htmlFor="motivo-reapertura" fontSize="sm">
                  Motivo (opcional)
                </FormLabel>
                <Textarea id="motivo-reapertura" size="sm" maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </FormControl>
              <Box mt={2}>
                <AlertaError error={error} />
              </Box>
            </AlertDialogBody>
            <AlertDialogFooter gap={2}>
              <Button ref={cancelar} onClick={dialogo.onClose}>
                Cancelar
              </Button>
              <Button onClick={() => void reabrir()} isLoading={trabajando}>
                Reabrir confirmación
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}

/** Detalle de una evacuación en un panel lateral: constancia, destino frente al centro, fotos y confirmación del evacuado. */
export function DetalleEvacuacion({ evacuacion, centros, alCerrar, alCambiar }: { evacuacion: Evacuacion | null; centros: Centro[]; alCerrar: () => void; alCambiar: () => void }) {
  const e = evacuacion;
  const c = e?.constancia ?? null;
  const centro = c?.destino.centro_id ? (centros.find((x) => x.id === c.destino.centro_id) ?? null) : null;
  return (
    <Drawer isOpen={e !== null} placement="right" size="md" onClose={alCerrar}>
      <DrawerOverlay />
      <DrawerContent data-testid="detalle-evacuacion">
        <DrawerCloseButton />
        <DrawerHeader>{e ? e.titulo : ""}</DrawerHeader>
        <DrawerBody>
          {e && (
            <>
              <Flex gap={2} align="center" wrap="wrap" mb={3}>
                <ChipEvacuacion estado={e.estado} />
                <Insignia categoria="SIMULADO" />
              </Flex>
              <Text fontSize="sm" color="textoSuave" mb={3}>
                {[e.sector_id ? `Sector ${e.sector_id}` : null, e.cuadrilla_nombre, e.solicitud_id ? `Pedido n.º ${e.solicitud_id}` : null, e.orden_id ? `Orden n.º ${e.orden_id}` : null].filter(Boolean).join(" · ")}
              </Text>

              {e.discrepancia && (
                <Alert status="warning" variant="left-accent" alignItems="flex-start" mb={4} data-testid="discrepancia">
                  <AlertIcon />
                  <Box>
                    <AlertTitle fontSize="sm">Hay algo para revisar</AlertTitle>
                    <AlertDescription fontSize="sm">
                      <Box as="ul" m={0} pl={4}>
                        {e.discrepancia.motivos.map((m) => (
                          <li key={m}>{etiquetaMotivoDiscrepancia(m)}</li>
                        ))}
                      </Box>
                      <Text mt={1}>Es una marca para revisar, no una acusación: puede haber un error de carga o de respuesta.</Text>
                      <Link as={RouterLink} to="/comando/operacion#sec-tareas" fontWeight={600}>
                        Ver la tarea {e.tarea_id}
                      </Link>
                    </AlertDescription>
                  </Box>
                </Alert>
              )}

              {!c ? (
                <Text fontSize="sm" data-testid="sin-constancia">
                  {e.tarea_estado === "completada" ? "La cuadrilla cerró la tarea sin cargar constancia (destino, personas y fotos)." : "Todavía no hay constancia: la cuadrilla no cerró la tarea."}
                </Text>
              ) : (
                <>
                  <Heading as="h3" size="sm" mb={2}>
                    Constancia de la cuadrilla
                  </Heading>
                  <MiniMapaDestino
                    destino={{ lat: c.destino.lat, lon: c.destino.lon }}
                    centro={centro ? { lat: centro.lat, lon: centro.lon } : null}
                    origen={e.origen ? { lat: e.origen.lat, lon: e.origen.lon } : null}
                    centroNombre={c.destino.centro_nombre}
                    distanciaM={c.destino.distancia_a_centro_m}
                  />
                  <Box mt={3}>
                    <Dato etiqueta="Destino marcado (GPS)">
                      {c.destino.lat.toLocaleString("es-AR", { maximumFractionDigits: 5 })}, {c.destino.lon.toLocaleString("es-AR", { maximumFractionDigits: 5 })}
                    </Dato>
                    <Dato etiqueta="Centro de recepción elegido">{c.destino.centro_nombre ?? "ninguno"}</Dato>
                    <Dato etiqueta="Personas trasladadas">{fmtNum(c.personas_trasladadas)}</Dato>
                    <Dato etiqueta="Animales trasladados">
                      {Object.keys(c.animales_trasladados).length === 0
                        ? "ninguno"
                        : Object.entries(c.animales_trasladados)
                            .map(([especie, n]) => `${fmtNum(n)} ${especie}`)
                            .join(", ")}
                    </Dato>
                    <Dato etiqueta="Firma">
                      {c.rol_operativo ? etiquetaRolOperativo(c.rol_operativo) : "sin rol"} · {fechaHora(c.creada_en)}
                    </Dato>
                    <Dato etiqueta="Nota de la cuadrilla">{c.nota ?? "sin nota"}</Dato>
                  </Box>
                  <Heading as="h3" size="xs" mb={1}>
                    Fotos
                  </Heading>
                  <Fotos tareaId={e.tarea_id} adjuntos={c.adjuntos} />
                </>
              )}

              <Heading as="h3" size="sm" mt={5} mb={2}>
                Confirmación de la persona evacuada
              </Heading>
              {e.confirmacion && e.confirmacion.respuesta ? (
                <Box data-testid="confirmacion">
                  <Dato etiqueta="Respondió"><RespuestaConfirmacionTexto respuesta={e.confirmacion.respuesta} /></Dato>
                  <Dato etiqueta="Por qué canal">{etiquetaCanalConfirmacion(e.confirmacion.canal)}</Dato>
                  <Dato etiqueta="Comentario">{e.confirmacion.comentario ?? "sin comentario"}</Dato>
                  <Dato etiqueta="Fecha">{fechaHora(e.confirmacion.respondida_en)}</Dato>
                  <ReabrirConfirmacion tareaId={e.tarea_id} alReabrir={alCambiar} />
                </Box>
              ) : e.confirmacion ? (
                <Text fontSize="sm" data-testid="confirmacion">
                  Se le consultó el {fechaHora(e.confirmacion.solicitada_en)} y todavía no respondió. No bloquea la evacuación.
                </Text>
              ) : (
                <Text fontSize="sm" data-testid="confirmacion">
                  No hay consulta a la persona evacuada para esta tarea.
                </Text>
              )}
            </>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
