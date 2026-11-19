import { Alert, AlertDescription, AlertIcon, Badge, Box, Flex, Heading, Link, SimpleGrid, Table, Tbody, Td, Text, Th, Thead, Tr } from "@chakra-ui/react";
import { ESTADOS_SOLICITUD } from "@evacuaciones/shared";
import { Link as RouterLink } from "react-router-dom";

import { Insignia } from "../../components/Insignia";
import { TablaDesplazable } from "../../components/TablaDesplazable";
import { ESTADOS } from "../../estilo/estados";
import { etiquetaEstadoSolicitud, etiquetaOrigenLluvia, etiquetaOrigenSolicitud, etiquetaRolOperativo, fechaHora } from "../../lib/etiquetas";
import { duracionCorta } from "../../lib/vivo";
import type { ResumenCentro, ResumenCuadrilla, ResumenEvacuaciones, ResumenPanel, ResumenRio, ResumenSector } from "../tipos";
import { Cifra, fmtDias, fmtFecha, fmtM, fmtNum, NOMBRE_ACCESO, Seccion } from "../ui";
import { Barras } from "./Barras";
import { EscalaRio } from "./EscalaRio";
import { evaluarFrescura, type EstadoFrescura } from "./frescura";

const TIPO_ORDEN: Record<string, string> = { alerta: "Alerta", evacuacion_preventiva: "Evacuación preventiva", evacuacion: "Evacuación" };
const TIPO_INCIDENTE: Record<string, string> = { humana: "Humana y servicios", ganadera: "Ganadera", apicola: "Apícola" };

const signo = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;

/* ------------------------------------------------------------------------------------------------ */
/* Río                                                                                              */
/* ------------------------------------------------------------------------------------------------ */

/** Barra de escenario: la altura observada frente a 7,80 y 8,30 m, la tendencia y el tiempo restante con su supuesto. */
export function BarraEscenario({ rio, resumida = false }: { rio: ResumenRio; resumida?: boolean }) {
  if (!rio.disponible || rio.altura_m === undefined || rio.umbral_alerta_m === undefined || rio.umbral_evacuacion_m === undefined) {
    return (
      <Seccion titulo="Río en Puerto Formosa" categoria={rio.categoria} id="tab-rio">
        <Text fontSize="sm">Todavía no hay lecturas del río cargadas: no se puede calcular la distancia a los umbrales.</Text>
      </Seccion>
    );
  }
  const distA = rio.distancia_a_alerta_m ?? rio.umbral_alerta_m - rio.altura_m;
  const textoDist = distA <= 0 ? `superó la alerta por ${fmtM(Math.abs(distA))}` : `a ${fmtM(distA)} de la alerta`;
  if (resumida) {
    return (
      <Flex layerStyle="tarjeta" px={4} py={3} mb={5} gap={2} align="center" wrap="wrap" data-testid="escenario-resumido" role="region" aria-label="Río en Puerto Formosa">
        <Text fontSize="sm">
          Río en Puerto Formosa: <strong>{fmtM(rio.altura_m)}</strong> ({fmtFecha(rio.fecha_lectura)}), {textoDist}; evacuación en {fmtM(rio.umbral_evacuacion_m)}.
        </Text>
        <Insignia categoria={rio.categoria} />
      </Flex>
    );
  }
  const tiempos = rio.tiempo_a_umbrales ?? [];
  return (
    <Seccion titulo="Río en Puerto Formosa" categoria={rio.categoria} id="tab-rio" derecha={<Text fontSize="xs" color="textoSuave">{[rio.fuente, fmtFecha(rio.fecha_lectura)].join(" · ")}</Text>}>
      <Flex gap={{ base: 4, lg: 8 }} direction={{ base: "column", lg: "row" }}>
        <Box flex="1.2" minW={0}>
          <Text textStyle="cifra" fontSize={{ base: "2rem", md: "2.5rem" }} data-testid="tablero-altura">
            {fmtM(rio.altura_m)}
          </Text>
          <Text fontSize="sm" color="textoSuave" mb={3}>
            {textoDist.charAt(0).toUpperCase() + textoDist.slice(1)}
            {rio.tendencia_7d_m !== null && rio.tendencia_7d_m !== undefined ? ` · ${signo(rio.tendencia_7d_m)} en 7 días` : " · tendencia de 7 días sin dato"}
          </Text>
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
                <Flex as="li" key={t.objetivo} justify="space-between" gap={3} py={1} borderBottom="1px solid" borderColor="borde">
                  <span>
                    {t.objetivo} ({fmtM(t.valor_m)})
                  </span>
                  <strong>{t.ya_alcanzado ? "ya alcanzado" : fmtDias(t.dias_minimo, t.dias_maximo)}</strong>
                </Flex>
              ))}
            </Box>
          )}
          {rio.supuesto_proyeccion && (
            <Text fontSize="xs" color="textoSuave" mt={2} data-testid="tablero-supuesto">
              <strong>Supuesto:</strong> {rio.supuesto_proyeccion}
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

function TarjetaSector({ s }: { s: ResumenSector }) {
  const est = ESTADOS[s.estado];
  const cerrados = s.accesos.filter((a) => a.estado !== "transitable");
  const c = s.centro_sugerido;
  return (
    <Box layerStyle="tarjeta" p={4} borderLeft="6px solid" borderLeftColor={est.stroke} data-testid={`tablero-sector-${s.id}`} minW={0}>
      <Flex align="baseline" gap={2} wrap="wrap">
        <Heading as="h3" size="sm">
          {s.nombre}
        </Heading>
        <Badge colorScheme="gray" textTransform="none" fontSize="0.75rem">
          {est.texto}
        </Badge>
        {s.aislado && (
          <Badge colorScheme="red" textTransform="none" fontSize="0.75rem">
            aislado
          </Badge>
        )}
      </Flex>
      <Text fontSize="xs" color="textoSuave" mb={2}>
        {s.margen_a_compromiso_m <= 0
          ? `Superó su altura de compromiso (${fmtM(s.altura_compromiso_m)}) por ${fmtM(Math.abs(s.margen_a_compromiso_m))}`
          : `Le faltan ${fmtM(s.margen_a_compromiso_m)} para su compromiso (${fmtM(s.altura_compromiso_m)})`}
      </Text>
      <Text fontSize="sm">
        Personas: <strong>{fmtNum(s.personas_k10)}</strong>
        {s.personas_registradas > 0 && <> + {fmtNum(s.personas_registradas)} registradas ({fmtNum(s.familias_registradas)} familias)</>}
      </Text>
      <Text fontSize="sm">
        Animales: <strong>{fmtNum(s.animales_expuestos)}</strong>
        {s.colmenas > 0 && <> · Colmenas: {fmtNum(s.colmenas)}</>}
      </Text>
      <Text fontSize="sm" mt={1}>
        Accesos: {s.accesos.length === 0 ? "sin accesos cargados" : cerrados.length === 0 ? `${s.accesos.length} transitables` : cerrados.map((a) => `${a.nombre} (${NOMBRE_ACCESO[a.estado] ?? a.estado})`).join("; ")}
      </Text>
      <Text fontSize="xs" color="textoSuave" mt={1}>
        Centro sugerido: {c?.personas ? `${c.personas.nombre}, a ${(c.personas.distancia_linea_recta_m / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} km` : "sin centro con cupo"}. La autoridad lo define.
      </Text>
      <Box mt={2}>
        <Insignia categoria="SIMULADO" />
      </Box>
    </Box>
  );
}

export function TarjetasSectores({ bloque }: { bloque: ResumenPanel["sectores"] }) {
  return (
    <Seccion titulo="Sectores" categoria={bloque.categoria} id="tab-sectores" derecha={<Text fontSize="xs" color="textoSuave">Con el río en {fmtM(bloque.altura_usada_m)}</Text>}>
      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={3}>
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
    <Seccion titulo="Accesos no transitables" categoria="SIMULADO" id="tab-accesos">
      {filas.length === 0 ? (
        <Text fontSize="sm">Todos los accesos cargados figuran transitables con este escenario.</Text>
      ) : (
        <Box as="ul" m={0} p={0} listStyleType="none" fontSize="sm" data-testid="tablero-accesos-cerrados">
          {filas.map((f) => (
            <Flex as="li" key={`${f.sector}-${f.nombre}`} justify="space-between" gap={3} py={1} borderBottom="1px solid" borderColor="borde">
              <span>
                {f.sector} · {f.nombre} ({f.superficie})
              </span>
              <strong>{NOMBRE_ACCESO[f.estado] ?? f.estado}</strong>
            </Flex>
          ))}
        </Box>
      )}
      <Text mt={2} fontSize="sm">
        <Link as={RouterLink} to="/comando/mapa" color="primarioHover" fontWeight={600}>
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
    <Seccion titulo="Pedidos de asistencia" categoria={sol.categoria} id="tab-solicitudes" derecha={<Text fontSize="xs" color="textoSuave">{fmtNum(sol.total)} en total</Text>}>
      {sol.total === 0 ? (
        <Text fontSize="sm">Todavía no llegó ningún pedido.</Text>
      ) : (
        <>
          <Flex gap={6} wrap="wrap" mb={4}>
            <Box>
              <Text fontSize="xs" color="textoSuave">
                Recibida más antigua sin atender
              </Text>
              <Text textStyle="cifra" fontSize="1.5rem" data-testid="tablero-mas-antigua">
                {sol.recibidas_mas_antigua_min === null ? "ninguna" : duracionCorta(sol.recibidas_mas_antigua_min)}
              </Text>
            </Box>
            <Box>
              <Text fontSize="xs" color="textoSuave">
                A verificar
              </Text>
              <Text textStyle="cifra" fontSize="1.5rem" data-testid="tablero-a-verificar">
                {fmtNum(sol.a_verificar)}
              </Text>
              <Link as={RouterLink} to="/comando/operacion?estado=recibida" fontSize="sm" color="primarioHover" fontWeight={600}>
                Ver las recibidas
              </Link>
            </Box>
          </Flex>
          <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={{ base: 4, lg: 6 }}>
            <Box>
              <Heading as="h3" size="xs" mb={1}>
                Por estado
              </Heading>
              <Barras etiqueta="Pedidos por estado" filas={embudo} />
            </Box>
            <Box>
              <Heading as="h3" size="xs" mb={1}>
                Por sector
              </Heading>
              <Barras etiqueta="Pedidos por sector" filas={porSector} />
            </Box>
            <Box>
              <Heading as="h3" size="xs" mb={1}>
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

function estadoOcupacion(pct: number | null): { texto: string; color: string } {
  if (pct === null) return { texto: "sin capacidad cargada", color: "pizarra.500" };
  if (pct >= 100) return { texto: "completo", color: "umbral.evacuacion" };
  if (pct >= 80) return { texto: "casi completo", color: "umbral.alerta" };
  return { texto: "con cupo", color: "agua.600" };
}

export function BloqueCentros({ bloque }: { bloque: ResumenPanel["centros"] }) {
  return (
    <Seccion titulo="Centros de recepción" categoria={bloque.categoria} id="tab-centros">
      {bloque.items.length === 0 ? (
        <Text fontSize="sm">No hay centros cargados.</Text>
      ) : (
        <Box as="ul" listStyleType="none" m={0} p={0} aria-label="Ocupación de los centros">
          {bloque.items.map((c: ResumenCentro) => {
            const e = estadoOcupacion(c.ocupacion_pct);
            return (
              <Box as="li" key={c.id} py={2} data-testid={`tablero-centro-${c.id}`}>
                <Flex justify="space-between" gap={3} fontSize="sm" wrap="wrap">
                  <span>{c.nombre}</span>
                  <span>
                    <strong>{fmtNum(c.ocupacion)}</strong> de {fmtNum(c.capacidad_personas)} personas
                    {c.ocupacion_pct !== null && ` (${fmtNum(c.ocupacion_pct)} %)`} · {e.texto}
                  </span>
                </Flex>
                <Box h="8px" mt={1} bg="pizarra.100" borderRadius="full" overflow="hidden" aria-hidden="true">
                  <Box h="100%" w={`${Math.min(100, c.ocupacion_pct ?? 0)}%`} minW={c.ocupacion > 0 ? "4px" : 0} bg={e.color} borderRadius="full" />
                </Box>
                <Text fontSize="xs" color="textoSuave">
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
  ["pendiente", "Pendientes"],
  ["en_curso", "En curso"],
  ["completada", "Completadas"],
] as const;

export function BloqueCuadrillas({ bloque }: { bloque: ResumenPanel["cuadrillas"] }) {
  return (
    <Seccion titulo="Cuadrillas y tareas" categoria={bloque.categoria} id="tab-cuadrillas">
      {bloque.tareas_sin_cuadrilla > 0 && (
        <Alert status="warning" variant="subtle" fontSize="sm" mb={3} data-testid="tablero-sin-cuadrilla">
          <AlertIcon />
          <AlertDescription>
            {fmtNum(bloque.tareas_sin_cuadrilla)} {bloque.tareas_sin_cuadrilla === 1 ? "tarea sin cuadrilla asignada" : "tareas sin cuadrilla asignada"}.{" "}
            <Link as={RouterLink} to="/comando/operacion" fontWeight={600}>
              Asignar
            </Link>
          </AlertDescription>
        </Alert>
      )}
      {bloque.items.length === 0 ? (
        <Text fontSize="sm">Todavía no hay cuadrillas.</Text>
      ) : (
        <TablaDesplazable etiqueta="Cuadrillas y tareas por estado">
          <Table size="sm" aria-label="Cuadrillas y tareas por estado">
            <Thead>
              <Tr>
                <Th>Cuadrilla</Th>
                <Th>Tipo</Th>
                {ESTADOS_TAREA_ORDEN.map(([, t]) => (
                  <Th key={t} isNumeric>
                    {t}
                  </Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {bloque.items.map((c: ResumenCuadrilla) => (
                <Tr key={c.id}>
                  <Td>{c.nombre}</Td>
                  <Td>{TIPO_INCIDENTE[c.tipo_incidente] ?? c.tipo_incidente}</Td>
                  {ESTADOS_TAREA_ORDEN.map(([e]) => (
                    <Td key={e} isNumeric>
                      {fmtNum(c.tareas[e] ?? 0)}
                    </Td>
                  ))}
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TablaDesplazable>
      )}
    </Seccion>
  );
}

/** Cuadrillas sin tareas abiertas (vista del operador). */
export function CuadrillasLibres({ bloque }: { bloque: ResumenPanel["cuadrillas"] }) {
  const libres = bloque.items.filter((c) => (c.tareas.pendiente ?? 0) + (c.tareas.en_curso ?? 0) === 0);
  return (
    <Seccion titulo="Cuadrillas libres" categoria={bloque.categoria} id="tab-libres">
      {libres.length === 0 ? (
        <Text fontSize="sm">Todas las cuadrillas tienen tareas abiertas.</Text>
      ) : (
        <Box as="ul" m={0} p={0} listStyleType="none" fontSize="sm" data-testid="tablero-libres">
          {libres.map((c) => (
            <Flex as="li" key={c.id} justify="space-between" py={1} borderBottom="1px solid" borderColor="borde">
              <span>{c.nombre}</span>
              <span>{TIPO_INCIDENTE[c.tipo_incidente] ?? c.tipo_incidente}</span>
            </Flex>
          ))}
        </Box>
      )}
      {bloque.tareas_sin_cuadrilla > 0 && (
        <Text mt={2} fontSize="sm">
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
    <Seccion titulo="Órdenes recientes" categoria={bloque.categoria} id="tab-ordenes">
      {bloque.bitacora_borradores > 0 && (
        <Alert status="warning" variant="subtle" fontSize="sm" mb={3} data-testid="tablero-borradores">
          <AlertIcon />
          <AlertDescription>
            {fmtNum(bloque.bitacora_borradores)} {bloque.bitacora_borradores === 1 ? "borrador de bitácora espera" : "borradores de bitácora esperan"} la firma de una decisión.{" "}
            <Link as={RouterLink} to="/comando/bitacora" fontWeight={600}>
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
            <Flex as="li" key={o.id} justify="space-between" gap={3} py={1} borderBottom="1px solid" borderColor="borde" wrap="wrap">
              <span>
                <strong>{TIPO_ORDEN[o.tipo] ?? o.tipo}</strong> · {o.sectores.join(", ")}
              </span>
              <span>
                {o.emitida_por_rol ? etiquetaRolOperativo(o.emitida_por_rol) : "sin rol"} · {fechaHora(o.creada_en)}
              </span>
            </Flex>
          ))}
        </Box>
      )}
    </Seccion>
  );
}

export function BloqueLluvia({ bloque }: { bloque: ResumenPanel["lluvia_7d"] }) {
  const origenes = Object.entries(bloque.por_origen);
  return (
    <Seccion titulo="Lluvia de los últimos 7 días" categoria={bloque.categoria} id="tab-lluvia" derecha={<Text fontSize="xs" color="textoSuave">Desde el {fmtFecha(bloque.desde)}</Text>}>
      {bloque.sin_dato_observado && (
        <Text fontSize="sm" mb={2} data-testid="tablero-lluvia-sin-observado">
          Sin dato observado: el kit no trae lluvia medida. {origenes.length === 0 ? "Tampoco se cargó ningún parte en estos días." : "Lo que figura abajo son partes cargados o datos simulados, con su origen."}
        </Text>
      )}
      {origenes.length > 0 && (
        <TablaDesplazable etiqueta="Lluvia por origen">
          <Table size="sm" aria-label="Lluvia por origen">
            <Thead>
              <Tr>
                <Th>Origen</Th>
                <Th isNumeric>Lecturas</Th>
                <Th isNumeric>mm acumulados</Th>
                <Th isNumeric>Sin medición</Th>
                <Th>Categoría</Th>
              </Tr>
            </Thead>
            <Tbody>
              {origenes.map(([o, d]) => (
                <Tr key={o}>
                  <Td>{etiquetaOrigenLluvia(o)}</Td>
                  <Td isNumeric>{fmtNum(d.lecturas)}</Td>
                  <Td isNumeric>{fmtNum(d.mm_total, 1)}</Td>
                  <Td isNumeric>{fmtNum(d.sin_medicion)}</Td>
                  <Td>
                    <Insignia categoria={d.categoria} />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TablaDesplazable>
      )}
      <Text fontSize="xs" color="textoSuave" mt={2}>
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

export function BloqueEvacuaciones({ bloque }: { bloque: ResumenEvacuaciones }) {
  const sectores = Object.entries(bloque.por_sector ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const animales = bloque.animales_trasladados_total ?? Object.values(bloque.animales_trasladados ?? {}).reduce((s, n) => s + n, 0);
  const abiertas = bloque.discrepancias_abiertas ?? 0;
  return (
    <Seccion titulo="Evacuaciones" categoria={bloque.categoria} id="tab-evacuaciones" derecha={<Link as={RouterLink} to="/comando/evacuaciones" fontSize="sm" fontWeight={600} color="primarioHover">Ver el detalle</Link>}>
      <Flex gap={6} wrap="wrap" mb={3}>
        <Cifra testId="evac-personas" etiqueta="Personas trasladadas" valor={fmtNum(bloque.personas_trasladadas ?? 0)} categoria={bloque.categoria} />
        <Cifra testId="evac-animales" etiqueta="Animales trasladados" valor={fmtNum(animales)} categoria={bloque.categoria} />
        <Cifra testId="evac-verificadas" etiqueta="Verificadas por el evacuado" valor={bloque.verificadas_pct === null || bloque.verificadas_pct === undefined ? "sin dato" : `${fmtNum(bloque.verificadas_pct, 0)} %`} categoria={bloque.categoria} />
        <Cifra testId="evac-discrepancias" etiqueta="Discrepancias abiertas" valor={fmtNum(abiertas)} categoria={bloque.categoria} />
      </Flex>
      {abiertas > 0 && (
        <Alert status="warning" variant="subtle" fontSize="sm" mb={3} data-testid="evac-aviso-discrepancias">
          <AlertIcon />
          <AlertDescription>
            {fmtNum(abiertas)} {abiertas === 1 ? "evacuación para revisar" : "evacuaciones para revisar"}: es una marca, no una acusación.{" "}
            <Link as={RouterLink} to="/comando/evacuaciones" fontWeight={600}>
              Revisar
            </Link>
          </AlertDescription>
        </Alert>
      )}
      <TablaDesplazable etiqueta="Evacuaciones por sector y estado">
        <Table size="sm" aria-label="Evacuaciones por sector y estado">
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
                  <Td key={k} isNumeric>
                    {fmtNum(c[k] ?? 0)}
                  </Td>
                ))}
              </Tr>
            ))}
            <Tr fontWeight={700} data-testid="evac-total">
              <Td>Total</Td>
              {COLUMNAS_EVACUACION.map(([k]) => (
                <Td key={k} isNumeric>
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

export function TablaFrescura({ resumen }: { resumen: ResumenPanel }) {
  const f = resumen.frescura;
  const filas = [
    { id: "rio", capa: "Río (Puerto Formosa)", fecha: f.rio_ultima_lectura, ev: evaluarFrescura(f.rio_ultima_lectura, resumen.generado_en, f.fecha_corte, 2), cat: resumen.rio.categoria },
    { id: "lluvia", capa: "Lluvia", fecha: f.lluvia_ultima_lectura, ev: evaluarFrescura(f.lluvia_ultima_lectura, resumen.generado_en, f.fecha_corte, 7), cat: resumen.lluvia_7d.categoria },
    { id: "k10", capa: "Sectores (K10)", fecha: f.k10_sectores, ev: { estado: "fija" as EstadoFrescura, dias: null as number | null }, cat: "SIMULADO" as const },
  ];
  const vencidas = filas.filter((x) => x.ev.estado === "vieja" || x.ev.estado === "sin_dato");
  return (
    <Seccion titulo="Frescura de los datos" id="tab-frescura" derecha={<Text fontSize="xs" color="textoSuave">Corte de datos: {fmtFecha(f.fecha_corte)}</Text>}>
      {vencidas.length > 0 && (
        <Alert status="warning" variant="subtle" fontSize="sm" mb={3} data-testid="aviso-datos-viejos">
          <AlertIcon />
          <AlertDescription>
            {vencidas.map((x) => x.capa).join(" y ")}: {vencidas.length === 1 ? "no tiene" : "no tienen"} datos recientes. Las cifras que dependen de {vencidas.length === 1 ? "esa capa" : "esas capas"} pueden estar atrasadas.
          </AlertDescription>
        </Alert>
      )}
      <TablaDesplazable etiqueta="Frescura de las capas de datos">
        <Table size="sm" aria-label="Frescura de las capas de datos">
          <Thead>
            <Tr>
              <Th>Capa</Th>
              <Th>Último dato</Th>
              <Th>Estado</Th>
              <Th>Categoría</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filas.map((x) => (
              <Tr key={x.id} data-testid={`frescura-${x.id}`}>
                <Td>{x.capa}</Td>
                <Td>{x.fecha ? fmtFecha(x.fecha) : "sin dato"}</Td>
                <Td>
                  {TEXTO_FRESCURA[x.ev.estado]}
                  {x.ev.dias !== null && x.ev.estado !== "al_corte" && x.ev.dias > 0 ? ` (hace ${x.ev.dias} d)` : ""}
                </Td>
                <Td>
                  <Insignia categoria={x.cat} />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TablaDesplazable>
      <Text fontSize="xs" color="textoSuave" mt={2}>
        Los datos observados llegan hasta el corte del {fmtFecha(f.fecha_corte)}; lo posterior solo se muestra con decisión de la mesa.
      </Text>
    </Seccion>
  );
}
