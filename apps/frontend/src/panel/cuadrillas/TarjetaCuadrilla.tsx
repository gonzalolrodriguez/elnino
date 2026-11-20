import { Badge, Box, Button, Flex, Heading, Link, Text, useToast } from "@chakra-ui/react";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import { IconoMas, IconoPersonas, IconoTriangulo, IconoVehiculo } from "../../components/iconos/Iconos";
import { AlertaError } from "../../components/Formulario";
import { Insignia } from "../../components/Insignia";
import { etiquetaEstadoTarea, etiquetaRolOperativo, fechaHora } from "../../lib/etiquetas";
import { etiquetaVehiculo } from "../../lib/pedidos";
import { FichaIcono } from "../../pages/micuenta/Panel";
import { api } from "../api";
import type { CuadrillaResumen } from "../tipos";
import { FormularioIntegrante } from "./FormularioIntegrante";
import { ChipParte, truncar } from "./partes";

export const TIPO_INCIDENTE: Record<string, string> = { humana: "Humana y servicios", ganadera: "Ganadera", apicola: "Apícola" };

/** Rótulo con ícono para lo que requiere atención del operador: nunca solo color. */
export function AvisoAtencion({ children = "Requiere atención" }: { children?: string }) {
  return (
    <Flex as="span" display="inline-flex" align="center" gap={1.5} px={2.5} py="1px" borderRadius="full" bg="alerta.100" color="alerta.800" fontSize="sm" fontWeight={700} data-testid="requiere-atencion">
      <IconoTriangulo tam="1rem" />
      {children}
    </Flex>
  );
}

/** Ficha de una cuadrilla: quién la integra (por rol), en qué está y qué informó por última vez. */
export function TarjetaCuadrilla({ c, puedeGestionar, alCambiar }: { c: CuadrillaResumen; puedeGestionar: boolean; alCambiar: () => void }) {
  const toast = useToast();
  const [agregando, setAgregando] = useState(false);
  const [quitando, setQuitando] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const vehiculo = etiquetaVehiculo(c.vehiculo);
  const t = c.tarea_actual;

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
    <Box as="article" id={`cuadrilla-${c.id}`} aria-labelledby={`cuadrilla-${c.id}-titulo`} layerStyle="tarjeta" p={{ base: 4, md: 5 }} data-testid={`cuadrilla-${c.id}`}>
      <Flex gap={3.5} align="flex-start">
        <FichaIcono tono="tinta" tam="3rem">
          <IconoVehiculo vehiculo={c.vehiculo} tam="1.5rem" />
        </FichaIcono>
        <Box minW={0} flex="1">
          <Heading as="h3" id={`cuadrilla-${c.id}-titulo`} size="sm">
            {c.nombre}
          </Heading>
          <Text fontSize="sm" color="textoSuave">
            {TIPO_INCIDENTE[c.tipo_incidente] ?? c.tipo_incidente}
          </Text>
          <Flex align="center" gap={2} wrap="wrap" mt={1.5}>
            <Badge>{c.estado.replace("_", " ")}</Badge>
            {vehiculo && (
              <Flex as="span" align="center" gap={1.5} px={2.5} py="1px" borderRadius="full" bg="limo.50" color="limo.800" fontSize="sm" fontWeight={600}>
                <IconoVehiculo vehiculo={c.vehiculo} tam="1rem" />
                {vehiculo}
              </Flex>
            )}
            <Insignia categoria="SIMULADO" />
          </Flex>
        </Box>
        {c.dificultades_abiertas > 0 && (
          <Flex as="span" align="center" gap={1.5} fontSize="sm" fontWeight={700} color="alerta.800" data-testid={`dificultades-${c.id}`}>
            <IconoTriangulo tam="1rem" />
            {c.dificultades_abiertas} {c.dificultades_abiertas === 1 ? "dificultad abierta" : "dificultades abiertas"}
          </Flex>
        )}
      </Flex>

      <Box mt={4}>
        <Flex align="center" gap={1.5} fontSize="xs" fontWeight={700} letterSpacing="0.06em" textTransform="uppercase" color="textoSuave" mb={1.5}>
          <IconoPersonas tam="1rem" /> Integrantes (por rol)
        </Flex>
        {c.integrantes.length === 0 ? (
          <Text fontSize="sm" color="textoSuave">
            Sin integrantes.
          </Text>
        ) : (
          <Box as="ul" listStyleType="none" m={0} p={0} display="flex" flexDirection="column" gap={1}>
            {c.integrantes.map((i) => (
              <Flex as="li" key={i.usuario_id} align="center" gap={2} wrap="wrap" fontSize="sm">
                <Text as="span" fontWeight={600}>
                  {etiquetaRolOperativo(i.rol_operativo)}
                </Text>
                {i.es_encargado && (
                  <Badge colorScheme="green" data-testid="encargado">
                    Encargado
                  </Badge>
                )}
                {puedeGestionar &&
                  (quitando === i.usuario_id ? (
                    <Flex as="span" align="center" gap={1} ml="auto">
                      <Button size="xs" colorScheme="red" onClick={() => void quitar(i.usuario_id, i.rol_operativo)} aria-label={`Confirmar: quitar ${etiquetaRolOperativo(i.rol_operativo)}`}>
                        Sí, quitar
                      </Button>
                      <Button size="xs" variant="outline" onClick={() => setQuitando(null)}>
                        No
                      </Button>
                    </Flex>
                  ) : (
                    <Button size="xs" variant="outline" ml="auto" onClick={() => setQuitando(i.usuario_id)} aria-label={`Quitar ${etiquetaRolOperativo(i.rol_operativo)} de ${c.nombre}`}>
                      Quitar
                    </Button>
                  ))}
              </Flex>
            ))}
          </Box>
        )}
        {puedeGestionar && (
          <>
            <Button size="xs" variant="outline" mt={2} leftIcon={<IconoMas tam="0.9rem" />} aria-expanded={agregando} onClick={() => setAgregando((v) => !v)}>
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
        <Text fontSize="xs" fontWeight={700} letterSpacing="0.06em" textTransform="uppercase" color="textoSuave" mb={1.5}>
          Tarea actual
        </Text>
        {t ? (
          <Flex align="center" gap={2} wrap="wrap" fontSize="sm">
            <Link as={RouterLink} to={`/comando/operacion?tarea=${t.id}#sec-tareas`} fontWeight={700}>
              Tarea n.º {t.id}
            </Link>
            {t.sector_id && <span>Sector {t.sector_id}</span>}
            <Badge>{etiquetaEstadoTarea(t.estado)}</Badge>
            {t.requiere_atencion && <AvisoAtencion />}
          </Flex>
        ) : (
          <Text fontSize="sm" color="textoSuave">
            Libre: sin tarea asignada.
          </Text>
        )}
      </Box>

      <Box mt={3}>
        <Text fontSize="xs" fontWeight={700} letterSpacing="0.06em" textTransform="uppercase" color="textoSuave" mb={1.5}>
          Último parte
        </Text>
        {c.ultimo_parte ? (
          <Box fontSize="sm" data-testid={`ultimo-parte-${c.id}`}>
            <Flex align="center" gap={2} wrap="wrap">
              <ChipParte parte={c.ultimo_parte} />
              {c.ultimo_parte.autor_rol && <span>{etiquetaRolOperativo(c.ultimo_parte.autor_rol)}</span>}
              <Text as="time" dateTime={c.ultimo_parte.creado_en} color="textoSuave" ml="auto">
                {fechaHora(c.ultimo_parte.creado_en)}
              </Text>
            </Flex>
            {c.ultimo_parte.observacion && (
              <Text color="textoSuave" mt={1}>
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
    </Box>
  );
}
