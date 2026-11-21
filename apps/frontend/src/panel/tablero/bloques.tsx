import { Alert, AlertDescription, AlertIcon, Box, Flex, Heading, Link, SimpleGrid, Table, Tbody, Td, Text, Th, Thead, Tr } from "@chakra-ui/react";
import { ESTADOS_SOLICITUD } from "@evacuaciones/shared";
import type { ReactElement, ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

import { IconoAlerta, IconoBandeja, IconoCamion, IconoEdificio, IconoGota, IconoMascota, IconoMegafono, IconoOlas, IconoPersonas, IconoReloj, IconoTilde, IconoTriangulo, IconoPunto, IconoRumbo } from "../../components/iconos/Iconos";
import { Insignia } from "../../components/Insignia";
import { TablaDesplazable } from "../../components/TablaDesplazable";
import { etiquetaOrigenLluvia, etiquetaOrigenSolicitud, etiquetaEstadoSolicitud, etiquetaRolOperativo, fechaHora, sinCodigos } from "../../lib/etiquetas";
import { duracionCorta } from "../../lib/vivo";
import { IconoCerrado } from "../iconos";
import type { ResumenCentro, ResumenCuadrilla, ResumenEvacuaciones, ResumenPanel, ResumenRio, ResumenSector } from "../tipos";
import { APILAR, Chip, Cifra, fmtDias, fmtFecha, fmtM, fmtNum, NOMBRE_ACCESO, Seccion, type TonoChip } from "../ui";
import { Barras } from "./Barras";
import { EscalaRio } from "./EscalaRio";
import { evaluarFrescura, type EstadoFrescura } from "./frescura";

const TIPO_ORDEN: Record<string, string> = { alerta: "Alerta", evacuacion_preventiva: "Evacuación preventiva", evacuacion: "Evacuación" };
const TONO_ORDEN: Record<string, TonoChip> = { alerta: "info", evacuacion_preventiva: "aviso", evacuacion: "alerta" };
const TIPO_INCIDENTE: Record<string, string> = { humana: "Humana y servicios", ganadera: "Ganadera", apicola: "Apícola" };

const signo = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;

/** Fila de lista con línea fina debajo: base de todas las listas del tablero. */
const FILA = { py: 2.5, borderBottom: "1px solid", borderColor: "pizarra.100", _last: { borderBottom: "none", pb: 0 }, _first: { pt: 0 } } as const;

/* ------------------------------------------------------------------------------------------------ */
/* Río                                                                                              */
/* ------------------------------------------------------------------------------------------------ */

/** Barra de escenario: la altura observada frente a 7,80 y 8,30 m, la tendencia y el tiempo restante con su supuesto. */
export function BarraEscenario({ rio, resumida = false }: { rio: ResumenRio; resumida?: boolean }) {
  if (!rio.disponible || rio.altura_m === undefined || rio.umbral_alerta_m === undefined || rio.umbral_evacuacion_m === undefined) {
    return (
      <Seccion titulo="Río en Puerto Formosa" categoria={rio.categoria} id="tab-rio" icono={<IconoOlas />}>
        <Text fontSize="sm">Todavía no hay lecturas del río cargadas: no se puede calcular la distancia a los umbrales.</Text>
      </Seccion>
    );
  }
  const distA = rio.distancia_a_alerta_m ?? rio.umbral_alerta_m - rio.altura_m;
  const textoDist = distA <= 0 ? `superó la alerta por ${fmtM(Math.abs(distA))}` : `a ${fmtM(distA)} de la alerta`;
  if (resumida) {
    return (
      <Flex layerStyle="tarjeta" px={4} py={3} mb={5} gap={3} align="center" wrap="wrap" data-testid="escenario-resumido" role="region" aria-label="Río en Puerto Formosa">
        <Box color="primario">
          <IconoOlas tam="1.5rem" />
        </Box>
        <Text fontSize="sm" flex="1 1 18rem">
          Río en Puerto Formosa: <strong>{fmtM(rio.altura_m)}</strong> ({fmtFecha(rio.fecha_lectura)}), {textoDist}; evacuación en {fmtM(rio.umbral_evacuacion_m)}.
        </Text>
        <Insignia categoria={rio.categoria} />
      </Flex>
    );
  }
  const tiempos = rio.tiempo_a_umbrales ?? [];
  return (
    <Seccion titulo="Río en Puerto Formosa" categoria={rio.categoria} id="tab-rio" icono={<IconoOlas />} derecha={[sinCodigos(rio.fuente), fmtFecha(rio.fecha_lectura)].join(" · ")}>
      <Flex gap={{ base: 5, lg: 10 }} direction={{ base: "column", lg: "row" }}>
        <Box flex="1.3" minW={0}>
          <Flex align="baseline" columnGap={4} rowGap={1} wrap="wrap" mb={3}>
            <Text textStyle="cifraGrande" fontSize={{ base: "2.5rem", md: "3rem" }} data-testid="tablero-altura">
              {fmtM(rio.altura_m)}
            </Text>
            <Text fontSize="sm" color="textoSuave">
              {textoDist.charAt(0).toUpperCase() + textoDist.slice(1)}
              {rio.tendencia_7d_m !== null && rio.tendencia_7d_m !== undefined ? ` · ${signo(rio.tendencia_7d_m)} en 7 días` : " · tendencia de 7 días sin dato"}
            </Text>
          </Flex>
          <EscalaRio altura={rio.altura_m} alerta={rio.umbral_alerta_m} evacuacion={rio.umbral_evacuacion_m} />
        </Box>
        <Box flex="1" minW={0}>
          <Flex align="center" gap={2} mb={2} wrap="wrap">
            <Heading as="h3" size="xs">
              ¿Cuánto tiempo queda?
            </Heading>
            <Insignia categoria={rio.categoria_proyeccion ?? "SIMULADO"} />
          </Flex>
          {tiempos.length === 0 ? (
            <Text fontSize="sm">Sin estimación.</Text>
          ) : (
            <Box as="ul" listStyleType="none" m={0} p={0} fontSize="sm">
              {tiempos.map((t) => (
                <Flex as="li" key={t.objetivo} justify="space-between" align="baseline" gap={3} {...FILA}>
                  <span>
                    {t.objetivo} ({fmtM(t.valor_m)})
                  </span>
                  <Text as="strong" fontSize="md" sx={{ fontVariantNumeric: "tabular-nums" }}>
                    {t.ya_alcanzado ? "ya alcanzado" : fmtDias(t.dias_minimo, t.dias_maximo)}
                  </Text>
                </Flex>
              ))}
            </Box>
          )}
          {rio.supuesto_proyeccion && (
            <Text textStyle="microdato" mt={3} data-testid="tablero-supuesto">
              <strong>Supuesto:</strong> {sinCodigos(rio.supuesto_proyeccion)}
            </Text>
          )}
        </Box>
      </Flex>
    </Seccion>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Sectores                                                                                         */
/* ------------------------------------------------------------------------------------------------ */

/** Cada estado lleva forma (ícono) + texto + color: el color nunca va solo. */
const ESTILO_SECTOR: Record<ResumenSector["estado"], { bg: string; linea: string; disco: string; fg: string; icono: ReactElement; texto: string; tono: TonoChip }> = {
  normal: { bg: "verde.50", linea: "verde.200", disco: "verde.600", fg: "verde.800", icono: <IconoTilde tam="1.25rem" strokeWidth={2.25} />, texto: "normal", tono: "ok" },
  en_riesgo: { bg: "alerta.50", linea: "alerta.200", disco: "alerta.700", fg: "alerta.800", icono: <IconoTriangulo tam="1.25rem" />, texto: "en riesgo", tono: "aviso" },
  comprometido: { bg: "evacuacion.50", linea: "evacuacion.200", disco: "evacuacion.700", fg: "evacuacion.800", icono: <IconoAlerta tam="1.25rem" />, texto: "comprometido", tono: "alerta" },
};

function Dato({ icono, children, tono }: { icono: ReactElement; children: ReactNode; tono?: "alerta" }) {
  return (
    <Flex as="li" gap={2} align="flex-start" fontSize="sm" color={tono === "alerta" ? "evacuacion.800" : "texto"}>
      <Box mt="2px" color={tono === "alerta" ? "evacuacion.700" : "textoSuave"}>
        {icono}
      </Box>
      <Box minW={0}>{children}</Box>
    </Flex>
  );
}

function TarjetaSector({ s }: { s: ResumenSector }) {
  const est = ESTILO_SECTOR[s.estado];
  const cerrados = s.accesos.filter((a) => a.estado !== "transitable");
  const c = s.centro_sugerido;
  return (
    <Flex direction="column" gap={3} bg={est.bg} border="1px solid" borderColor={est.linea} borderRadius="xl" p={4} data-testid={`tablero-sector-${s.id}`} minW={0}>
      <Flex align="center" gap={3}>
        <Flex aria-hidden="true" w="2.5rem" h="2.5rem" flexShrink={0} align="center" justify="center" borderRadius="full" bg={est.disco} color="white">
          {est.icono}
        </Flex>
        <Box minW={0}>
          <Heading as="h3" size="sm">
            {s.nombre}
          </Heading>
          <Flex gap={1.5} wrap="wrap" mt={1}>
            <Chip tono={est.tono} bg="superficie">
              {est.texto}
            </Chip>
            {s.aislado && (
              <Chip tono="alerta" bg="superficie" icono={<IconoCerrado tam="1em" />}>
                aislado
              </Chip>
            )}
          </Flex>
        </Box>
      </Flex>
      <Box>
        <Flex align="baseline" gap={2} wrap="wrap">
          <Text textStyle="cifraMedia" fontSize="1.625rem">
            {fmtNum(s.personas_k10)}
          </Text>
          <Text fontSize="sm" color="textoSuave">
            personas{s.personas_registradas > 0 && <> + {fmtNum(s.personas_registradas)} registradas ({fmtNum(s.familias_registradas)} familias)</>}
          </Text>
        </Flex>
        <Text textStyle="microdato" mt={0.5}>
          {s.margen_a_compromiso_m <= 0
            ? `Superó su altura de compromiso (${fmtM(s.altura_compromiso_m)}) por ${fmtM(Math.abs(s.margen_a_compromiso_m))}`
            : `Le faltan ${fmtM(s.margen_a_compromiso_m)} para su compromiso (${fmtM(s.altura_compromiso_m)})`}
        </Text>
      </Box>
      <Box as="ul" listStyleType="none" m={0} p={0} display="flex" flexDirection="column" gap={1.5}>
        <Dato icono={<IconoMascota tam="1.125rem" />}>
          Animales <strong>{fmtNum(s.animales_expuestos)}</strong>
          {s.colmenas > 0 && <> · Colmenas {fmtNum(s.colmenas)}</>}
        </Dato>
        <Dato icono={cerrados.length === 0 ? <IconoRumbo tam="1.125rem" /> : <IconoCerrado tam="1.125rem" />} tono={cerrados.length > 0 ? "alerta" : undefined}>
          {s.accesos.length === 0 ? "Sin accesos cargados" : cerrados.length === 0 ? `${s.accesos.length} ${s.accesos.length === 1 ? "acceso transitable" : "accesos transitables"}` : cerrados.map((a) => `${a.nombre} (${NOMBRE_ACCESO[a.estado] ?? a.estado})`).join("; ")}
        </Dato>
        <Dato icono={<IconoEdificio tam="1.125rem" />}>
          <Text as="span" color="textoSuave">
            Centro sugerido: {c?.personas ? `${c.personas.nombre}, a ${(c.personas.distancia_linea_recta_m / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} km` : "sin centro con cupo"}. La autoridad lo define.
          </Text>
        </Dato>
      </Box>
    </Flex>
  );
}

export function TarjetasSectores({ bloque }: { bloque: ResumenPanel["sectores"] }) {
  return (
    <Seccion titulo="Sectores" categoria={bloque.categoria} id="tab-sectores" icono={<IconoAlerta />} derecha={`Con el río en ${fmtM(bloque.altura_usada_m)}`}>
      <SimpleGrid minChildWidth="15.5rem" spacing={3}>
        {bloque.items.map((s) => (
          <TarjetaSector key={s.id} s={s} />
        ))}
      </SimpleGrid>
    </Seccion>
  );
}

/** Accesos que no están transitables, de todos los sectores (vista del operador). */
export function AccesosCerrados({ sectores }: { sectores: ResumenSector[] }) {
  const filas = sectores.flatMap((s) => s.accesos.filter((a) => a.estado !== "transitable").map((a) => ({ sector: s.id, ...a })));
  return (
    <Seccion titulo="Accesos no transitables" categoria="SIMULADO" id="tab-accesos" icono={<IconoCerrado />}>
      {filas.length === 0 ? (
        <Flex gap={2} align="center" fontSize="sm">
          <Box color="verde.600">
            <IconoTilde />
          </Box>
          Todos los accesos cargados figuran transitables con este escenario.
        </Flex>
      ) : (
        <Box as="ul" m={0} p={0} listStyleType="none" fontSize="sm" data-testid="tablero-accesos-cerrados">
          {filas.map((f) => (
            <Flex as="li" key={`${f.sector}-${f.nombre}`} justify="space-between" align="center" gap={3} wrap="wrap" {...FILA}>
              <Flex gap={2} align="center" minW={0}>
                <Chip tono="neutro">{f.sector}</Chip>
                <span>
                  {f.nombre} ({f.superficie})
                </span>
              </Flex>
              <Chip tono="alerta" icono={<IconoCerrado tam="1em" />}>
                {NOMBRE_ACCESO[f.estado] ?? f.estado}
              </Chip>
            </Flex>
          ))}
        </Box>
      )}
      <Text mt={3} fontSize="sm">
        <Link as={RouterLink} to="/comando/mapa" className="enlace-toque" color="primarioHover" fontWeight={600}>
          Marcar o liberar caminos en el mapa
        </Link>
      </Text>
    </Seccion>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Solicitudes                                                                                      */
/* ------------------------------------------------------------------------------------------------ */

export function BloqueSolicitudesResumen({ sol }: { sol: ResumenPanel["solicitudes"] }) {
  const embudo = ESTADOS_SOLICITUD.map((e) => ({ id: e, etiqueta: etiquetaEstadoSolicitud(e), valor: sol.por_estado[e] ?? 0 }));
  const porSector = Object.entries(sol.por_sector).map(([k, v]) => ({ id: k, etiqueta: k === "sin_sector" ? "Sin sector" : k, valor: v }));
  const porOrigen = Object.entries(sol.por_origen).map(([k, v]) => ({ id: k, etiqueta: etiquetaOrigenSolicitud(k), valor: v }));
  return (
    <Seccion titulo="Pedidos de asistencia" categoria={sol.categoria} id="tab-solicitudes" icono={<IconoBandeja />} derecha={`${fmtNum(sol.total)} en total`}>
      {sol.total === 0 ? (
        <Text fontSize="sm">Todavía no llegó ningún pedido.</Text>
      ) : (
        <>
          <Flex gap={{ base: 6, md: 10 }} wrap="wrap" mb={5}>
            <Box>
              <Flex align="center" gap={1.5} textStyle="rotulo">
                <IconoReloj tam="1rem" />
                Recibida más antigua sin atender
              </Flex>
              <Text textStyle="cifraMedia" data-testid="tablero-mas-antigua" mt={1}>
                {sol.recibidas_mas_antigua_min === null ? "ninguna" : duracionCorta(sol.recibidas_mas_antigua_min)}
              </Text>
            </Box>
            <Box>
              <Flex align="center" gap={1.5} textStyle="rotulo">
                <IconoTriangulo tam="1rem" />
                A verificar
              </Flex>
              <Text textStyle="cifraMedia" data-testid="tablero-a-verificar" mt={1}>
                {fmtNum(sol.a_verificar)}
              </Text>
              <Link as={RouterLink} to="/comando/operacion?estado=recibida" className="enlace-toque" fontSize="sm" color="primarioHover" fontWeight={600}>
                Ver las recibidas
              </Link>
            </Box>
          </Flex>
          <SimpleGrid columns={{ base: 1, md: 3, xl: 1, "2xl": 3 }} spacing={{ base: 5, md: 6 }}>
            <Box>
              <Heading as="h3" size="xs" mb={1.5}>
                Por estado
              </Heading>
              <Barras etiqueta="Pedidos por estado" filas={embudo} />
            </Box>
            <Box>
              <Heading as="h3" size="xs" mb={1.5}>
                Por sector
              </Heading>
              <Barras etiqueta="Pedidos por sector" filas={porSector} />
            </Box>
            <Box>
              <Heading as="h3" size="xs" mb={1.5}>
                Por canal
              </Heading>
              <Barras etiqueta="Pedidos por canal" filas={porOrigen} />
            </Box>
          </SimpleGrid>
        </>
      )}
    </Seccion>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Centros y cuadrillas                                                                              */
/* ------------------------------------------------------------------------------------------------ */

function estadoOcupacion(pct: number | null): { texto: string; color: string; tono: TonoChip } {
  if (pct === null) return { texto: "sin capacidad cargada", color: "pizarra.500", tono: "neutro" };
  if (pct >= 100) return { texto: "completo", color: "umbral.evacuacion", tono: "alerta" };
  if (pct >= 80) return { texto: "casi completo", color: "umbral.alerta", tono: "aviso" };
  return { texto: "con cupo", color: "agua.600", tono: "info" };
}

export function BloqueCentros({ bloque }: { bloque: ResumenPanel["centros"] }) {
  return (
    <Seccion titulo="Centros de recepción" categoria={bloque.categoria} id="tab-centros" icono={<IconoEdificio />}>
      {bloque.items.length === 0 ? (
        <Text fontSize="sm">No hay centros cargados.</Text>
      ) : (
        <Box as="ul" listStyleType="none" m={0} p={0} aria-label="Ocupación de los centros">
          {bloque.items.map((c: ResumenCentro) => {
            const e = estadoOcupacion(c.ocupacion_pct);
            return (
              <Box as="li" key={c.id} data-testid={`tablero-centro-${c.id}`} {...FILA}>
                <Flex justify="space-between" align="center" gap={3} wrap="wrap">
                  <Text fontWeight={600} fontSize="sm">
                    {c.nombre}
                  </Text>
                  <Chip tono={e.tono}>{e.texto}</Chip>
                </Flex>
                <Text fontSize="sm" mt={0.5} sx={{ fontVariantNumeric: "tabular-nums" }}>
                  <strong>{fmtNum(c.ocupacion)}</strong> de {fmtNum(c.capacidad_personas)} personas
                  {c.ocupacion_pct !== null && ` (${fmtNum(c.ocupacion_pct)} %)`}
                </Text>
                <Box h="10px" mt={1.5} bg="pizarra.100" borderRadius="full" overflow="hidden" aria-hidden="true">
                  <Box h="100%" w={`${Math.min(100, c.ocupacion_pct ?? 0)}%`} minW={c.ocupacion > 0 ? "4px" : 0} bg={e.color} borderRadius="full" />
                </Box>
                <Text textStyle="microdato" mt={1}>
                  Capacidad para animales: {fmtNum(c.capacidad_animales)}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}
    </Seccion>
  );
}

const ESTADOS_TAREA_ORDEN = [
  ["pendiente", "pendientes"],
  ["en_curso", "en curso"],
  ["completada", "completadas"],
] as const;

const abiertas = (c: ResumenCuadrilla) => (c.tareas.pendiente ?? 0) + (c.tareas.en_curso ?? 0);

export function BloqueCuadrillas({ bloque }: { bloque: ResumenPanel["cuadrillas"] }) {
  return (
    <Seccion titulo="Cuadrillas y tareas" categoria={bloque.categoria} id="tab-cuadrillas" icono={<IconoPersonas />}>
      {bloque.tareas_sin_cuadrilla > 0 && (
        <Alert status="warning" variant="subtle" fontSize="sm" mb={3} data-testid="tablero-sin-cuadrilla">
          <AlertIcon />
          <AlertDescription>
            {fmtNum(bloque.tareas_sin_cuadrilla)} {bloque.tareas_sin_cuadrilla === 1 ? "tarea sin cuadrilla asignada" : "tareas sin cuadrilla asignada"}.{" "}
            <Link as={RouterLink} to="/comando/operacion" className="enlace-toque" fontWeight={600}>
              Asignar
            </Link>
          </AlertDescription>
        </Alert>
      )}
      {bloque.items.length === 0 ? (
        <Text fontSize="sm">Todavía no hay cuadrillas.</Text>
      ) : (
        <Box as="ul" listStyleType="none" m={0} p={0} aria-label="Cuadrillas y tareas por estado">
          {bloque.items.map((c: ResumenCuadrilla) => (
            <Box as="li" key={c.id} {...FILA}>
              <Flex justify="space-between" align="center" gap={3} wrap="wrap">
                <Box minW={0}>
                  <Text fontWeight={600} fontSize="sm">
                    {c.nombre}
                  </Text>
                  <Text textStyle="microdato">{TIPO_INCIDENTE[c.tipo_incidente] ?? c.tipo_incidente}</Text>
                </Box>
                {abiertas(c) === 0 ? (
                  <Chip tono="ok" icono={<IconoTilde tam="1em" />}>
                    libre
                  </Chip>
                ) : (
                  <Chip tono="info" icono={<IconoReloj tam="1em" />}>
                    con tareas
                  </Chip>
                )}
              </Flex>
              <Flex gap={4} mt={1.5} wrap="wrap" fontSize="sm">
                {ESTADOS_TAREA_ORDEN.map(([e, t]) => (
                  <Text as="span" key={e} color="textoSuave" sx={{ fontVariantNumeric: "tabular-nums" }}>
                    <Text as="strong" color="texto">
                      {fmtNum(c.tareas[e] ?? 0)}
                    </Text>{" "}
                    {t}
                  </Text>
                ))}
              </Flex>
            </Box>
          ))}
        </Box>
      )}
    </Seccion>
  );
}

/** Cuadrillas sin tareas abiertas (vista del operador). */
export function CuadrillasLibres({ bloque }: { bloque: ResumenPanel["cuadrillas"] }) {
  const libres = bloque.items.filter((c) => abiertas(c) === 0);
  return (
    <Seccion titulo="Cuadrillas libres" categoria={bloque.categoria} id="tab-libres" icono={<IconoPersonas />}>
      {libres.length === 0 ? (
        <Text fontSize="sm">Todas las cuadrillas tienen tareas abiertas.</Text>
      ) : (
        <Box as="ul" m={0} p={0} listStyleType="none" fontSize="sm" data-testid="tablero-libres">
          {libres.map((c) => (
            <Flex as="li" key={c.id} justify="space-between" align="center" gap={3} wrap="wrap" {...FILA}>
              <Text fontWeight={600}>{c.nombre}</Text>
              <Chip tono="ok" icono={<IconoTilde tam="1em" />}>
                {TIPO_INCIDENTE[c.tipo_incidente] ?? c.tipo_incidente}
              </Chip>
            </Flex>
          ))}
        </Box>
      )}
      {bloque.tareas_sin_cuadrilla > 0 && (
        <Text mt={3} fontSize="sm">
          Hay {fmtNum(bloque.tareas_sin_cuadrilla)} {bloque.tareas_sin_cuadrilla === 1 ? "tarea" : "tareas"} sin cuadrilla para asignarles.
        </Text>
      )}
    </Seccion>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Órdenes, lluvia, evacuaciones                                                                    */
/* ------------------------------------------------------------------------------------------------ */

export function BloqueOrdenes({ bloque, decisor }: { bloque: ResumenPanel["ordenes"]; decisor: boolean }) {
  return (
    <Seccion titulo="Órdenes recientes" categoria={bloque.categoria} id="tab-ordenes" icono={<IconoMegafono />}>
      {bloque.bitacora_borradores > 0 && (
        <Alert status="warning" variant="subtle" fontSize="sm" mb={3} data-testid="tablero-borradores">
          <AlertIcon />
          <AlertDescription>
            {fmtNum(bloque.bitacora_borradores)} {bloque.bitacora_borradores === 1 ? "borrador de bitácora espera" : "borradores de bitácora esperan"} la firma de una decisión.{" "}
            <Link as={RouterLink} to="/comando/bitacora" className="enlace-toque" fontWeight={600}>
              Completar en la bitácora
            </Link>
          </AlertDescription>
        </Alert>
      )}
      {bloque.recientes.length === 0 ? (
        <Text fontSize="sm">Todavía no se emitió ninguna orden.{decisor ? "" : " Las emite el decisor."}</Text>
      ) : (
        <Box as="ul" m={0} p={0} listStyleType="none" fontSize="sm">
          {bloque.recientes.map((o) => (
            <Box as="li" key={o.id} {...FILA}>
              <Flex align="center" gap={2} wrap="wrap">
                <Chip tono={TONO_ORDEN[o.tipo] ?? "neutro"} icono={<IconoMegafono tam="1em" />}>
                  {TIPO_ORDEN[o.tipo] ?? o.tipo}
                </Chip>
                <Text fontWeight={600}>{o.sectores.join(", ")}</Text>
              </Flex>
              <Text textStyle="microdato" mt={1}>
                {o.emitida_por_rol ? etiquetaRolOperativo(o.emitida_por_rol) : "sin rol"} · {fechaHora(o.creada_en)}
              </Text>
            </Box>
          ))}
        </Box>
      )}
    </Seccion>
  );
}

export function BloqueLluvia({ bloque }: { bloque: ResumenPanel["lluvia_7d"] }) {
  const origenes = Object.entries(bloque.por_origen);
  // Si todos los orígenes comparten la categoría del bloque, ya figura en el encabezado y no se repite por fila.
  const mixto = origenes.some(([, d]) => d.categoria !== bloque.categoria);
  return (
    <Seccion titulo="Lluvia de los últimos 7 días" categoria={bloque.categoria} id="tab-lluvia" icono={<IconoGota />} derecha={`Desde el ${fmtFecha(bloque.desde)}`}>
      {bloque.sin_dato_observado && (
        <Flex gap={2} align="flex-start" fontSize="sm" mb={3} data-testid="tablero-lluvia-sin-observado">
          <Box color="textoSuave" mt="2px">
            <IconoPunto tam="1.125rem" />
          </Box>
          <Text>Sin dato observado: el kit no trae lluvia medida. {origenes.length === 0 ? "Tampoco se cargó ningún parte en estos días." : "Lo que figura abajo son partes cargados o datos simulados, con su origen."}</Text>
        </Flex>
      )}
      {origenes.length > 0 && (
        <TablaDesplazable etiqueta="Lluvia por origen">
          <Table size="sm" aria-label="Lluvia por origen" sx={APILAR}>
            <Thead>
              <Tr>
                <Th>Origen</Th>
                <Th isNumeric>Lecturas</Th>
                <Th isNumeric>mm acumulados</Th>
                <Th isNumeric>Sin medición</Th>
                {mixto && <Th>Categoría</Th>}
              </Tr>
            </Thead>
            <Tbody>
              {origenes.map(([o, d]) => (
                <Tr key={o}>
                  <Td>{etiquetaOrigenLluvia(o)}</Td>
                  <Td isNumeric data-etiqueta="Lecturas">{fmtNum(d.lecturas)}</Td>
                  <Td isNumeric data-etiqueta="mm acumulados">{fmtNum(d.mm_total, 1)}</Td>
                  <Td isNumeric data-etiqueta="Sin medición">{fmtNum(d.sin_medicion)}</Td>
                  {mixto && (
                    <Td data-etiqueta="Categoría">
                      <Insignia categoria={d.categoria} />
                    </Td>
                  )}
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TablaDesplazable>
      )}
      <Text textStyle="microdato" mt={3}>
        Una lectura sin medición no es cero: se cuenta aparte.
      </Text>
    </Seccion>
  );
}

const COLUMNAS_EVACUACION = [
  ["pendiente", "Pendientes"],
  ["en_curso", "En curso"],
  ["cerrada_cuadrilla", "Cerradas sin confirmar"],
  ["verificada", "Verificadas"],
  ["con_discrepancia", "Con discrepancia"],
] as const;
const ETIQ_EVAC: Record<string, string> = Object.fromEntries(COLUMNAS_EVACUACION);

export function BloqueEvacuaciones({ bloque }: { bloque: ResumenEvacuaciones }) {
  const sectores = Object.entries(bloque.por_sector ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const animales = bloque.animales_trasladados_total ?? Object.values(bloque.animales_trasladados ?? {}).reduce((s, n) => s + n, 0);
  const abiertas = bloque.discrepancias_abiertas ?? 0;
  return (
    <Seccion titulo="Evacuaciones" categoria={bloque.categoria} id="tab-evacuaciones" icono={<IconoCamion />} derecha={<Link as={RouterLink} to="/comando/evacuaciones" className="enlace-toque" fontSize="sm" fontWeight={600} color="primarioHover">Ver el detalle</Link>}>
      <SimpleGrid minChildWidth="10.5rem" spacing={5} mb={4}>
        <Cifra testId="evac-personas" etiqueta="Personas trasladadas" valor={fmtNum(bloque.personas_trasladadas ?? 0)} categoria={bloque.categoria} />
        <Cifra testId="evac-animales" etiqueta="Animales trasladados" valor={fmtNum(animales)} categoria={bloque.categoria} />
        <Cifra testId="evac-verificadas" etiqueta="Verificadas por el evacuado" valor={bloque.verificadas_pct === null || bloque.verificadas_pct === undefined ? "sin dato" : `${fmtNum(bloque.verificadas_pct, 0)} %`} categoria={bloque.categoria} />
        <Cifra testId="evac-discrepancias" etiqueta="Discrepancias abiertas" valor={fmtNum(abiertas)} categoria={bloque.categoria} />
      </SimpleGrid>
      {abiertas > 0 && (
        <Alert status="warning" variant="subtle" fontSize="sm" mb={3} data-testid="evac-aviso-discrepancias">
          <AlertIcon />
          <AlertDescription>
            {fmtNum(abiertas)} {abiertas === 1 ? "evacuación para revisar" : "evacuaciones para revisar"}: es una marca, no una acusación.{" "}
            <Link as={RouterLink} to="/comando/evacuaciones" className="enlace-toque" fontWeight={600}>
              Revisar
            </Link>
          </AlertDescription>
        </Alert>
      )}
      <TablaDesplazable etiqueta="Evacuaciones por sector y estado">
        <Table size="sm" aria-label="Evacuaciones por sector y estado" sx={APILAR}>
          <Thead>
            <Tr>
              <Th>Sector</Th>
              {COLUMNAS_EVACUACION.map(([, t]) => (
                <Th key={t} isNumeric>
                  {t}
                </Th>
              ))}
            </Tr>
          </Thead>
          <Tbody>
            {sectores.length === 0 && (
              <Tr>
                <Td colSpan={6}>Todavía no hay evacuaciones.</Td>
              </Tr>
            )}
            {sectores.map(([id, c]) => (
              <Tr key={id} data-testid={`evac-sector-${id}`}>
                <Td>{id === "sin_sector" ? "Sin sector" : id}</Td>
                {COLUMNAS_EVACUACION.map(([k]) => (
                  <Td key={k} isNumeric data-etiqueta={ETIQ_EVAC[k]}>
                    {fmtNum(c[k] ?? 0)}
                  </Td>
                ))}
              </Tr>
            ))}
            <Tr fontWeight={700} data-testid="evac-total">
              <Td>Total</Td>
              {COLUMNAS_EVACUACION.map(([k]) => (
                <Td key={k} isNumeric data-etiqueta={ETIQ_EVAC[k]}>
                  {fmtNum(bloque.por_estado[k] ?? 0)}
                </Td>
              ))}
            </Tr>
          </Tbody>
        </Table>
      </TablaDesplazable>
    </Seccion>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Frescura                                                                                         */
/* ------------------------------------------------------------------------------------------------ */

const TEXTO_FRESCURA: Record<EstadoFrescura, string> = {
  al_dia: "Al día",
  al_corte: "Al corte de datos",
  vieja: "Desactualizado",
  sin_dato: "Sin datos",
  fija: "Versión fija",
};
const TONO_FRESCURA: Record<EstadoFrescura, TonoChip> = { al_dia: "ok", al_corte: "info", vieja: "aviso", sin_dato: "alerta", fija: "neutro" };

export function TablaFrescura({ resumen }: { resumen: ResumenPanel }) {
  const f = resumen.frescura;
  const filas = [
    { id: "rio", capa: "Río (Puerto Formosa)", fecha: f.rio_ultima_lectura, ev: evaluarFrescura(f.rio_ultima_lectura, resumen.generado_en, f.fecha_corte, 2), cat: resumen.rio.categoria },
    { id: "lluvia", capa: "Lluvia", fecha: f.lluvia_ultima_lectura, ev: evaluarFrescura(f.lluvia_ultima_lectura, resumen.generado_en, f.fecha_corte, 7), cat: resumen.lluvia_7d.categoria },
    { id: "k10", capa: "Sectores de evaluación", fecha: f.k10_sectores, ev: { estado: "fija" as EstadoFrescura, dias: null as number | null }, cat: "SIMULADO" as const },
  ];
  const vencidas = filas.filter((x) => x.ev.estado === "vieja" || x.ev.estado === "sin_dato");
  return (
    <Seccion titulo="Frescura de los datos" id="tab-frescura" icono={<IconoReloj />} derecha={`Corte de datos: ${fmtFecha(f.fecha_corte)}`}>
      {vencidas.length > 0 && (
        <Alert status="warning" variant="subtle" fontSize="sm" mb={3} data-testid="aviso-datos-viejos">
          <AlertIcon />
          <AlertDescription>
            {vencidas.map((x) => x.capa).join(" y ")}: {vencidas.length === 1 ? "no tiene" : "no tienen"} datos recientes. Las cifras que dependen de {vencidas.length === 1 ? "esa capa" : "esas capas"} pueden estar atrasadas.
          </AlertDescription>
        </Alert>
      )}
      <Box as="ul" listStyleType="none" m={0} p={0} aria-label="Frescura de las capas de datos">
        {filas.map((x) => (
          <Flex as="li" key={x.id} data-testid={`frescura-${x.id}`} justify="space-between" align="center" columnGap={3} rowGap={1} wrap="wrap" {...FILA}>
            <Box minW={0}>
              <Text fontWeight={600} fontSize="sm">
                {x.capa}
              </Text>
              <Text textStyle="microdato">Último dato: {x.fecha ? fmtFecha(x.fecha) : "sin dato"}</Text>
            </Box>
            <Flex gap={1.5} wrap="wrap" align="center">
              <Chip tono={TONO_FRESCURA[x.ev.estado]}>
                {TEXTO_FRESCURA[x.ev.estado]}
                {x.ev.dias !== null && x.ev.estado !== "al_corte" && x.ev.dias > 0 ? ` (hace ${x.ev.dias} d)` : ""}
              </Chip>
              {x.cat !== "SIMULADO" && <Insignia categoria={x.cat} />}
            </Flex>
          </Flex>
        ))}
      </Box>
      {filas.some((x) => x.cat === "SIMULADO") && (
        <Flex align="center" gap={2} mt={3} wrap="wrap" textStyle="microdato" data-testid="frescura-simulado">
          <Insignia categoria="SIMULADO" />
          <span>
            {filas
              .filter((x) => x.cat === "SIMULADO")
              .map((x) => x.capa)
              .join(" y ")}
            : datos de demostración.
          </span>
        </Flex>
      )}
      <Text textStyle="microdato" mt={3}>
        Los datos observados llegan hasta el corte del {fmtFecha(f.fecha_corte)}; lo posterior solo se muestra con decisión de la mesa.
      </Text>
    </Seccion>
  );
}
