import { Box, Button, Flex, Select, Table, Tbody, Td, Text, Th, Thead, Tr, useToast } from "@chakra-ui/react";
import { useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { AlertaError, Campo, CampoSelect } from "../components/Formulario";
import { IconoCandado, IconoEscudo, IconoLapiz, IconoMenos, IconoPersonas, IconoTilde } from "../components/iconos/Iconos";
import { Layout } from "../components/Layout";
import { TablaDesplazable } from "../components/TablaDesplazable";
import { ROL_OPERATIVO, etiquetaEstadoUsuario, etiquetaRol, fechaHora } from "../lib/etiquetas";
import { useCarga } from "../lib/useCarga";
import { hace, useAhora, useCargaViva } from "../lib/vivo";
import { api } from "../panel/api";
import { CabeceraPagina } from "../panel/CabeceraPagina";
import type { UsuarioAdmin } from "../panel/tipos";
import { APILAR, Cargando, Chip, fmtFecha, Seccion } from "../panel/ui";
import { REFRESCO_ADMIN_MS, TableroAdmin } from "./admin/TableroAdmin";

const ROLES_ALTA = ["cuadrilla", "operador", "decisor", "admin"] as const;

type RolOperativo = { codigo: string; nombre: string };
/** Nombre legible del rol operativo: el del diccionario común y, si falta, el del catálogo de la plataforma. */
const nombreRolOp = (r: RolOperativo) => ROL_OPERATIVO[r.codigo] ?? r.nombre;

function FilaUsuario({ u, roles, alCambiar }: { u: UsuarioAdmin; roles: RolOperativo[]; alCambiar: () => void }) {
  const toast = useToast();
  const { usuario } = useAuth();
  const esYo = usuario?.id === u.id;
  const [error, setError] = useState<unknown>(null);

  async function modificar(cambio: Record<string, unknown>) {
    setError(null);
    try {
      await api.modificarUsuario(u.id, cambio);
      toast({ title: "Usuario actualizado", description: u.email, status: "success", duration: 2500 });
      alCambiar();
    } catch (e) {
      setError(e);
    }
  }
  const institucional = (ROLES_ALTA as readonly string[]).includes(u.rol);
  const bloqueada = !!u.bloqueado_hasta && new Date(u.bloqueado_hasta).getTime() > Date.now();
  const propia = esYo && u.estado === "activo";
  return (
    <Tr>
      <Td data-etiqueta="Nombre">{u.nombre_visible}</Td>
      <Td data-etiqueta="Correo" wordBreak="break-all">
        {u.email}
      </Td>
      <Td data-etiqueta="Rol">{etiquetaRol(u.rol)}</Td>
      <Td data-etiqueta="Rol operativo">
        {institucional ? (
          <Select aria-label={`Rol operativo de ${u.email}`} bg="superficie" minW="9rem" maxW="10rem" value={u.rol_operativo ?? ""} onChange={(e) => void modificar({ rol_operativo: e.target.value || null })}>
            <option value="">Sin rol operativo</option>
            {roles.map((r) => (
              <option key={r.codigo} value={r.codigo}>
                {nombreRolOp(r)}
              </option>
            ))}
          </Select>
        ) : (
          "—"
        )}
        {error !== null && <AlertaError error={error} />}
      </Td>
      <Td data-etiqueta="Estado">
        <Flex gap={1.5} wrap="wrap">
          {u.estado === "activo" ? (
            <Chip tono="ok" icono={<IconoTilde tam="0.9em" />}>
              {etiquetaEstadoUsuario(u.estado)}
            </Chip>
          ) : (
            <Chip tono="neutro" icono={<IconoMenos tam="0.9em" />}>
              {etiquetaEstadoUsuario(u.estado)}
            </Chip>
          )}
          {bloqueada && (
            <Chip tono="alerta" icono={<IconoCandado tam="0.9em" />} title={`Bloqueada hasta ${fechaHora(u.bloqueado_hasta)}`}>
              Bloqueada
            </Chip>
          )}
        </Flex>
      </Td>
      <Td data-etiqueta="Último ingreso">{u.ultimo_login ? fmtFecha(u.ultimo_login) : "nunca"}</Td>
      <Td data-etiqueta="Acción">
        <Button
          variant="outline"
          isDisabled={propia}
          title={propia ? "No podés desactivar tu propia cuenta" : undefined}
          aria-label={propia ? "Desactivar (no disponible: es tu propia cuenta)" : undefined}
          onClick={() => void modificar({ estado: u.estado === "activo" ? "inactivo" : "activo" })}
        >
          {u.estado === "activo" ? "Desactivar" : "Activar"}
        </Button>
      </Td>
    </Tr>
  );
}

function FormAlta({ roles, alCrear }: { roles: RolOperativo[]; alCrear: () => void }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<string>("operador");
  const [rolOp, setRolOp] = useState("");
  const [intento, setIntento] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [guardando, setGuardando] = useState(false);

  const errEmail = intento && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "Ingresá un correo válido." : undefined;
  const errNombre = intento && nombre.trim().length < 2 ? "El nombre debe tener al menos 2 caracteres." : undefined;
  const errPass = intento && password.length < 10 ? "La contraseña debe tener al menos 10 caracteres." : undefined;

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setIntento(true);
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || nombre.trim().length < 2 || password.length < 10) return;
    setGuardando(true);
    try {
      await api.crearUsuario({ email: email.trim(), password, nombre_visible: nombre.trim(), rol, rol_operativo: rolOp || null });
      toast({ title: "Usuario creado", description: email, status: "success", duration: 3000 });
      setEmail("");
      setNombre("");
      setPassword("");
      setIntento(false);
      alCrear();
    } catch (err) {
      setError(err);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Box as="form" onSubmit={(e: React.FormEvent) => void crear(e)} noValidate>
      <Box display="grid" gap={4} gridTemplateColumns="repeat(auto-fit, minmax(min(100%, 15rem), 1fr))" maxW="60rem">
        <Campo id="alta-email" etiqueta="Correo" type="email" autoComplete="off" isRequired value={email} onChange={(e) => setEmail(e.target.value)} error={errEmail} />
        <Campo id="alta-nombre" etiqueta="Nombre visible" isRequired value={nombre} onChange={(e) => setNombre(e.target.value)} error={errNombre} />
        <Campo id="alta-password" etiqueta="Contraseña inicial" type="password" autoComplete="new-password" isRequired value={password} onChange={(e) => setPassword(e.target.value)} error={errPass} ayuda="Mínimo 10 caracteres." />
        <CampoSelect id="alta-rol" etiqueta="Rol" value={rol} onChange={(e) => setRol(e.target.value)}>
          {ROLES_ALTA.map((r) => (
            <option key={r} value={r}>
              {etiquetaRol(r)}
            </option>
          ))}
        </CampoSelect>
        <CampoSelect id="alta-rolop" etiqueta="Rol operativo" value={rolOp} onChange={(e) => setRolOp(e.target.value)} ayuda="Con el que firma tareas y decisiones.">
          <option value="">Sin rol operativo</option>
          {roles.map((r) => (
            <option key={r.codigo} value={r.codigo}>
              {nombreRolOp(r)}
            </option>
          ))}
        </CampoSelect>
      </Box>
      <Button type="submit" mt={5} isLoading={guardando}>
        Crear usuario
      </Button>
      <Box mt={3}>
        <AlertaError error={error} />
      </Box>
    </Box>
  );
}

const POR_PAGINA = 15;
const ROLES_FILTRO = ["ciudadano", "productor", "cuadrilla", "operador", "decisor", "admin"] as const;

/** Filtra por rol, estado y texto (nombre o correo). Se aplica sobre los usuarios ya cargados. */
export function filtrarUsuarios(lista: UsuarioAdmin[], f: { rol: string; estado: string; texto: string }): UsuarioAdmin[] {
  const t = f.texto.trim().toLowerCase();
  return lista.filter((u) => (!f.rol || u.rol === f.rol) && (!f.estado || u.estado === f.estado) && (!t || u.nombre_visible.toLowerCase().includes(t) || u.email.toLowerCase().includes(t)));
}

function ListaUsuarios({ usuarios, roles, alCambiar }: { usuarios: UsuarioAdmin[]; roles: RolOperativo[]; alCambiar: () => void }) {
  const [rol, setRol] = useState("");
  const [estado, setEstado] = useState("");
  const [texto, setTexto] = useState("");
  const [pagina, setPagina] = useState(0);
  const filtrados = filtrarUsuarios(usuarios, { rol, estado, texto });
  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const actual = Math.min(pagina, paginas - 1);
  const visibles = filtrados.slice(actual * POR_PAGINA, (actual + 1) * POR_PAGINA);
  const cambiar = (f: () => void) => {
    f();
    setPagina(0);
  };
  return (
    <>
      <Box display="grid" gap={4} gridTemplateColumns={{ base: "1fr", md: "11rem 11rem minmax(0, 20rem)" }} mb={4}>
        <CampoSelect id="filtro-rol" etiqueta="Rol" value={rol} onChange={(e) => cambiar(() => setRol(e.target.value))}>
          <option value="">Todos</option>
          {ROLES_FILTRO.map((r) => (
            <option key={r} value={r}>
              {etiquetaRol(r)}
            </option>
          ))}
        </CampoSelect>
        <CampoSelect id="filtro-estado" etiqueta="Estado" value={estado} onChange={(e) => cambiar(() => setEstado(e.target.value))}>
          <option value="">Todos</option>
          <option value="activo">{etiquetaEstadoUsuario("activo")}</option>
          <option value="inactivo">{etiquetaEstadoUsuario("inactivo")}</option>
        </CampoSelect>
        <Campo id="filtro-texto" etiqueta="Buscar por nombre o correo" value={texto} onChange={(e) => cambiar(() => setTexto(e.target.value))} />
      </Box>
      {filtrados.length === 0 ? (
        <Text data-testid="usuarios-sin-resultados">Ningún usuario coincide con esos filtros.</Text>
      ) : (
        <TablaDesplazable etiqueta="Usuarios">
          <Table size="sm" aria-label="Usuarios" sx={{ ...APILAR, "th, td": { px: 1.5 } }}>
            <Thead>
              <Tr>
                <Th>Nombre</Th>
                <Th>Correo</Th>
                <Th>Rol</Th>
                <Th>Rol operativo</Th>
                <Th>Estado</Th>
                <Th>Último ingreso</Th>
                <Th>Acción</Th>
              </Tr>
            </Thead>
            <Tbody>
              {visibles.map((u) => (
                <FilaUsuario key={u.id} u={u} roles={roles} alCambiar={alCambiar} />
              ))}
            </Tbody>
          </Table>
        </TablaDesplazable>
      )}
      <Flex align="center" justify="space-between" gap={3} wrap="wrap" mt={4}>
        <Text data-testid="usuarios-rango">
          {filtrados.length === 0 ? "0 usuarios" : `Mostrando ${actual * POR_PAGINA + 1} a ${actual * POR_PAGINA + visibles.length} de ${filtrados.length}`}
        </Text>
        <Flex gap={2}>
          <Button variant="outline" onClick={() => setPagina(actual - 1)} isDisabled={actual === 0}>
            Anterior
          </Button>
          <Button variant="outline" onClick={() => setPagina(actual + 1)} isDisabled={actual >= paginas - 1}>
            Siguiente
          </Button>
        </Flex>
      </Flex>
    </>
  );
}

/** Administración (solo admin): tablero de estado y gestión de usuarios institucionales. Ciudadanía y productores se autorregistran. */
export default function Admin() {
  const usuarios = useCarga(() => api.usuarios());
  const roles = useCarga(() => api.rolesOperativos());
  const resumen = useCargaViva(() => api.resumenAdmin(), { cadaMs: REFRESCO_ADMIN_MS });
  const ahora = useAhora();
  const catalogo = roles.datos?.roles ?? [];
  return (
    <Layout ancho="datos" titulo="Administración">
      <CabeceraPagina
        titulo="Administración"
        icono={<IconoEscudo tam="1.5rem" />}
        ayuda="Estado de la plataforma y alta y baja de usuarios institucionales (cuadrilla, operador, decisor y admin). Cada uno firma con un rol operativo, sin nombres de funcionarios reales. Las cuentas de demostración son ficticias."
        actualizado={resumen.actualizadoEn === null ? undefined : `Actualizado ${hace(ahora - resumen.actualizadoEn)} · se renueva solo cada minuto`}
        actualizadoId="admin-actualizado"
        acciones={
          <Button variant="outline" onClick={resumen.recargar}>
            Actualizar ahora
          </Button>
        }
      />
      <TableroAdmin usuarios={usuarios.datos ?? []} carga={resumen} />
      <Seccion titulo="Nuevo usuario institucional" id="sec-alta" icono={<IconoLapiz tam="1.125rem" />}>
        <FormAlta roles={catalogo} alCrear={usuarios.recargar} />
      </Seccion>
      <Seccion titulo="Usuarios" id="sec-usuarios" icono={<IconoPersonas tam="1.125rem" />}>
        <Cargando carga={usuarios} esVacio={(d) => d.length === 0} vacio="No hay usuarios." hijos={(d) => <ListaUsuarios usuarios={d} roles={catalogo} alCambiar={usuarios.recargar} />} />
      </Seccion>
    </Layout>
  );
}
