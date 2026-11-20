import { Alert, AlertDescription, AlertIcon, AlertTitle, Box, Button, Center, Flex, SimpleGrid, Spinner, Table, Tbody, Td, Text, Th, Thead, Tr } from "@chakra-ui/react";

import { IconoCandado, IconoEscudo, IconoOlas, IconoPersonas } from "../../components/iconos/Iconos";
import { AlertaError } from "../../components/Formulario";
import { TablaDesplazable } from "../../components/TablaDesplazable";
import { etiquetaEstadoUsuario, etiquetaRol, fechaHora } from "../../lib/etiquetas";
import type { CargaViva } from "../../lib/vivo";
import { Barras } from "../../panel/tablero/Barras";
import type { ResumenAdmin, UsuarioAdmin } from "../../panel/tipos";
import { APILAR, Cifra, fmtNum, Seccion } from "../../panel/ui";

export const REFRESCO_ADMIN_MS = 60_000;

/** Lectura viva del resumen de administración (la página la pide y la comparte con su cabecera). */
export type CargaResumenAdmin = CargaViva<ResumenAdmin>;

/** Estado de la cadena de auditoría: íntegra o rota en una fila. Nunca se comunica solo con color. */
export function EstadoAuditoria({ a }: { a: ResumenAdmin["auditoria"] }) {
  if (a.cadena_integra) {
    return (
      <Alert status="success" variant="subtle" data-testid="auditoria-estado">
        <AlertIcon />
        <Box>
          <AlertTitle>Cadena de auditoría íntegra</AlertTitle>
          <AlertDescription>Se verificaron {fmtNum(a.filas)} registros de acceso a datos personales y ninguno fue alterado.</AlertDescription>
        </Box>
      </Alert>
    );
  }
  return (
    <Alert status="error" variant="subtle" role="alert" data-testid="auditoria-estado">
      <AlertIcon />
      <Box>
        <AlertTitle>Cadena de auditoría rota{a.primera_fila_inconsistente !== null ? ` en la fila ${fmtNum(a.primera_fila_inconsistente)}` : ""}</AlertTitle>
        <AlertDescription>
          Los registros a partir de ahí no coinciden con su huella: pueden haberse modificado o borrado. Avisá al responsable de seguridad antes de seguir usando esos registros.
        </AlertDescription>
      </Box>
    </Alert>
  );
}

function Bloqueos({ r, usuarios }: { r: ResumenAdmin["usuarios"]; usuarios: UsuarioAdmin[] }) {
  if (r.bloqueos.length === 0) {
    return <Text>No hay cuentas bloqueadas ahora.</Text>;
  }
  const correo = (id: number | null) => (id === null ? "correo inexistente" : (usuarios.find((u) => u.id === id)?.email ?? `usuario ${id}`));
  return (
    <>
      <TablaDesplazable etiqueta="Cuentas bloqueadas">
        <Table size="sm" aria-label="Cuentas bloqueadas" data-testid="tabla-bloqueos" sx={APILAR}>
          <Thead>
            <Tr>
              <Th>Cuenta</Th>
              <Th>Dirección IP</Th>
              <Th>Bloqueada hasta</Th>
            </Tr>
          </Thead>
          <Tbody>
            {r.bloqueos.map((b, i) => (
              <Tr key={`${b.usuario_id}-${b.ip}-${i}`}>
                <Td data-etiqueta="Cuenta">{correo(b.usuario_id)}</Td>
                <Td data-etiqueta="Dirección IP">{b.ip ?? "—"}</Td>
                <Td data-etiqueta="Bloqueada hasta">{fechaHora(b.bloqueado_hasta)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TablaDesplazable>
      <Text textStyle="microdato" mt={2}>
        El bloqueo se levanta solo a la hora indicada. Por ahora el panel no permite desbloquear antes de tiempo.
      </Text>
    </>
  );
}

/** Tablero del administrador: usuarios, cuentas bloqueadas, integridad de la auditoría y estado del servicio. */
export function TableroAdmin({ usuarios, carga }: { usuarios: UsuarioAdmin[]; carga: CargaResumenAdmin }) {
  if (carga.cargando) {
    return (
      <Center py={8} role="status" aria-label="Cargando">
        <Spinner />
      </Center>
    );
  }
  if (carga.datos === null) {
    return (
      <Box mb={5}>
        <AlertaError error={carga.error} />
        <Button mt={2} variant="outline" onClick={carga.recargar}>
          Reintentar
        </Button>
      </Box>
    );
  }
  const r = carga.datos;
  const u = r.usuarios;
  const porRol = Object.entries(u.por_rol).map(([k, v]) => ({ id: k, etiqueta: etiquetaRol(k), valor: v }));
  const porEstado = Object.entries(u.por_estado).map(([k, v]) => ({ id: k, etiqueta: etiquetaEstadoUsuario(k), valor: v }));
  return (
    <>
      {carga.error !== null && (
        <Alert status="warning" variant="subtle" mb={4}>
          <AlertIcon />
          <AlertDescription>No se pudo actualizar el resumen; se muestra la última lectura.</AlertDescription>
        </Alert>
      )}

      {/* Estado real de esta instancia (no es dato de la emergencia): sin categoría de dato. */}
      <Seccion titulo="Integridad de la auditoría" id="adm-auditoria" icono={<IconoEscudo tam="1.125rem" />}>
        <EstadoAuditoria a={r.auditoria} />
      </Seccion>

      <Seccion titulo="Resumen de cuentas" categoria={r.categoria} id="adm-usuarios-resumen" icono={<IconoPersonas tam="1.125rem" />}>
        <Flex gap={6} wrap="wrap" mb={5}>
          <Cifra testId="adm-total" etiqueta="Usuarios" valor={fmtNum(u.total)} categoria={r.categoria} />
          <Cifra testId="adm-bloqueadas" etiqueta="Cuentas bloqueadas" valor={fmtNum(u.cuentas_bloqueadas)} categoria={r.categoria} />
          <Cifra testId="adm-inactivos" etiqueta="Sin ingresar hace más de 30 días" valor={fmtNum(u.sin_login_30_dias)} categoria={r.categoria} />
          <Cifra testId="adm-intentos" etiqueta="Intentos fallidos en curso" valor={fmtNum(u.intentos_fallidos_en_curso)} categoria={r.categoria} />
        </Flex>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={{ base: 5, md: 10 }}>
          <Box>
            <Text as="h3" textStyle="rotulo" mb={1}>
              Por rol
            </Text>
            <Barras etiqueta="Usuarios por rol" filas={porRol} />
          </Box>
          <Box>
            <Text as="h3" textStyle="rotulo" mb={1}>
              Por estado
            </Text>
            <Barras etiqueta="Usuarios por estado" filas={porEstado} />
          </Box>
        </SimpleGrid>
      </Seccion>

      <Seccion titulo="Cuentas bloqueadas" categoria={r.categoria} id="adm-bloqueos" icono={<IconoCandado tam="1.125rem" />}>
        <Bloqueos r={u} usuarios={usuarios} />
      </Seccion>

      {/* Estado real de esta instancia (no es dato de la emergencia): sin categoría de dato. */}
      <Seccion titulo="Estado del servicio" id="adm-servicio" icono={<IconoOlas tam="1.125rem" />}>
        <Flex gap={6} wrap="wrap">
          <Cifra testId="adm-bd" etiqueta="Base de datos" valor={r.servicio.base_de_datos === "ok" ? "Conectada" : "Sin conexión"} categoria={r.categoria} omitirCategoria />
          <Cifra testId="adm-ws" etiqueta="Conexiones en tiempo real" valor={fmtNum(r.servicio.websockets_activos)} categoria={r.categoria} omitirCategoria />
          <Cifra testId="adm-version" etiqueta="Versión" valor={r.servicio.version} categoria={r.categoria} omitirCategoria />
        </Flex>
        <Text textStyle="microdato" mt={3}>
          Lectura de esta instancia del prototipo; no es un dato de la emergencia.
        </Text>
      </Seccion>
    </>
  );
}
