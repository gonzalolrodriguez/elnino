import { Box, Flex, Heading, Link, Text, VisuallyHidden } from "@chakra-ui/react";
import { CATEGORIAS } from "@evacuaciones/shared";
import { useCallback, useEffect, useState } from "react";

import { useAuth, type Usuario } from "../auth/AuthContext";
import { EstadoCargando } from "../components/EstadoCargando";
import {
  IconoCampana,
  IconoCasa,
  IconoEdificio,
  IconoMascota,
  IconoMayor,
  IconoMenor,
  IconoPersonas,
  IconoPersona,
  IconoSalvavidas,
  IconoTelefono,
  IconoPunto,
  IconoCandado,
  IconoTilde,
} from "../components/iconos/Iconos";
import { Insignia } from "../components/Insignia";
import { Layout } from "../components/Layout";
import { Plegable } from "../components/Plegable";
import { ApiError, solicitar } from "../lib/api";
import { etiquetaEstadoUsuario, etiquetaRol, etiquetaRolOperativo, fechaHora } from "../lib/etiquetas";
import { misPedidos, pedidoActivo } from "../lib/pedidos";
import { useCarga } from "../lib/useCarga";
import { useCargaViva } from "../lib/vivo";
import { AvisoDiscreto } from "./micuenta/AvisoDiscreto";
import { Notificaciones, OrdenesVigentes, MiCentro, type Dic } from "./micuenta/Avisos";
import { EditarGrupo, type Grupo } from "./micuenta/EditarGrupo";
import { BandaSector, type MiSector } from "./micuenta/EstadoSector";
import { MiPedido } from "./micuenta/MiPedido";
import { Establecimientos } from "./micuenta/Establecimientos";
import { Dato, Panel, FichaIcono, RejillaDatos, Vacio } from "./micuenta/Panel";
import { PedidosAnteriores } from "./micuenta/PedidosAnteriores";
import { PedirAyuda } from "./micuenta/PedirAyuda";

type Recurso<T> =
  | { estado: "cargando" }
  | { estado: "ok"; datos: T }
  | { estado: "vacio" }
  | { estado: "no_disponible" }
  | { estado: "error"; mensaje: string };

type OpcionesRecurso<R, T> = {
  /** Extrae los datos de la respuesta (p. ej. `{ notificaciones: [...] }` -> lista). */
  extraer?: (respuesta: R) => T;
  /** El backend responde 404 cuando el usuario todavía no cargó el dato (p. ej. grupo familiar). */
  vacioSi404?: boolean;
  /** Si es false no se consulta (p. ej. establecimientos solo existen para productores). */
  activo?: boolean;
};

type RecursoR<T> = Recurso<T> & { recargar: () => void };

function useRecurso<T, R = T>(ruta: string, op: OpcionesRecurso<R, T> = {}): RecursoR<T> {
  const [r, setR] = useState<Recurso<T>>({ estado: "cargando" });
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((n) => n + 1), []);
  const { extraer, vacioSi404 = false, activo: habilitado = true } = op;
  useEffect(() => {
    if (!habilitado) return;
    let activo = true;
    solicitar<R>(ruta, { autenticado: true })
      .then((respuesta) => {
        if (!activo) return;
        const datos = extraer ? extraer(respuesta) : (respuesta as unknown as T);
        const vacio = datos === null || datos === undefined || (Array.isArray(datos) && datos.length === 0);
        setR(vacio ? { estado: "vacio" } : { estado: "ok", datos });
      })
      .catch((e: unknown) => {
        if (!activo) return;
        if (e instanceof ApiError && e.estado === 404) setR(vacioSi404 ? { estado: "vacio" } : { estado: "no_disponible" });
        else setR({ estado: "error", mensaje: e instanceof Error ? e.message : "Error desconocido" });
      });
    return () => {
      activo = false;
    };
    // `extraer` y las opciones son estables por llamada: la ruta identifica el recurso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta, habilitado, version]);
  return { ...r, recargar };
}

const listaDe = (clave: string) => (r: unknown): Dic[] => {
  const lista = r && typeof r === "object" ? (r as Dic)[clave] : null;
  return Array.isArray(lista) ? (lista as Dic[]) : [];
};

/** Estados de un recurso que no está listo: cargando, no disponible o con error (los demás los resuelve cada sección). */
function EstadoRecurso({ recurso }: { recurso: Recurso<unknown> }) {
  if (recurso.estado === "cargando") return <EstadoCargando py={4} />;
  if (recurso.estado === "no_disponible") return <AvisoDiscreto>Esta función todavía no está disponible en el servidor.</AvisoDiscreto>;
  if (recurso.estado === "error") return <AvisoDiscreto peligro>No se pudo cargar: {recurso.mensaje}</AvisoDiscreto>;
  return null;
}

type Par = [string, string, ((v: unknown) => string)?];

/** Datos en pares rótulo/valor: el rótulo chico y suave, el valor con el cuerpo del texto. */
function Pares({ d, claves }: { d: Dic; claves: Par[] }) {
  return (
    <Box as="dl" display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", sm: "minmax(0, 9rem) minmax(0, 1fr)", lg: "minmax(0, 1fr)", xl: "minmax(0, 8.5rem) minmax(0, 1fr)" }} columnGap={4} rowGap={0.5} fontSize="md">
      {claves
        .filter(([k]) => d[k] !== undefined && d[k] !== null)
        .map(([k, etiqueta, formato]) => (
          <Box key={k} display="contents">
            <Box as="dt" textStyle="rotulo" mt={{ base: 2.5, sm: 1.5, lg: 2.5, xl: 1.5 }} pt="2px">
              {etiqueta}
            </Box>
            <Box as="dd" m={0} mt={{ sm: 1.5, lg: 0, xl: 1.5 }} overflowWrap="anywhere">
              {formato ? formato(d[k]) : String(d[k])}
            </Box>
          </Box>
        ))}
    </Box>
  );
}

const fechaLarga = () => {
  const t = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function ResumenGrupo({ d }: { d: Dic }) {
  const conDomicilio = typeof d.lat === "number" && typeof d.lon === "number";
  return (
    <>
      <RejillaDatos>
        <Dato icono={<IconoPersonas tam="1.5rem" />} valor={d.integrantes} rotulo="Integrantes" />
        <Dato icono={<IconoMenor tam="1.5rem" />} valor={d.menores} rotulo="Menores" />
        <Dato icono={<IconoMayor tam="1.5rem" />} valor={d.mayores} rotulo="Personas mayores" />
        <Dato icono={<IconoMascota tam="1.5rem" />} valor={d.mascotas} rotulo="Mascotas" />
      </RejillaDatos>
      <Flex gap={2.5} wrap="wrap" align="center" mt={5} fontSize="sm">
        <Flex as="span" align="center" gap={1.5} px={3} py={1} borderRadius="full" bg={conDomicilio ? "agua.100" : "alerta.50"} color={conDomicilio ? "agua.800" : "alerta.800"} fontWeight={600}>
          {conDomicilio ? <IconoTilde tam="1rem" strokeWidth={2.25} /> : <IconoPunto tam="1rem" />}
          {conDomicilio ? "Domicilio marcado" : "Sin domicilio marcado"}
        </Flex>
        {d.sector_id !== undefined && d.sector_id !== null && (
          <Flex as="span" align="center" gap={2}>
            <span>Sector {String(d.sector_id)}</span>
            <Insignia categoria={CATEGORIAS.SIMULADO} />
          </Flex>
        )}
        {typeof d.actualizado_en === "string" && (
          <Text color="textoSuave" ml={{ sm: "auto" }}>
            Actualizado {fechaHora(d.actualizado_en)}
          </Text>
        )}
      </Flex>
    </>
  );
}

const REFRESCO_ACTIVO_MS = 20_000;
const REFRESCO_REPOSO_MS = 120_000;

/** Mi cuenta: panel personal. Estado de mi sector, mi pedido activo con su línea de tiempo, avisos, centro, historial y datos. */
export default function MiCuenta() {
  const { usuario } = useAuth();
  const yo = useRecurso<Usuario>("/auth/yo");
  const esProductor = usuario?.rol === "productor";
  // Contrato real (apps/backend/app/api/v1/mi.py): el grupo familiar es un objeto plano y responde 404 si
  // todavía no se cargó; establecimientos y notificaciones vienen envueltos en un objeto.
  const familia = useRecurso<Dic>("/mi/grupo-familiar", { vacioSi404: true });
  const estabs = useRecurso<Dic[], unknown>("/mi/establecimientos", { extraer: listaDe("establecimientos"), activo: esProductor });
  const notifs = useRecurso<Dic[], unknown>("/mi/notificaciones", { extraer: listaDe("notificaciones") });
  const [versionSector, setVersionSector] = useState(0);
  const sector = useCarga(() => solicitar<MiSector>("/mi/sector", { autenticado: true }), [versionSector]);

  // Mientras hay un pedido sin resolver se consulta cada ~20 s; sin pedido activo, con calma.
  const [cadaMs, setCadaMs] = useState(REFRESCO_ACTIVO_MS);
  const pedidos = useCargaViva(misPedidos, { cadaMs });
  const lista = pedidos.datos?.items ?? [];
  const activo = pedidoActivo(lista);
  const enCurso = activo !== null && activo.estado !== "resuelta";
  useEffect(() => {
    if (pedidos.datos === null) return;
    setCadaMs(enCurso ? REFRESCO_ACTIVO_MS : REFRESCO_REPOSO_MS);
  }, [pedidos.datos, enCurso]);
  const anteriores = lista.filter((p) => p !== activo);

  const recargarFamilia = familia.recargar;
  const alGuardarGrupo = useCallback(() => {
    recargarFamilia();
    setVersionSector((n) => n + 1);
  }, [recargarFamilia]);

  // Lleva al selector de domicilio con el mapa a la vista (el editor viene plegado cuando ya hay un grupo cargado).
  const [abrirMapa, setAbrirMapa] = useState(0);
  const marcarDomicilio = useCallback(() => {
    const seccion = document.getElementById("mi-grupo-familiar");
    const editor = seccion?.querySelector("details");
    if (editor) editor.open = true;
    setAbrirMapa((n) => n + 1);
    window.setTimeout(() => (document.getElementById("domicilio-selector") ?? seccion)?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 120);
  }, []);

  const recargarPedidos = pedidos.recargar;
  const alEnviarPedido = useCallback(() => {
    window.setTimeout(recargarPedidos, 800);
  }, [recargarPedidos]);

  const errorPedidos = pedidos.datos === null && pedidos.error !== null ? pedidos.error : null;
  const sinServicioPedidos = errorPedidos instanceof ApiError && errorPedidos.estado === 404;
  const sinNotificar = notifs.estado === "ok" ? notifs.datos.filter((n) => n.leida !== true).length : 0;

  return (
    <Layout titulo="Mi cuenta">
      <Box>
        <VisuallyHidden as="h1">Mi cuenta</VisuallyHidden>
        <Flex justify="space-between" align={{ base: "stretch", sm: "flex-end" }} direction={{ base: "column", sm: "row" }} gap={4} mb={{ base: 6, md: 8 }}>
          <Box minW={0}>
            <Text textStyle="pantalla" overflowWrap="anywhere" data-testid="saludo">
              Hola, {usuario?.nombre_visible}
            </Text>
            <Text color="textoSuave" mt={2}>
              {fechaLarga()}
              {usuario ? ` · ${etiquetaRol(usuario.rol)}` : ""}
            </Text>
          </Box>
          <Link
            href="tel:103"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            gap={3}
            minH="3.25rem"
            pl={2}
            pr={5}
            alignSelf={{ base: "stretch", sm: "auto" }}
            borderRadius="full"
            bg="superficie"
            border="1px solid"
            borderColor="evacuacion.300"
            color="evacuacion.800"
            fontWeight={700}
            textDecoration="none"
            flex="none"
            transition="background-color 160ms var(--ease-out), border-color 160ms var(--ease-out)"
            _hover={{ textDecoration: "none", color: "evacuacion.800", bg: "evacuacion.50", borderColor: "evacuacion.500" }}
          >
            <Flex aria-hidden="true" align="center" justify="center" w="2.5rem" h="2.5rem" borderRadius="full" bg="evacuacion.700" color="papel">
              <IconoTelefono />
            </Flex>
            <span>Emergencia: llamar al 103</span>
          </Link>
        </Flex>

        <Box mb={{ base: 5, lg: 6 }}>
          <BandaSector carga={sector} alMarcarDomicilio={marcarDomicilio} />
        </Box>

        {pedidos.cargando && (
          <Box mb={5}>
            <EstadoCargando py={4} />
          </Box>
        )}
        {errorPedidos !== null && (
          <Box mb={5} data-testid="pedidos-error">
            {sinServicioPedidos ? (
              <AvisoDiscreto>El seguimiento de pedidos todavía no está disponible en el servidor.</AvisoDiscreto>
            ) : (
              <AvisoDiscreto peligro>No pudimos consultar tus pedidos. Vamos a reintentar solos; si es urgente, llamá al 103.</AvisoDiscreto>
            )}
          </Box>
        )}
        {pedidos.datos !== null && pedidos.error !== null && (
          <Text fontSize="xs" color="textoSuave" role="status" mb={3} data-testid="pedidos-sin-actualizar">
            No pudimos actualizar tus pedidos; te mostramos lo último que recibimos.
          </Text>
        )}

        {/* En pantalla angosta todo va en una columna y el orden pone los avisos enseguida del pedido; desde lg hay columna principal y lateral. */}
        <Box display={{ base: "flex", lg: "grid" }} flexDirection="column" gridTemplateColumns={{ lg: "minmax(0, 1fr) 22rem" }} gap={{ base: 5, lg: 6 }} alignItems="start">
          <Flex display={{ base: "contents", lg: "flex" }} direction="column" gap={6} minW={0}>
            {activo && (
              <Box order={{ base: 1, lg: 0 }} w="100%">
                <MiPedido pedido={activo} alResponder={pedidos.recargar} />
              </Box>
            )}

            {!pedidos.cargando && (
              <Box
                as="section"
                aria-label="Nuevo pedido"
                order={{ base: 4, lg: 0 }}
                w="100%"
                bg="superficie"
                border="1px solid"
                borderColor="borde"
                borderRadius="2xl"
                px={{ base: 4, md: 6 }}
                py={{ base: 2, md: 3 }}
                data-testid="nuevo-pedido"
              >
                <Plegable
                  key={activo ? "con-pedido" : "sin-pedido"}
                  titulo={
                    <Flex as="span" align="center" gap={3}>
                      <FichaIcono tono="rojo">
                        <IconoSalvavidas />
                      </FichaIcono>
                      <Heading as="h2" size="md">
                        Nuevo pedido
                      </Heading>
                    </Flex>
                  }
                  abiertoInicial={activo === null}
                >
                  <Box pt={3} pb={3}>
                    <PedirAyuda esProductor={esProductor} alEnviar={alEnviarPedido} />
                  </Box>
                </Plegable>
              </Box>
            )}

            <Box order={{ base: 5, lg: 0 }} w="100%">
              <PedidosAnteriores pedidos={anteriores} />
            </Box>

            <Panel id="mi-grupo-familiar" etiqueta="Mi grupo familiar" titulo="Mi grupo familiar" icono={<IconoCasa />} order={{ base: 6, lg: 0 }} w="100%">
              {familia.estado === "cargando" && <EstadoCargando py={3} />}
              {familia.estado === "ok" && (
                <Box mb={5}>
                  <ResumenGrupo d={familia.datos} />
                </Box>
              )}
              {familia.estado === "vacio" && (
                <Box mb={4}>
                  <Vacio icono={<IconoPersonas />}>Todavía no cargaste tu grupo familiar. Contanos cuántos son y dónde viven para que podamos avisarles a tiempo.</Vacio>
                </Box>
              )}
              {/* El editor ya viene plegado cuando hay grupo cargado. */}
              {familia.estado !== "cargando" && (
                <EditarGrupo
                  key={familia.estado === "ok" ? String(familia.datos.actualizado_en ?? "ok") : familia.estado}
                  grupo={familia.estado === "ok" ? (familia.datos as Grupo) : null}
                  alGuardar={alGuardarGrupo}
                  abrirMapa={abrirMapa}
                />
              )}
            </Panel>

            {esProductor && (
              <Panel etiqueta="Mis establecimientos" titulo="Mis establecimientos" icono={<IconoEdificio />} order={{ base: 7, lg: 0 }} w="100%">
                <EstadoRecurso recurso={estabs} />
                {estabs.estado === "vacio" && <Vacio icono={<IconoEdificio />}>Todavía no registraste establecimientos. Cuando los cargues, vamos a poder avisarte y planificar el traslado del ganado.</Vacio>}
                {estabs.estado === "ok" && <Establecimientos lista={estabs.datos} />}
              </Panel>
            )}
          </Flex>

          <Flex display={{ base: "contents", lg: "flex" }} direction="column" gap={5} minW={0}>
            <Panel
              etiqueta="Avisos y órdenes"
              titulo="Avisos y órdenes"
              icono={<IconoCampana />}
              tono="alerta"
              order={{ base: 2, lg: 0 }}
              w="100%"
              accion={
                sinNotificar > 0 ? (
                  <Text as="span" fontSize="xs" fontWeight={700} px={2.5} py="2px" borderRadius="full" bg="agua.700" color="papel">
                    {sinNotificar} {sinNotificar === 1 ? "nueva" : "nuevas"}
                  </Text>
                ) : undefined
              }
            >
              {sector.estado === "ok" ? <OrdenesVigentes sectores={sector.datos.sectores} /> : <Text color="textoSuave">Se muestran cuando cargue el estado de tu sector.</Text>}
              <Box mt={5}>
                <Heading as="h3" size="sm" mb={1}>
                  Notificaciones
                </Heading>
                <EstadoRecurso recurso={notifs} />
                {notifs.estado === "vacio" && <Vacio icono={<IconoCampana />}>No tenés notificaciones.</Vacio>}
                {notifs.estado === "ok" && <Notificaciones lista={notifs.datos} alCambiar={notifs.recargar} />}
              </Box>
            </Panel>

            <Panel etiqueta="Mi centro asignado" titulo="Mi centro asignado" icono={<IconoEdificio />} tono="verde" order={{ base: 3, lg: 0 }} w="100%">
              {sector.estado === "ok" ? <MiCentro d={sector.datos} /> : <Text color="textoSuave">Se muestra cuando cargue el estado de tu sector.</Text>}
            </Panel>

            <Box as="section" aria-label="Mis datos" order={{ base: 8, lg: 0 }} w="100%" bg="superficie" border="1px solid" borderColor="borde" borderRadius="2xl" px={{ base: 4, md: 6 }} py={{ base: 2, md: 3 }}>
              <Plegable
                titulo={
                  <Flex as="span" align="center" gap={3}>
                    <FichaIcono tono="tinta">
                      <IconoPersona />
                    </FichaIcono>
                    <Heading as="h2" size="md">
                      Mis datos
                    </Heading>
                  </Flex>
                }
              >
                <Box pt={2} pb={3}>
                  <EstadoRecurso recurso={yo} />
                  {yo.estado === "vacio" && <Text>Sin datos.</Text>}
                  {yo.estado === "ok" && (
                    <>
                      <Pares
                        d={yo.datos as unknown as Dic}
                        claves={[
                          ["nombre_visible", "Nombre"],
                          ["email", "Correo"],
                          ["rol", "Rol", (r) => etiquetaRol(String(r))],
                          ["rol_operativo", "Rol operativo", (r) => etiquetaRolOperativo(String(r))],
                          ["estado", "Estado", (r) => etiquetaEstadoUsuario(String(r))],
                          ["creado_en", "Alta", (r) => fechaHora(String(r))],
                          ["ultimo_login", "Último ingreso", (r) => fechaHora(String(r))],
                        ]}
                      />
                      <Flex align="flex-start" gap={2} mt={4} fontSize="xs" color="textoSuave">
                        <IconoCandado tam="1rem" />
                        <Text>Tus datos personales se usan solo para la gestión de emergencias (Ley 25.326).</Text>
                      </Flex>
                    </>
                  )}
                </Box>
              </Plegable>
            </Box>
          </Flex>
        </Box>
      </Box>
    </Layout>
  );
}
