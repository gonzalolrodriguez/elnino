import { Alert, AlertIcon, Box, Button, Flex, Heading, Link, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { useAuth, type Usuario } from "../auth/AuthContext";
import { EstadoCargando } from "../components/EstadoCargando";
import { Layout } from "../components/Layout";
import { Plegable } from "../components/Plegable";
import { ApiError, solicitar } from "../lib/api";
import { etiquetaEstadoUsuario, etiquetaRol, etiquetaRolOperativo, fechaHora } from "../lib/etiquetas";
import { misPedidos, pedidoActivo } from "../lib/pedidos";
import { useCarga } from "../lib/useCarga";
import { useCargaViva } from "../lib/vivo";
import { Notificaciones, OrdenesVigentes, MiCentro, type Dic } from "./micuenta/Avisos";
import { EditarGrupo, type Grupo } from "./micuenta/EditarGrupo";
import { BandaSector, type MiSector } from "./micuenta/EstadoSector";
import { MiPedido } from "./micuenta/MiPedido";
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

function Bloque<T>({ titulo, recurso, vacio, children }: { titulo: string; recurso: Recurso<T>; vacio: string; children: (datos: T) => ReactNode }) {
  return (
    <Box as="section" py={4} borderTop="1px solid" borderColor="borde" aria-label={titulo}>
      <Heading as="h2" size="md" mb={3}>
        {titulo}
      </Heading>
      {recurso.estado === "cargando" && <EstadoCargando py={4} />}
      {recurso.estado === "vacio" && <Text>{vacio}</Text>}
      {recurso.estado === "no_disponible" && (
        <Alert status="info" fontSize="sm">
          <AlertIcon />
          Esta función todavía no está disponible en el servidor.
        </Alert>
      )}
      {recurso.estado === "error" && (
        <Alert status="error" fontSize="sm" role="alert">
          <AlertIcon />
          No se pudo cargar: {recurso.mensaje}
        </Alert>
      )}
      {recurso.estado === "ok" && children(recurso.datos)}
    </Box>
  );
}

type Par = [string, string, ((v: unknown) => string)?];

function Pares({ d, claves }: { d: Dic; claves: Par[] }) {
  return (
    <Box as="dl" display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", sm: "12rem minmax(0, 1fr)" }} columnGap={4} rowGap={0.5} fontSize="md">
      {claves
        .filter(([k]) => d[k] !== undefined && d[k] !== null)
        .map(([k, etiqueta, formato]) => (
          <Box key={k} display="contents">
            <Box as="dt" fontWeight={600} color="textoSuave" mt={{ base: 2, sm: 0 }}>
              {etiqueta}
            </Box>
            <Box as="dd" m={0} overflowWrap="anywhere">
              {formato ? formato(d[k]) : String(d[k])}
            </Box>
          </Box>
        ))}
    </Box>
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

  // Lleva al editor del grupo familiar y lo despliega (viene plegado cuando ya hay un grupo cargado).
  const marcarDomicilio = useCallback(() => {
    const seccion = document.getElementById("mi-grupo-familiar");
    const editor = seccion?.querySelector("details");
    if (editor) editor.open = true;
    seccion?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, []);

  const recargarPedidos = pedidos.recargar;
  const alEnviarPedido = useCallback(() => {
    window.setTimeout(recargarPedidos, 800);
  }, [recargarPedidos]);

  return (
    <Layout titulo="Mi cuenta">
      <Box maxW="64rem">
        <Flex justify="space-between" align="flex-start" gap={4} wrap="wrap" mb={5}>
          <Box minW={0}>
            <Heading as="h1" size="sm" color="textoSuave" fontWeight={600}>
              Mi cuenta
            </Heading>
            <Text as="p" textStyle="cifra" fontSize={{ base: "2xl", md: "3xl" }} overflowWrap="anywhere" data-testid="saludo">
              Hola, {usuario?.nombre_visible}
            </Text>
          </Box>
          <Button as={Link} href="tel:103" variant="solid" colorScheme="red" minH="2.75rem" _hover={{ textDecoration: "none" }} aria-label="Emergencia: llamar al 103">
            Emergencia: 103
          </Button>
        </Flex>

        <BandaSector carga={sector} alMarcarDomicilio={marcarDomicilio} />

        {pedidos.cargando && (
          <Box mb={5}>
            <EstadoCargando py={4} />
          </Box>
        )}
        {pedidos.datos === null && pedidos.error !== null && (
          <Alert status={pedidos.error instanceof ApiError && pedidos.error.estado === 404 ? "info" : "error"} fontSize="sm" role="alert" mb={5} data-testid="pedidos-error">
            <AlertIcon />
            {pedidos.error instanceof ApiError && pedidos.error.estado === 404
              ? "El seguimiento de pedidos todavía no está disponible en el servidor."
              : "No pudimos consultar tus pedidos. Vamos a reintentar solos; si es urgente, llamá al 103."}
          </Alert>
        )}
        {pedidos.datos !== null && pedidos.error !== null && (
          <Text fontSize="xs" color="textoSuave" role="status" mb={2} data-testid="pedidos-sin-actualizar">
            No pudimos actualizar tus pedidos; te mostramos lo último que recibimos.
          </Text>
        )}
        {activo && <MiPedido pedido={activo} alResponder={pedidos.recargar} />}

        <Box display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }} columnGap={10} alignItems="start">
          <Box as="section" aria-label="Avisos y órdenes" py={4} borderTop="1px solid" borderColor="borde">
            <Heading as="h2" size="md" mb={3}>
              Avisos y órdenes
            </Heading>
            {sector.estado === "ok" ? <OrdenesVigentes sectores={sector.datos.sectores} /> : <Text color="textoSuave">Se muestran cuando cargue el estado de tu sector.</Text>}
            <Box mt={4}>
              <Heading as="h3" size="sm" mb={2}>
                Notificaciones
              </Heading>
              {notifs.estado === "cargando" && <EstadoCargando py={3} />}
              {notifs.estado === "vacio" && <Text>No tenés notificaciones.</Text>}
              {notifs.estado === "no_disponible" && <Text>Esta función todavía no está disponible en el servidor.</Text>}
              {notifs.estado === "error" && (
                <Alert status="error" fontSize="sm" role="alert">
                  <AlertIcon />
                  No se pudo cargar: {notifs.mensaje}
                </Alert>
              )}
              {notifs.estado === "ok" && <Notificaciones lista={notifs.datos} alCambiar={notifs.recargar} />}
            </Box>
          </Box>

          <Box as="section" aria-label="Mi centro asignado" py={4} borderTop="1px solid" borderColor="borde">
            <Heading as="h2" size="md" mb={3}>
              Mi centro asignado
            </Heading>
            {sector.estado === "ok" ? <MiCentro d={sector.datos} /> : <Text color="textoSuave">Se muestra cuando cargue el estado de tu sector.</Text>}
          </Box>
        </Box>

        <PedidosAnteriores pedidos={anteriores} />

        {!pedidos.cargando && (
          <Box as="section" aria-label="Nuevo pedido" py={3} borderTop="1px solid" borderColor="borde" data-testid="nuevo-pedido">
            <Plegable key={activo ? "con-pedido" : "sin-pedido"} titulo={<Heading as="h2" size="md">Nuevo pedido</Heading>} abiertoInicial={activo === null}>
              <Box pt={2}>
                <PedirAyuda esProductor={esProductor} alEnviar={alEnviarPedido} />
              </Box>
            </Plegable>
          </Box>
        )}

        <Box id="mi-grupo-familiar" as="section" aria-label="Mi grupo familiar" py={4} borderTop="1px solid" borderColor="borde">
          <Heading as="h2" size="md" mb={3}>
            Mi grupo familiar
          </Heading>
          {familia.estado === "cargando" && <EstadoCargando py={3} />}
          {familia.estado === "ok" && (
            <Box mb={3}>
              <Pares
                d={familia.datos}
                claves={[
                  ["integrantes", "Integrantes"],
                  ["menores", "Menores"],
                  ["mayores", "Personas mayores"],
                  ["mascotas", "Mascotas"],
                  ["sector_id", "Sector (K10, SIMULADO)"],
                  ["actualizado_en", "Actualizado", (r) => fechaHora(String(r))],
                ]}
              />
            </Box>
          )}
          {familia.estado === "vacio" && <Text mb={3}>Todavía no cargaste tu grupo familiar.</Text>}
          {/* El editor ya viene plegado cuando hay grupo cargado. */}
          {familia.estado !== "cargando" && <EditarGrupo key={familia.estado === "ok" ? String(familia.datos.actualizado_en ?? "ok") : familia.estado} grupo={familia.estado === "ok" ? (familia.datos as Grupo) : null} alGuardar={alGuardarGrupo} />}
        </Box>

        {esProductor && (
          <Bloque titulo="Mis establecimientos" recurso={estabs} vacio="Todavía no registraste establecimientos.">
            {(l) => (
              <Box as="ul" listStyleType="none" m={0} p={0}>
                {l.map((e, i) => (
                  <Box as="li" key={String(e.id ?? i)} mb={3}>
                    <Pares
                      d={e}
                      claves={[
                        ["nombre", "Establecimiento"],
                        ["renspa", "RENSPA"],
                        ["acceso_habitual", "Acceso habitual"],
                        ["sector_id", "Sector (K10, SIMULADO)"],
                      ]}
                    />
                  </Box>
                ))}
              </Box>
            )}
          </Bloque>
        )}

        <Box as="section" aria-label="Mis datos" py={3} borderTop="1px solid" borderColor="borde">
          <Plegable titulo={<Heading as="h2" size="md">Mis datos</Heading>}>
            <Box pt={2}>
              {yo.estado === "cargando" && <EstadoCargando py={3} />}
              {yo.estado === "vacio" && <Text>Sin datos.</Text>}
              {yo.estado === "no_disponible" && <Text>Esta función todavía no está disponible en el servidor.</Text>}
              {yo.estado === "error" && (
                <Alert status="error" fontSize="sm" role="alert">
                  <AlertIcon />
                  No se pudo cargar: {yo.mensaje}
                </Alert>
              )}
              {yo.estado === "ok" && (
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
              )}
            </Box>
          </Plegable>
        </Box>
      </Box>
    </Layout>
  );
}
