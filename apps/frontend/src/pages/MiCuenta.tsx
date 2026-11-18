import { Alert, AlertIcon, Box, Heading, Spinner, Text } from "@chakra-ui/react";
import { useEffect, useState, type ReactNode } from "react";

import { useAuth, type Usuario } from "../auth/AuthContext";
import { Layout } from "../components/Layout";
import { ApiError, solicitar } from "../lib/api";

type Recurso<T> =
  | { estado: "cargando" }
  | { estado: "ok"; datos: T }
  | { estado: "vacio" }
  | { estado: "no_disponible" }
  | { estado: "error"; mensaje: string };

function useRecurso<T>(ruta: string): Recurso<T> {
  const [r, setR] = useState<Recurso<T>>({ estado: "cargando" });
  useEffect(() => {
    let activo = true;
    solicitar<T>(ruta, { autenticado: true })
      .then((datos) => {
        if (!activo) return;
        const vacio = datos === null || (Array.isArray(datos) && datos.length === 0);
        setR(vacio ? { estado: "vacio" } : { estado: "ok", datos });
      })
      .catch((e: unknown) => {
        if (!activo) return;
        if (e instanceof ApiError && e.estado === 404) setR({ estado: "no_disponible" });
        else setR({ estado: "error", mensaje: e instanceof Error ? e.message : "Error desconocido" });
      });
    return () => {
      activo = false;
    };
  }, [ruta]);
  return r;
}

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
    <Box as="section" py={5} borderTop="1px solid" borderColor="pizarra.200" aria-label={titulo}>
      <Heading as="h2" size="md" mb={3}>
        {titulo}
      </Heading>
      {recurso.estado === "cargando" && (
        <Text display="flex" alignItems="center" gap={2}>
          <Spinner size="sm" /> Cargando...
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

function Pares({ d, claves }: { d: Dic; claves: [string, string][] }) {
  return (
    <Box as="dl" display="grid" gridTemplateColumns="12rem 1fr" gap={1} fontSize="sm">
      {claves
        .filter(([k]) => d[k] !== undefined && d[k] !== null)
        .map(([k, etiqueta]) => (
          <Box key={k} display="contents">
            <Box as="dt" fontWeight={600}>
              {etiqueta}
            </Box>
            <Box as="dd" m={0}>
              {String(d[k])}
            </Box>
          </Box>
        ))}
    </Box>
  );
}

export default function MiCuenta() {
  const { usuario } = useAuth();
  const yo = useRecurso<Usuario>("/auth/yo");
  const familia = useRecurso<Dic>("/mi/grupo-familiar");
  const estabs = useRecurso<Dic[]>("/mi/establecimientos");
  const notifs = useRecurso<Dic[]>("/mi/notificaciones");
  const esProductor = usuario?.rol === "productor";

  return (
    <Layout>
      <Heading as="h1" size="xl" mb={1}>
        Mi cuenta
      </Heading>
      <Text mb={4}>Hola, {usuario?.nombre_visible}.</Text>

      <Bloque titulo="Mis datos" recurso={yo} vacio="Sin datos.">
        {(u) => (
          <Pares
            d={u as unknown as Dic}
            claves={[
              ["nombre_visible", "Nombre"],
              ["email", "Correo"],
              ["rol", "Rol"],
              ["estado", "Estado"],
              ["creado_en", "Alta"],
              ["ultimo_login", "Último ingreso"],
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
                      ["sector_id", "Sector (K10, SIMULADO)"],
                    ]}
                  />
                </Box>
              ))}
            </Box>
          )}
        </Bloque>
      )}

      <Bloque titulo="Notificaciones" recurso={notifs} vacio="No tenés notificaciones.">
        {(lista) => (
          <Box as="ul" m={0} pl={5}>
            {lista.map((n, i) => (
              <li key={String(n.id ?? i)}>{String(n.mensaje ?? n.titulo ?? n.tipo ?? "Notificación")}</li>
            ))}
          </Box>
        )}
      </Bloque>
    </Layout>
  );
}
