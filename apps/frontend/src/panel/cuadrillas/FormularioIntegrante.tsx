import { Box, Button, Flex, FormControl, FormLabel, Input, Select, Text, useToast } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { AlertaError } from "../../components/Formulario";
import { ROL_OPERATIVO, etiquetaRolOperativo } from "../../lib/etiquetas";
import { api } from "../api";
import type { CuadrillaResumen } from "../tipos";

type RolOp = { codigo: string; nombre: string };
type Candidato = { id: number; rol_operativo: string | null };

/**
 * Alta de un integrante: se elige entre los usuarios con rol `cuadrilla` (sin nombres: número y rol operativo).
 * La lista de usuarios es de administración: si el operador no puede leerla, se ingresa el número de usuario.
 */
export function FormularioIntegrante({ cuadrilla, alAgregar }: { cuadrilla: CuadrillaResumen; alAgregar: () => void }) {
  const toast = useToast();
  const [roles, setRoles] = useState<RolOp[]>(Object.entries(ROL_OPERATIVO).map(([codigo, nombre]) => ({ codigo, nombre })));
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null);
  const [listaNoDisponible, setListaNoDisponible] = useState(false);
  const [usuario, setUsuario] = useState("");
  const [rol, setRol] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let activo = true;
    void api
      .rolesOperativos()
      .then((r) => activo && r.roles.length > 0 && setRoles(r.roles))
      .catch(() => undefined);
    void api
      .usuarios()
      .then((u) => {
        if (!activo) return;
        const ya = new Set(cuadrilla.integrantes.map((i) => i.usuario_id));
        setCandidatos(u.filter((x) => x.rol === "cuadrilla" && x.estado === "activo" && !ya.has(x.id)).map((x) => ({ id: x.id, rol_operativo: x.rol_operativo })));
      })
      .catch(() => activo && setListaNoDisponible(true));
    return () => {
      activo = false;
    };
  }, [cuadrilla.integrantes]);

  const idUsuario = Number(usuario);
  const valido = Number.isInteger(idUsuario) && idUsuario > 0 && rol !== "";

  async function agregar() {
    setError(null);
    setEnviando(true);
    try {
      await api.agregarIntegrante(cuadrilla.id, { usuario_id: idUsuario, rol_operativo: rol });
      toast({ title: "Integrante agregado", description: `${etiquetaRolOperativo(rol)} en ${cuadrilla.nombre}`, status: "success", duration: 3000 });
      setUsuario("");
      setRol("");
      alAgregar();
    } catch (e) {
      setError(e);
    } finally {
      setEnviando(false);
    }
  }

  const base = `integrante-${cuadrilla.id}`;
  return (
    <Box mt={3} p={3} borderRadius="lg" bg="fondo" border="1px solid" borderColor="borde" data-testid={`form-integrante-${cuadrilla.id}`}>
      <Flex gap={2} align="flex-end" wrap="wrap">
        <FormControl w={{ base: "full", sm: "13rem" }}>
          <FormLabel htmlFor={`${base}-usuario`} textStyle="rotulo" color="texto" mb={1}>
            Usuario de cuadrilla
          </FormLabel>
          {candidatos !== null && candidatos.length > 0 ? (
            <Select id={`${base}-usuario`} size="md" bg="superficie" placeholder="Elegí un usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)}>
              {candidatos.map((c) => (
                <option key={c.id} value={c.id}>
                  {`Usuario n.º ${c.id}${c.rol_operativo ? ` · ${etiquetaRolOperativo(c.rol_operativo)}` : ""}`}
                </option>
              ))}
            </Select>
          ) : (
            <Input id={`${base}-usuario`} size="md" bg="superficie" type="number" min={1} inputMode="numeric" placeholder="N.º de usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
          )}
        </FormControl>
        <FormControl w={{ base: "full", sm: "14rem" }}>
          <FormLabel htmlFor={`${base}-rol`} textStyle="rotulo" color="texto" mb={1}>
            Rol operativo
          </FormLabel>
          <Select id={`${base}-rol`} size="md" bg="superficie" placeholder="Elegí un rol" value={rol} onChange={(e) => setRol(e.target.value)}>
            {roles.map((r) => (
              <option key={r.codigo} value={r.codigo}>
                {etiquetaRolOperativo(r.codigo) || r.nombre}
              </option>
            ))}
          </Select>
        </FormControl>
        <Button size="md" w={{ base: "full", sm: "auto" }} onClick={() => void agregar()} isDisabled={!valido} isLoading={enviando}>
          Agregar integrante
        </Button>
      </Flex>
      {(listaNoDisponible || (candidatos !== null && candidatos.length === 0)) && (
        <Text textStyle="microdato" mt={2}>
          {listaNoDisponible
            ? "Tu rol no puede ver la lista de usuarios de cuadrilla: ingresá el número de usuario que te informó la administración."
            : "No hay usuarios de cuadrilla libres para sumar: ingresá un número de usuario si ya sabés cuál."}
        </Text>
      )}
      <Box mt={2}>
        <AlertaError error={error} />
      </Box>
    </Box>
  );
}
