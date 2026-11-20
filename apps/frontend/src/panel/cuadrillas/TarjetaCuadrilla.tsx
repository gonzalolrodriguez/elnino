import { Box, Button, Flex, Heading, Link, Text, useToast } from "@chakra-ui/react";
import { useState, type ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

import { IconoHistorial, IconoMas, IconoPersonas, IconoTriangulo, IconoVehiculo } from "../../components/iconos/Iconos";
import { AlertaError } from "../../components/Formulario";
import { Insignia } from "../../components/Insignia";
import { etiquetaRolOperativo, fechaHora } from "../../lib/etiquetas";
import { etiquetaVehiculo } from "../../lib/pedidos";
import { api } from "../api";
import type { CuadrillaResumen } from "../tipos";
import { Chip, FichaIcono } from "../ui";
import { FormularioIntegrante } from "./FormularioIntegrante";
import { etiquetaProfesion, etiquetaTipoOperativo } from "./catalogos";
import { AvisoAtencion, ChipEstadoTarea, ChipParte, TACTIL, truncar } from "./partes";

export { AvisoAtencion };

export const TIPO_INCIDENTE: Record<string, string> = { humana: "Humana y servicios", ganadera: "Ganadera", apicola: "Apícola" };
export const ESTADO_CUADRILLA: Record<string, string> = { disponible: "Disponible", en_tarea: "En tarea", inactiva: "Inactiva", baja: "De baja" };

/** Título de cada bloque de la ficha: una línea de texto normal con ícono, no un rótulo en mayúsculas. */
function Rotulo({ icono, children, id }: { icono?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <Flex as="h3" id={id} align="center" gap={1.5} textStyle="rotulo" mb={1.5}>
      {icono}
      {children}
    </Flex>
  );
}

/** Ficha de una cuadrilla: quién la integra (por rol), en qué está y qué informó por última vez. */
export function TarjetaCuadrilla({ c, puedeGestionar, alCambiar, alEditar, alBaja }: { c: CuadrillaResumen; puedeGestionar: boolean; alCambiar: () => void; alEditar?: (id: number) => void; alBaja?: (c: { id: number; nombre: string }) => void }) {
  const toast = useToast();
  const [agregando, setAgregando] = useState(false);
  const [quitando, setQuitando] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const vehiculo = etiquetaVehiculo(c.vehiculo);
  const t = c.tarea_actual;
  const tituloId = `cuadrilla-${c.id}-titulo`;

  async function quitar(usuarioId: number, rol: string) {
    setError(null);
    try {
      await api.quitarIntegrante(c.id, usuarioId);
      toast({ title: "Integrante quitado", description: `${etiquetaRolOperativo(rol)} de ${c.nombre}`, status: "success", duration: 3000 });
      setQuitando(null);
      alCambiar();
    } catch (e) {
      setError(e);
    }
  }

  return (
    <Box as="article" id={`cuadrilla-${c.id}`} aria-labelledby={tituloId} layerStyle="tarjeta" p={{ base: 4, md: 5 }} minW={0} scrollMarginTop="5rem" data-testid={`cuadrilla-${c.id}`}>
      <Flex gap={3.5} align="flex-start">
        <FichaIcono tono={t ? "info" : "ok"} tam="3rem" icono={<IconoVehiculo vehiculo={c.vehiculo} tam="1.5rem" />} />
        <Box minW={0} flex="1">
          <Heading as="h2" id={tituloId} size="sm" textStyle="tituloBloque">
            {c.nombre}
          </Heading>
          <Text textStyle="microdato">{c.tipo_operativo ? etiquetaTipoOperativo(c.tipo_operativo) : (TIPO_INCIDENTE[c.tipo_incidente] ?? c.tipo_incidente)}</Text>
          <Flex align="center" gap={1.5} wrap="wrap" mt={2}>
            <Chip tono={t ? "info" : "ok"}>{ESTADO_CUADRILLA[c.estado] ?? c.estado.replace("_", " ")}</Chip>
            {vehiculo && <Chip tono="neutro">{vehiculo}</Chip>}
            <Insignia categoria="SIMULADO" />
          </Flex>
        </Box>
      </Flex>

      {c.dificultades_abiertas > 0 && (
        <Chip tono="aviso" icono={<IconoTriangulo tam="1rem" />} fontWeight={700} mt={3} data-testid={`dificultades-${c.id}`}>
          {c.dificultades_abiertas} {c.dificultades_abiertas === 1 ? "dificultad abierta" : "dificultades abiertas"}
        </Chip>
      )}

      <Box mt={4} pt={3} borderTop="1px solid" borderColor="borde">
        <Rotulo icono={<IconoPersonas tam="1rem" />}>Integrantes (por rol)</Rotulo>
        {c.integrantes.length === 0 ? (
          <Text fontSize="sm" color="textoSuave">
            Sin integrantes.
          </Text>
        ) : (
          <Box as="ul" listStyleType="none" m={0} p={0} display="flex" flexDirection="column" gap={1.5}>
            {c.integrantes.map((i) => (
              <Flex as="li" key={i.usuario_id} align="center" columnGap={2} rowGap={1} wrap="wrap" fontSize="sm" minH="2rem">
                <Text as="span" fontWeight={600}>
                  {etiquetaRolOperativo(i.rol_operativo)}
                </Text>
                {i.profesion && (
                  <Text as="span" color="textoSuave">
                    {etiquetaProfesion(i.profesion)}
                  </Text>
                )}
                {i.es_encargado && (
                  <Chip tono="ok" data-testid="encargado">
                    Encargado
                  </Chip>
                )}
                {puedeGestionar &&
                  (quitando === i.usuario_id ? (
                    <Flex as="span" align="center" gap={1.5} ml="auto">
                      <Button size="sm" {...TACTIL} colorScheme="red" onClick={() => void quitar(i.usuario_id, i.rol_operativo)} aria-label={`Confirmar: quitar ${etiquetaRolOperativo(i.rol_operativo)}`}>
                        Sí, quitar
                      </Button>
                      <Button size="sm" {...TACTIL} variant="outline" onClick={() => setQuitando(null)}>
                        No
                      </Button>
                    </Flex>
                  ) : (
                    <Button size="sm" {...TACTIL} variant="outline" ml="auto" onClick={() => setQuitando(i.usuario_id)} aria-label={`Quitar ${etiquetaRolOperativo(i.rol_operativo)} de ${c.nombre}`}>
                      Quitar
                    </Button>
                  ))}
              </Flex>
            ))}
          </Box>
        )}
        {puedeGestionar && (
          <>
            <Button size="sm" {...TACTIL} variant="outline" mt={3} leftIcon={<IconoMas tam="0.9rem" />} aria-expanded={agregando} onClick={() => setAgregando((v) => !v)}>
              {agregando ? "Cerrar" : "Agregar integrante"}
            </Button>
            {agregando && (
              <FormularioIntegrante
                cuadrilla={c}
                alAgregar={() => {
                  setAgregando(false);
                  alCambiar();
                }}
              />
            )}
          </>
        )}
        <Box mt={2}>
          <AlertaError error={error} />
        </Box>
      </Box>

      <Box mt={4} pt={3} borderTop="1px solid" borderColor="borde">
        <Rotulo icono={<IconoVehiculo vehiculo={c.vehiculo} tam="1rem" />}>Tarea actual</Rotulo>
        {t ? (
          <Flex align="center" columnGap={2} rowGap={1.5} wrap="wrap" fontSize="sm">
            <Link as={RouterLink} to={`/comando/operacion?tarea=${t.id}#sec-tareas`} fontWeight={700} display="inline-flex" alignItems="center" minH={{ base: "2.75rem", md: "auto" }}>
              Tarea n.º {t.id}
            </Link>
            {t.sector_id && <span>Sector {t.sector_id}</span>}
            <ChipEstadoTarea estado={t.estado} />
            {t.requiere_atencion && <AvisoAtencion />}
          </Flex>
        ) : (
          <Text fontSize="sm" color="textoSuave">
            Libre: sin tarea asignada.
          </Text>
        )}
      </Box>

      <Box mt={3} pt={3} borderTop="1px solid" borderColor="borde">
        <Rotulo icono={<IconoHistorial tam="1rem" />}>Último parte</Rotulo>
        {c.ultimo_parte ? (
          <Box fontSize="sm" data-testid={`ultimo-parte-${c.id}`}>
            <Flex align="center" columnGap={2} rowGap={1} wrap="wrap">
              <ChipParte parte={c.ultimo_parte} />
              {c.ultimo_parte.autor_rol && <span>{etiquetaRolOperativo(c.ultimo_parte.autor_rol)}</span>}
              <Text as="time" dateTime={c.ultimo_parte.creado_en} textStyle="microdato" ml={{ md: "auto" }}>
                {fechaHora(c.ultimo_parte.creado_en)}
              </Text>
            </Flex>
            {c.ultimo_parte.observacion && (
              <Text color="textoSuave" mt={1.5} overflowWrap="anywhere">
                {truncar(c.ultimo_parte.observacion, 200)}
              </Text>
            )}
          </Box>
        ) : (
          <Text fontSize="sm" color="textoSuave">
            Todavía no informó nada.
          </Text>
        )}
      </Box>

      <Flex mt={4} pt={3} borderTop="1px solid" borderColor="borde" gap={2} wrap="wrap" align="center">
        <Button as={RouterLink} to={`/comando/cuadrillas/${c.id}`} size="sm" {...TACTIL} variant="outline" aria-label={`Ver detalle de ${c.nombre}`}>
          Ver detalle
        </Button>
        {puedeGestionar && alEditar && c.estado !== "baja" && (
          <Button size="sm" {...TACTIL} variant="outline" onClick={() => alEditar(c.id)} aria-label={`Editar ${c.nombre}`}>
            Editar
          </Button>
        )}
        {puedeGestionar && alBaja && c.estado !== "baja" && (
          <Button size="sm" {...TACTIL} variant="outline" colorScheme="red" onClick={() => alBaja({ id: c.id, nombre: c.nombre })} aria-label={`Dar de baja a ${c.nombre}`}>
            Dar de baja
          </Button>
        )}
      </Flex>
    </Box>
  );
}
