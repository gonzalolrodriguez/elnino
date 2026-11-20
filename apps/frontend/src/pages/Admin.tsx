import { Badge, Box, Button, Flex, FormControl, FormErrorMessage, FormLabel, Heading, Input, Select, Table, Tbody, Td, Text, Th, Thead, Tr, useToast } from "@chakra-ui/react";
import { useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { AlertaError } from "../components/Formulario";
import { Layout } from "../components/Layout";
import { etiquetaEstadoUsuario, etiquetaRol, fechaHora } from "../lib/etiquetas";
import { useCarga } from "../lib/useCarga";
import { api } from "../panel/api";
import type { UsuarioAdmin } from "../panel/tipos";
import { Cargando, fmtFecha, Seccion } from "../panel/ui";
import { TablaDesplazable } from "../components/TablaDesplazable";
import { TableroAdmin } from "./admin/TableroAdmin";

const ROLES_ALTA = ["cuadrilla", "operador", "decisor", "admin"] as const;

function FilaUsuario({ u, roles, alCambiar }: { u: UsuarioAdmin; roles: { codigo: string; nombre: string }[]; alCambiar: () => void }) {
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
  return (
    <Tr>
      <Td>{u.nombre_visible}</Td>
      <Td>{u.email}</Td>
      <Td>{etiquetaRol(u.rol)}</Td>
      <Td>
        {institucional ? (
          <Select aria-label={`Rol operativo de ${u.email}`} size="xs" bg="superficie" value={u.rol_operativo ?? ""} placeholder="Sin rol operativo" onChange={(e) => void modificar({ rol_operativo: e.target.value || null })}>
            {roles.map((r) => (
              <option key={r.codigo} value={r.codigo}>
                {r.nombre}
              </option>
            ))}
          </Select>
        ) : (
          "—"
        )}
        {error !== null && <AlertaError error={error} />}
      </Td>
      <Td>
        <Badge colorScheme={u.estado === "activo" ? "green" : "gray"}>{etiquetaEstadoUsuario(u.estado)}</Badge>
        {u.bloqueado_hasta && new Date(u.bloqueado_hasta).getTime() > Date.now() && (
          <Badge ml={1} colorScheme="red" textTransform="none">
            Bloqueada hasta {fechaHora(u.bloqueado_hasta)}
          </Badge>
        )}
      </Td>
      <Td>{u.ultimo_login ? fmtFecha(u.ultimo_login) : "nunca"}</Td>
      <Td>
        <Button
          size="xs"
          variant="outline"
          isDisabled={esYo && u.estado === "activo"}
          title={esYo && u.estado === "activo" ? "No podés desactivar tu propia cuenta" : undefined}
          aria-label={esYo && u.estado === "activo" ? "Desactivar (no disponible: es tu propia cuenta)" : undefined}
          onClick={() => void modificar({ estado: u.estado === "activo" ? "inactivo" : "activo" })}
        >
          {u.estado === "activo" ? "Desactivar" : "Activar"}
        </Button>
      </Td>
    </Tr>
  );
}

function FormAlta({ roles, alCrear }: { roles: { codigo: string; nombre: string }[]; alCrear: () => void }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<string>("operador");
  const [rolOp, setRolOp] = useState("");
  const [intento, setIntento] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [guardando, setGuardando] = useState(false);

  const errEmail = intento && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "Ingresá un correo válido." : null;
  const errNombre = intento && nombre.trim().length < 2 ? "El nombre debe tener al menos 2 caracteres." : null;
  const errPass = intento && password.length < 10 ? "La contraseña debe tener al menos 10 caracteres." : null;

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
      <Flex gap={3} wrap="wrap" align="flex-start">
        <FormControl w="15rem" isInvalid={!!errEmail}>
          <FormLabel htmlFor="alta-email" fontSize="sm" mb={0}>
            Correo
          </FormLabel>
          <Input id="alta-email" size="sm" bg="superficie" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
          <FormErrorMessage>{errEmail}</FormErrorMessage>
        </FormControl>
        <FormControl w="14rem" isInvalid={!!errNombre}>
          <FormLabel htmlFor="alta-nombre" fontSize="sm" mb={0}>
            Nombre visible
          </FormLabel>
          <Input id="alta-nombre" size="sm" bg="superficie" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <FormErrorMessage>{errNombre}</FormErrorMessage>
        </FormControl>
        <FormControl w="14rem" isInvalid={!!errPass}>
          <FormLabel htmlFor="alta-password" fontSize="sm" mb={0}>
            Contraseña inicial
          </FormLabel>
          <Input id="alta-password" size="sm" bg="superficie" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <FormErrorMessage>{errPass}</FormErrorMessage>
        </FormControl>
        <FormControl w="10rem">
          <FormLabel htmlFor="alta-rol" fontSize="sm" mb={0}>
            Rol
          </FormLabel>
          <Select id="alta-rol" size="sm" bg="superficie" value={rol} onChange={(e) => setRol(e.target.value)}>
            {ROLES_ALTA.map((r) => (
              <option key={r} value={r}>
                {etiquetaRol(r)}
              </option>
            ))}
          </Select>
        </FormControl>
        <FormControl w="14rem">
          <FormLabel htmlFor="alta-rolop" fontSize="sm" mb={0}>
            Rol operativo
          </FormLabel>
          <Select id="alta-rolop" size="sm" bg="superficie" placeholder="Sin rol operativo" value={rolOp} onChange={(e) => setRolOp(e.target.value)}>
            {roles.map((r) => (
              <option key={r.codigo} value={r.codigo}>
                {r.nombre}
              </option>
            ))}
          </Select>
        </FormControl>
      </Flex>
      <Button type="submit" size="sm" mt={3} isLoading={guardando}>
        Crear usuario
      </Button>
      <Box mt={2}>
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

function ListaUsuarios({ usuarios, roles, alCambiar }: { usuarios: UsuarioAdmin[]; roles: { codigo: string; nombre: string }[]; alCambiar: () => void }) {
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
      <Flex gap={3} wrap="wrap" mb={3} align="flex-end">
        <FormControl w="11rem">
          <FormLabel htmlFor="filtro-rol" fontSize="sm" mb={0}>
            Rol
          </FormLabel>
          <Select id="filtro-rol" size="sm" bg="superficie" value={rol} onChange={(e) => cambiar(() => setRol(e.target.value))}>
            <option value="">Todos</option>
            {ROLES_FILTRO.map((r) => (
              <option key={r} value={r}>
                {etiquetaRol(r)}
              </option>
            ))}
          </Select>
        </FormControl>
        <FormControl w="10rem">
          <FormLabel htmlFor="filtro-estado" fontSize="sm" mb={0}>
            Estado
          </FormLabel>
          <Select id="filtro-estado" size="sm" bg="superficie" value={estado} onChange={(e) => cambiar(() => setEstado(e.target.value))}>
            <option value="">Todos</option>
            <option value="activo">{etiquetaEstadoUsuario("activo")}</option>
            <option value="inactivo">{etiquetaEstadoUsuario("inactivo")}</option>
          </Select>
        </FormControl>
        <FormControl w="16rem">
          <FormLabel htmlFor="filtro-texto" fontSize="sm" mb={0}>
            Buscar por nombre o correo
          </FormLabel>
          <Input id="filtro-texto" size="sm" bg="superficie" value={texto} onChange={(e) => cambiar(() => setTexto(e.target.value))} />
        </FormControl>
      </Flex>
      {filtrados.length === 0 ? (
        <Text fontSize="sm" data-testid="usuarios-sin-resultados">
          Ningún usuario coincide con esos filtros.
        </Text>
      ) : (
        <TablaDesplazable etiqueta="Usuarios">
          <Table size="sm" aria-label="Usuarios">
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
      <Flex align="center" justify="space-between" gap={3} wrap="wrap" mt={3} fontSize="sm">
        <Text data-testid="usuarios-rango">
          {filtrados.length === 0 ? "0 usuarios" : `Mostrando ${actual * POR_PAGINA + 1} a ${actual * POR_PAGINA + visibles.length} de ${filtrados.length}`}
        </Text>
        <Flex gap={2}>
          <Button size="sm" variant="outline" onClick={() => setPagina(actual - 1)} isDisabled={actual === 0}>
            Anterior
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPagina(actual + 1)} isDisabled={actual >= paginas - 1}>
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
  const catalogo = roles.datos?.roles ?? [];
  return (
    <Layout ancho="datos" titulo="Administración">
      <Heading as="h1" size="xl" mb={2}>
        Administración
      </Heading>
      <Text mb={4} maxW="42rem">
        Estado de la plataforma y alta y baja de usuarios institucionales (cuadrilla, operador, decisor y admin). Cada uno firma sus tareas y decisiones con un rol operativo, sin nombres de funcionarios reales. Las cuentas de demostración son ficticias.
      </Text>
      <TableroAdmin usuarios={usuarios.datos ?? []} />
      <Seccion titulo="Nuevo usuario institucional" id="sec-alta">
        <FormAlta roles={catalogo} alCrear={usuarios.recargar} />
      </Seccion>
      <Seccion titulo="Usuarios" id="sec-usuarios">
        <Cargando carga={usuarios} esVacio={(d) => d.length === 0} vacio="No hay usuarios." hijos={(d) => <ListaUsuarios usuarios={d} roles={catalogo} alCambiar={usuarios.recargar} />} />
      </Seccion>
    </Layout>
  );
}
