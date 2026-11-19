import { Alert, AlertIcon, Badge, Box, Button, Heading, Spinner, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { useAuth, type Usuario } from "../auth/AuthContext";
import { Layout } from "../components/Layout";
import { ApiError, solicitar } from "../lib/api";
import { etiquetaEstadoUsuario, etiquetaRol, etiquetaRolOperativo, fechaHora } from "../lib/etiquetas";
import { EditarGrupo, type Grupo } from "./micuenta/EditarGrupo";
import { ConfirmarTraslado } from "./micuenta/ConfirmarTraslado";
import { EstadoSector } from "./micuenta/EstadoSector";
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

function Bloque<T>({
  titulo,
  recurso,
  vacio,
  children,
}: {
  titulo: string;
  recurso: Recurso<T>;
  vacio: string;
  children: (datos: T) => ReactNode;
}) {
  return (
    <Box as="section" py={5} borderTop="1px solid" borderColor="borde" aria-label={titulo}>
      <Heading as="h2" size="md" mb={3}>
        {titulo}
      </Heading>
      {recurso.estado === "cargando" && (
        <Text as="div" display="flex" alignItems="center" gap={2}>
          <Spinner size="sm" /> Cargando…
        </Text>
      )}
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

type Dic = Record<string, unknown>;

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

function Notificaciones({ lista, alCambiar }: { lista: Dic[]; alCambiar: () => void }) {
  const [trabajando, setTrabajando] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function marcar(id: number) {
    setTrabajando(id);
    setError(null);
    try {
      await solicitar(`/mi/notificaciones/${id}/leida`, { autenticado: true, metodo: "PATCH", cuerpo: {} });
      alCambiar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo marcar como leída.");
    } finally {
      setTrabajando(null);
    }
  }
  return (
    <>
      {error && (
        <Alert status="error" fontSize="sm" role="alert" mb={2}>
          <AlertIcon />
          {error}
        </Alert>
      )}
      <Box as="ul" listStyleType="none" m={0} p={0}>
        {lista.map((n, i) => {
          const id = typeof n.id === "number" ? n.id : null;
          const leida = n.leida === true;
          return (
            <Box as="li" key={String(n.id ?? i)} py={2} borderBottom="1px solid" borderColor="borde" display="flex" gap={3} alignItems="flex-start" flexWrap="wrap">
              <Box flex="1 1 14rem" minW={0}>
                <Text fontWeight={leida ? 400 : 700} overflowWrap="anywhere">
                  {!leida && <Badge colorScheme="blue" mr={2}>Nueva</Badge>}
                  {String(n.mensaje ?? n.titulo ?? "Notificación")}
                </Text>
                <Text fontSize="xs" color="textoSuave">
                  {fechaHora(typeof n.creada_en === "string" ? n.creada_en : null)}
                </Text>
              </Box>
              {!leida && id !== null && (
                <Button size="sm" variant="outline" minH="2.75rem" isLoading={trabajando === id} onClick={() => void marcar(id)}>
                  Marcar como leída
                </Button>
              )}
            </Box>
          );
        })}
      </Box>
    </>
  );
}

export default function MiCuenta() {
  const { usuario } = useAuth();
  const yo = useRecurso<Usuario>("/auth/yo");
  const esProductor = usuario?.rol === "productor";
  // Contrato real (apps/backend/app/api/v1/mi.py): el grupo familiar es un objeto plano y responde 404 si
  // todavía no se cargó; establecimientos y notificaciones vienen envueltos en un objeto.
  const familia = useRecurso<Dic>("/mi/grupo-familiar", { vacioSi404: true });
  const estabs = useRecurso<Dic[], unknown>("/mi/establecimientos", {
    extraer: listaDe("establecimientos"),
    activo: esProductor,
  });
  const notifs = useRecurso<Dic[], unknown>("/mi/notificaciones", { extraer: listaDe("notificaciones") });
  const [versionSector, setVersionSector] = useState(0);
  const recargarFamilia = familia.recargar;
  const alGuardarGrupo = useCallback(() => {
    recargarFamilia();
    setVersionSector((n) => n + 1);
  }, [recargarFamilia]);

  return (
    <Layout titulo="Mi cuenta">
      <Heading as="h1" size="xl" mb={1}>
        Mi cuenta
      </Heading>
      <Text mb={4}>Hola, {usuario?.nombre_visible}.</Text>

      <Box maxW="80rem">
        <EstadoSector key={versionSector} />
        <ConfirmarTraslado />
        <PedirAyuda esProductor={esProductor} />
      </Box>

      <Box display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }} columnGap={10} alignItems="start" maxW="80rem">
        <Bloque titulo="Notificaciones" recurso={notifs} vacio="No tenés notificaciones.">
          {(lista) => <Notificaciones lista={lista} alCambiar={notifs.recargar} />}
        </Bloque>

        <Bloque titulo="Mis datos" recurso={yo} vacio="Sin datos.">
          {(u) => (
            <Pares
              d={u as unknown as Dic}
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
        </Bloque>

        <Bloque titulo="Grupo familiar" recurso={familia} vacio="Todavía no cargaste tu grupo familiar.">
          {(g) => (
            <Pares
              d={g}
              claves={[
                ["integrantes", "Integrantes"],
                ["menores", "Menores"],
                ["mayores", "Personas mayores"],
                ["mascotas", "Mascotas"],
                ["sector_id", "Sector (K10, SIMULADO)"],
                ["actualizado_en", "Actualizado", (r) => fechaHora(String(r))],
              ]}
            />
          )}
        </Bloque>

        {esProductor && (
          <Bloque titulo="Mis establecimientos" recurso={estabs} vacio="Todavía no registraste establecimientos.">
            {(lista) => (
              <Box as="ul" listStyleType="none" m={0} p={0}>
                {lista.map((e, i) => (
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

        {familia.estado !== "cargando" && (
          <Box gridColumn={{ lg: "1 / -1" }} borderTop="1px solid" borderColor="borde" py={3} maxW="48rem">
            <EditarGrupo key={familia.estado === "ok" ? String(familia.datos.actualizado_en ?? "ok") : familia.estado} grupo={familia.estado === "ok" ? (familia.datos as Grupo) : null} alGuardar={alGuardarGrupo} />
          </Box>
        )}
      </Box>
    </Layout>
  );
}
