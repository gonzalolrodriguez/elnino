import { Alert, AlertDescription, AlertIcon, Box, Button, Flex, List, ListItem, SimpleGrid, Text, useToast } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { AlertaError, Campo, CampoArea, CampoSelect } from "../../components/Formulario";
import { useCarga } from "../../lib/useCarga";
import { api, descargar, guardarArchivo } from "../api";
import type { CamposBitacora, EntradaBitacora } from "../tipos";
import { IconoHistorial, IconoLapiz, IconoTilde } from "../../components/iconos/Iconos";
import { CabeceraPagina } from "../CabeceraPagina";
import { Cargando, Chip, fmtFecha, Seccion } from "../ui";
import { ROL_OPERATIVO, etiquetaEstadoBitacora, etiquetaRolOperativo } from "../../lib/etiquetas";

const CAMPOS = [
  { id: "decision", etiqueta: "Decisión", ayuda: "Qué se decide y para qué sectores." },
  { id: "evidencia", etiqueta: "Evidencia", ayuda: "Dato con fuente abrible: serie del río, umbrales, sectores o parte de lluvia." },
  { id: "limites", etiqueta: "Límites", ayuda: "Qué no sabemos o no cubre la evidencia." },
  { id: "riesgos", etiqueta: "Riesgos", ayuda: "De la decisión y de la decisión contraria (falsa alarma frente a demora)." },
  { id: "gatillos", etiqueta: "Gatillos de cambio", ayuda: "Valor y fuente que harían cambiar la decisión." },
] as const;

type Valores = Record<(typeof CAMPOS)[number]["id"] | "responsable_rol" | "fecha_simulada", string>;
const VACIO: Valores = { decision: "", evidencia: "", limites: "", riesgos: "", gatillos: "", responsable_rol: "", fecha_simulada: "" };

/** Valida los seis campos obligatorios de K8; devuelve un mensaje por campo vacío. */
export function validarBitacora(v: Valores): Partial<Record<keyof Valores, string>> {
  const e: Partial<Record<keyof Valores, string>> = {};
  for (const c of CAMPOS) if (!v[c.id].trim()) e[c.id] = `${c.etiqueta}: es obligatorio.`;
  if (!v.responsable_rol.trim()) e.responsable_rol = "Responsable (rol): es obligatorio.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.fecha_simulada)) e.fecha_simulada = "Fecha (día simulado): es obligatoria.";
  return e;
}

function Formulario({ borrador, alGuardar }: { borrador: EntradaBitacora | null; alGuardar: () => void }) {
  const { usuario } = useAuth();
  const toast = useToast();
  const esDecisor = usuario?.rol === "decisor";
  const [v, setV] = useState<Valores>({ ...VACIO, responsable_rol: usuario?.rol_operativo ?? "" });
  const [errores, setErrores] = useState<Partial<Record<keyof Valores, string>>>({});
  const [error, setError] = useState<unknown>(null);
  const [guardando, setGuardando] = useState(false);

  const tuvoBorrador = useRef(false);
  useEffect(() => {
    if (!borrador) {
      // Al salir de un borrador el formulario vuelve a vacío: no arrastra los datos de la entrada anterior.
      if (tuvoBorrador.current) {
        setV({ ...VACIO, responsable_rol: usuario?.rol_operativo ?? "" });
        setErrores({});
        setError(null);
      }
      tuvoBorrador.current = false;
      return;
    }
    tuvoBorrador.current = true;
    {
      setV({
        decision: borrador.decision ?? "",
        evidencia: borrador.evidencia ?? "",
        limites: borrador.limites ?? "",
        riesgos: borrador.riesgos ?? "",
        gatillos: borrador.gatillos ?? "",
        responsable_rol: borrador.responsable_rol ?? usuario?.rol_operativo ?? "",
        fecha_simulada: borrador.fecha_simulada ?? "",
      });
    }
  }, [borrador, usuario?.rol_operativo]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const errs = validarBitacora(v);
    setErrores(errs);
    if (Object.keys(errs).length > 0) return;
    const cuerpo: CamposBitacora = { ...v, decision: v.decision.trim(), evidencia: v.evidencia.trim(), limites: v.limites.trim(), riesgos: v.riesgos.trim(), gatillos: v.gatillos.trim(), responsable_rol: v.responsable_rol.trim() };
    setGuardando(true);
    try {
      if (borrador) await api.completarBitacora(borrador.id, cuerpo);
      else await api.crearBitacora(cuerpo);
      toast({ title: borrador ? "Borrador completado" : "Entrada de bitácora creada", status: "success", duration: 3000 });
      setV({ ...VACIO, responsable_rol: usuario?.rol_operativo ?? "" });
      alGuardar();
    } catch (err) {
      setError(err);
    } finally {
      setGuardando(false);
    }
  }

  const poner = (k: keyof Valores) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const area = (id: (typeof CAMPOS)[number]["id"], filas = 4) => {
    const c = CAMPOS.find((x) => x.id === id)!;
    return <CampoArea id={`bit-${id}`} etiqueta={c.etiqueta} ayuda={c.ayuda} isRequired rows={filas} value={v[id]} onChange={poner(id)} error={errores[id]} />;
  };
  // Si el borrador trae un rol que no está en el catálogo, se conserva como opción para no perderlo al guardar.
  const roles = Object.keys(ROL_OPERATIVO);
  if (v.responsable_rol && !roles.includes(v.responsable_rol)) roles.push(v.responsable_rol);

  return (
    <Box as="form" onSubmit={(e: React.FormEvent) => void guardar(e)} noValidate maxW="62rem">
      {!esDecisor && (
        <Alert status="info" mb={4}>
          <AlertIcon />
          <AlertDescription>Solo el decisor registra decisiones en la bitácora. Podés leer y exportar las entradas.</AlertDescription>
        </Alert>
      )}
      <Box as="fieldset" disabled={!esDecisor} border="none" m={0} p={0} minW={0}>
        <SimpleGrid columns={{ base: 1, md: 2 }} columnGap={5} rowGap={5}>
          <Box gridColumn={{ md: "1 / -1" }}>{area("decision", 3)}</Box>
          {area("evidencia")}
          {area("limites")}
          {area("riesgos")}
          {area("gatillos")}
          <CampoSelect id="bit-responsable" etiqueta="Responsable (rol)" ayuda="Quién firma la decisión, por su rol y no por su nombre." isRequired value={v.responsable_rol} onChange={poner("responsable_rol")} error={errores.responsable_rol}>
            <option value="">Elegí un rol</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {etiquetaRolOperativo(r)}
              </option>
            ))}
          </CampoSelect>
          <Campo id="bit-fecha" type="date" etiqueta="Fecha (día simulado)" ayuda="El día del escenario en que se decide." isRequired value={v.fecha_simulada} onChange={poner("fecha_simulada")} error={errores.fecha_simulada} />
        </SimpleGrid>
        <Button type="submit" mt={5} w={{ base: "100%", md: "auto" }} isLoading={guardando}>
          {borrador ? "Completar borrador" : "Registrar decisión"}
        </Button>
      </Box>
      <Box mt={3}>
        <AlertaError error={error} />
      </Box>
    </Box>
  );
}

const ROTULOS_ENTRADA = [
  ["evidencia", "Evidencia"],
  ["limites", "Límites"],
  ["riesgos", "Riesgos"],
  ["gatillos", "Gatillos de cambio"],
] as const;

/** Una entrada de la bitácora: estado, responsable y fecha arriba; los campos de K8 debajo en dos columnas. */
function FilaEntrada({ b, alCompletar, alExportar }: { b: EntradaBitacora; alCompletar: () => void; alExportar: () => void }) {
  const borrador = b.estado === "borrador";
  return (
    <ListItem py={4} borderTop="1px solid" borderColor="borde" _first={{ borderTop: "none", pt: 0 }} data-testid={`bitacora-${b.id}`}>
      <Flex align="center" columnGap={3} rowGap={1.5} wrap="wrap">
        <Text as="span" fontWeight={700}>
          Entrada N.º {b.id}
        </Text>
        <Chip tono={borrador ? "aviso" : "ok"} icono={borrador ? <IconoLapiz tam="1em" /> : <IconoTilde tam="1em" />}>
          {etiquetaEstadoBitacora(b.estado)}
        </Chip>
        <Text as="span" textStyle="microdato">
          {b.responsable_rol ? etiquetaRolOperativo(b.responsable_rol) : "Sin responsable"} · {fmtFecha(b.fecha_simulada)}
          {b.orden_id ? ` · orden ${b.orden_id}` : ""}
        </Text>
        <Flex gap={2} ml={{ md: "auto" }} wrap="wrap">
          {borrador && (
            <Button size="sm" onClick={alCompletar}>
              Completar
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={alExportar}>
            Exportar Markdown
          </Button>
        </Flex>
      </Flex>
      <Text mt={2} fontWeight={600} maxW="70ch" whiteSpace="pre-wrap">
        {b.decision || "Sin decisión redactada todavía."}
      </Text>
      <Box as="dl" mt={2} display="grid" gridTemplateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))" }} columnGap={5} rowGap={2} maxW="62rem">
        {ROTULOS_ENTRADA.map(([k, rotulo]) => (
          <Box key={k} minW={0}>
            <Text as="dt" textStyle="rotulo">
              {rotulo}
            </Text>
            <Text as="dd" m={0} whiteSpace="pre-wrap" color={b[k] ? undefined : "textoSuave"}>
              {b[k] || "Sin completar"}
            </Text>
          </Box>
        ))}
      </Box>
    </ListItem>
  );
}

export default function Bitacora() {
  const [params, setParams] = useSearchParams();
  const lista = useCarga(() => api.bitacora());
  const [error, setError] = useState<unknown>(null);
  const idBorrador = Number(params.get("borrador")) || null;
  const borrador = lista.datos?.entradas.find((b) => b.id === idBorrador && b.estado === "borrador") ?? null;

  async function exportar(b: EntradaBitacora) {
    setError(null);
    try {
      guardarArchivo(await descargar(`/bitacora/${b.id}/export`), `bitacora_${b.id}.md`);
    } catch (e) {
      setError(e);
    }
  }

  return (
    <>
      <CabeceraPagina titulo="Bitácora de decisiones" icono={<IconoHistorial tam="1.5rem" />} categoria="SIMULADO" ayuda="Cada decisión lleva responsable (rol), evidencia y fecha del día simulado." />
      <Seccion titulo={borrador ? `Completar el borrador ${borrador.id}${borrador.orden_id ? ` (orden ${borrador.orden_id})` : ""}` : "Nueva decisión"} id="sec-form" derecha={
        borrador ? (
          <Button size="xs" variant="outline" onClick={() => setParams({})}>
            Dejar de completar el borrador
          </Button>
        ) : undefined
      }>
        <Formulario borrador={borrador} alGuardar={() => { setParams({}); lista.recargar(); }} />
      </Seccion>
      <Seccion titulo="Entradas registradas" id="sec-lista">
        <Cargando carga={lista} esVacio={(d) => d.entradas.length === 0} vacio="Todavía no hay decisiones registradas." hijos={(d) => (
          <List aria-labelledby="sec-lista">
            {d.entradas.map((b) => (
              <FilaEntrada key={b.id} b={b} alCompletar={() => setParams({ borrador: String(b.id) })} alExportar={() => void exportar(b)} />
            ))}
          </List>
        )} />
        <AlertaError error={error} />
      </Seccion>
    </>
  );
}
