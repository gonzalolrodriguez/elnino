import { Box, Divider, Flex, Heading, List, ListItem, SimpleGrid, Text } from "@chakra-ui/react";

import { IconoAlerta, IconoVehiculo } from "../../components/iconos/Iconos";
import { MuestraEstado } from "../../components/MuestraEstado";
import type { PlanSector } from "../tipos";
import { Chip, COLOR_ESTADO, fmtDias, fmtNum } from "../ui";
import { LineaFactibilidad } from "./Factibilidad";
import { NOMBRE_METODO } from "./formato";
import { Dato, Plegable } from "./piezas";

/** Recomendación de un sector: veredicto de tiempo primero, cifras clave después y el método plegado. */
export function TarjetaSector({ s }: { s: PlanSector }) {
  const c = COLOR_ESTADO[s.estado];
  const metodos = s.traslado_personas.metodo_tiempo ?? [];
  const f = s.familias;
  return (
    <Box as="article" layerStyle="tarjeta" borderLeft={`4px solid ${c.stroke}`} p={{ base: 4, md: 5 }} data-testid={`plan-${s.id}`} aria-labelledby={`plan-titulo-${s.id}`} minW={0}>
      <Flex align="center" columnGap={3} rowGap={2} wrap="wrap" mb={4}>
        <Flex aria-hidden="true" w="2rem" h="2rem" flexShrink={0} align="center" justify="center" borderRadius="full" bg="pizarra.100" color="pizarra.700" fontWeight={700} sx={{ fontVariantNumeric: "tabular-nums" }}>
          {s.prioridad}
        </Flex>
        <Box minW={0}>
          <Heading as="h3" id={`plan-titulo-${s.id}`} size="sm" lineHeight={1.2}>
            {s.id} · {s.nombre}
          </Heading>
          <Text textStyle="microdato">Prioridad {s.prioridad}</Text>
        </Box>
        <Flex gap={2} align="center" wrap="wrap" ml={{ md: "auto" }}>
          <Text as="span" fontSize="sm" fontWeight={600}>
            <MuestraEstado estado={s.estado} aislado={s.aislado} />
          </Text>
          {s.aislado && (
            <Chip tono="alerta" icono={<IconoAlerta tam="1em" />}>
              aislado
            </Chip>
          )}
        </Flex>
      </Flex>

      <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={{ base: 4, xl: 8 }} alignItems="start">
        <Flex direction="column" gap={4} minW={0}>
          {s.factibilidad ? (
            <>
              <LineaFactibilidad titulo="personas" f={s.factibilidad.personas} />
              {s.factibilidad.ganado && (
                <>
                  <Divider />
                  <LineaFactibilidad titulo="ganado" f={s.factibilidad.ganado} />
                </>
              )}
            </>
          ) : (
            <Text textStyle="microdato">Sin veredicto de factibilidad para este sector.</Text>
          )}
        </Flex>
        <SimpleGrid columns={2} spacing={4} minW={0}>
          <Dato etiqueta="Personas" valor={fmtNum(s.poblacion.total_estimada)} nota={`${fmtNum(s.poblacion.personas_registradas)} registradas en ${fmtNum(s.poblacion.familias_registradas)} grupos familiares`} />
          <Dato
            etiqueta="Producción"
            valor={`${fmtNum(s.produccion.bovinos)} bovinos`}
            nota={`${fmtNum(s.produccion.colmenas)} colmenas · ${s.produccion.establecimientos.length} establecimientos`}
          />
          <Dato
            etiqueta="Traslado"
            icono={<IconoVehiculo vehiculo={s.traslado_personas.vehiculo} tam="1.25rem" />}
            valor={`${fmtNum(s.traslado_personas.viajes)} viajes`}
            nota={`${s.traslado_personas.vehiculo} por acceso ${s.traslado_personas.superficie_acceso ?? "ninguno (aislado)"}${s.camiones_jaula > 0 ? ` · ${s.camiones_jaula} camiones jaula` : ""}`}
          />
          <Dato
            etiqueta="Ventana hasta el compromiso"
            tam={s.ventana.ya_comprometido ? "1.125rem" : undefined}
            valor={s.ventana.ya_comprometido ? "ya comprometido" : fmtDias(s.ventana.dias_hasta_compromiso_minimo, s.ventana.dias_hasta_compromiso_maximo)}
            nota="proyección lineal, SUPUESTO"
          />
        </SimpleGrid>
      </SimpleGrid>

      <Divider my={4} />
      <Text textStyle="rotulo" mb={2}>
        Dónde se alojan
      </Text>
      {s.asignacion_personas.length > 0 ? (
        <List spacing={1} fontSize="sm">
          {s.asignacion_personas.map((a) => (
            <ListItem key={a.centro_id} display="flex" justifyContent="space-between" gap={3} borderBottom="1px dashed" borderColor="borde" py="3px">
              <span>{a.centro}</span>
              <Text as="span" fontWeight={600} whiteSpace="nowrap" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {fmtNum(a.cantidad)} personas
              </Text>
            </ListItem>
          ))}
        </List>
      ) : (
        <Text fontSize="sm">Sin asignación a centros.</Text>
      )}
      {(s.personas_sin_lugar > 0 || s.animales_sin_cupo > 0) && (
        <Flex gap={2} wrap="wrap" mt={3}>
          {s.personas_sin_lugar > 0 && (
            <Chip tono="alerta" icono={<IconoAlerta tam="1em" />}>
              Sin lugar: {fmtNum(s.personas_sin_lugar)} personas
            </Chip>
          )}
          {s.animales_sin_cupo > 0 && (
            <Chip tono="alerta" icono={<IconoAlerta tam="1em" />}>
              Sin cupo: {fmtNum(s.animales_sin_cupo)} animales
            </Chip>
          )}
        </Flex>
      )}
      {f && f.registradas + f.hogares_simulados > 0 && (
        <Text fontSize="sm" mt={3} data-testid={`familias-${s.id}`}>
          <strong>Familias:</strong> {fmtNum(f.juntas)} viajan y se alojan juntas
          {f.hogares_simulados > 0 ? ` (${fmtNum(f.registradas)} registradas y ${fmtNum(f.hogares_simulados)} hogares SIMULADOS)` : ""}.
          {f.sin_lugar_entero > 0 ? ` ${fmtNum(f.sin_lugar_entero)} no entran enteras en ningún centro (${fmtNum(f.personas_en_familias_sin_lugar)} personas): no se las separa.` : ""}
        </Text>
      )}
      <Flex gap={2} align="center" wrap="wrap" mt={3}>
        <Text textStyle="rotulo">Cuadrillas sugeridas</Text>
        {s.cuadrillas_sugeridas.length > 0 ? (
          s.cuadrillas_sugeridas.map((q) => (
            <Chip key={q.tipo} tono="neutro">
              {q.tipo}
            </Chip>
          ))
        ) : (
          <Text fontSize="sm">ninguna</Text>
        )}
      </Flex>

      <Plegable mt={3} resumen={s.advertencias.length > 0 ? `Supuestos y método (${s.advertencias.length} ${s.advertencias.length === 1 ? "aviso" : "avisos"})` : "Supuestos y método"}>
        <List spacing={1.5} styleType="disc" pl={4} color="textoSuave">
          <ListItem>Ventana hasta el compromiso: proyección lineal del río (SUPUESTO).</ListItem>
          {metodos.length > 0 && <ListItem>Tiempos de traslado {metodos.map((m) => NOMBRE_METODO[m] ?? m).join(" y ")}.</ListItem>}
          {s.traslado_personas.tiempo_inicio_min ? <ListItem>Empieza a los {fmtNum(s.traslado_personas.tiempo_inicio_min)} min, cuando se libera la flota.</ListItem> : null}
          {s.factibilidad && <ListItem>Margen de seguridad del plazo: {fmtNum(s.factibilidad.margen_seguridad_fraccion * 100)} % (SUPUESTO).</ListItem>}
          {(s.factibilidad?.supuestos ?? []).map((x) => (
            <ListItem key={x}>{x}</ListItem>
          ))}
          {s.advertencias.map((a) => (
            <ListItem key={a} color="cat.simulado.fg">
              {a}
            </ListItem>
          ))}
        </List>
      </Plegable>
    </Box>
  );
}
