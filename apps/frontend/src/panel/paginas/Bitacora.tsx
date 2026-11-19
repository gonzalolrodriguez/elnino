import { Alert, AlertDescription, AlertIcon, Badge, Box, Button, Flex, FormControl, FormErrorMessage, FormLabel, Heading, Input, Text, Textarea, useToast } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { AlertaError } from "../../components/Formulario";
import { Insignia } from "../../components/Insignia";
import { useCarga } from "../../lib/useCarga";
import { api, descargar, guardarArchivo } from "../api";
import type { CamposBitacora, EntradaBitacora } from "../tipos";
import { Cargando, fmtFecha, Seccion } from "../ui";
import { etiquetaEstadoBitacora } from "../../lib/etiquetas";

const CAMPOS = [
  { id: "decision", etiqueta: "Decisión", ayuda: "Qué se decide y para qué sectores." },
  { id: "evidencia", etiqueta: "Evidencia", ayuda: "Dato con fuente abrible (K1, K3, K10, parte de lluvia)." },
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

  const poner = (k: keyof Valores) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  return (
    <Box as="form" onSubmit={(e: React.FormEvent) => void guardar(e)} noValidate>
      {!esDecisor && (
        <Alert status="info" mb={3} fontSize="sm">
          <AlertIcon />
          <AlertDescription>Solo el decisor registra decisiones en la bitácora. Podés leer y exportar las entradas.</AlertDescription>
        </Alert>
      )}
      <fieldset disabled={!esDecisor} style={{ border: 0, padding: 0, margin: 0 }}>
        {CAMPOS.map((c) => (
          <FormControl key={c.id} isInvalid={!!errores[c.id]} mb={3} isRequired>
            <FormLabel htmlFor={`bit-${c.id}`} fontSize="sm" mb={0}>
              {c.etiqueta}
            </FormLabel>
            <Textarea id={`bit-${c.id}`} size="sm" bg="superficie" rows={2} maxLength={4000} value={v[c.id]} onChange={poner(c.id)} />
            {errores[c.id] ? <FormErrorMessage>{errores[c.id]}</FormErrorMessage> : <Text fontSize="xs" color="textoSuave">{c.ayuda}</Text>}
          </FormControl>
        ))}
        <Flex gap={3} wrap="wrap" mb={3}>
          <FormControl isInvalid={!!errores.responsable_rol} w="16rem" isRequired>
            <FormLabel htmlFor="bit-responsable" fontSize="sm" mb={0}>
              Responsable (rol)
            </FormLabel>
            <Input id="bit-responsable" size="sm" bg="superficie" value={v.responsable_rol} onChange={poner("responsable_rol")} maxLength={60} />
            <FormErrorMessage>{errores.responsable_rol}</FormErrorMessage>
          </FormControl>
          <FormControl isInvalid={!!errores.fecha_simulada} w="12rem" isRequired>
            <FormLabel htmlFor="bit-fecha" fontSize="sm" mb={0}>
              Fecha (día simulado)
            </FormLabel>
            <Input id="bit-fecha" type="date" size="sm" bg="superficie" value={v.fecha_simulada} onChange={poner("fecha_simulada")} />
            <FormErrorMessage>{errores.fecha_simulada}</FormErrorMessage>
          </FormControl>
        </Flex>
        <Button type="submit" size="sm" isLoading={guardando}>
          {borrador ? "Completar borrador" : "Registrar decisión"}
        </Button>
      </fieldset>
      <Box mt={3}>
        <AlertaError error={error} />
      </Box>
    </Box>
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
      <Heading as="h1" size="lg" mb={1}>
        Bitácora de decisiones
      </Heading>
      <Flex gap={2} align="center" mb={4}>
        <Insignia categoria="SIMULADO" />
        <Text fontSize="sm" color="textoSuave">
          Cada decisión lleva responsable (rol), evidencia y fecha del día simulado.
        </Text>
      </Flex>
      <Seccion titulo={borrador ? `Completar el borrador ${borrador.id}${borrador.orden_id ? ` (orden ${borrador.orden_id})` : ""}` : "Nueva decisión"} id="sec-form" derecha={
        borrador ? (
          <Button size="xs" variant="outline" onClick={() => setParams({})}>
            Dejar de completar el borrador
          </Button>
        ) : undefined
      }>
        <Formulario borrador={borrador} alGuardar={() => { setParams({}); lista.recargar(); }} />
      </Seccion>
      <Seccion titulo="Entradas" id="sec-lista">
        <Cargando carga={lista} esVacio={(d) => d.entradas.length === 0} vacio="Todavía no hay decisiones registradas." hijos={(d) => (
          <Box as="ul" listStyleType="none" m={0} p={0}>
            {d.entradas.map((b) => (
              <Box as="li" key={b.id} borderTop="1px solid" borderColor="borde" py={3}>
                <Flex gap={2} align="center" wrap="wrap" mb={1}>
                  <strong>Entrada {b.id}</strong>
                  <Badge colorScheme={b.estado === "borrador" ? "orange" : "green"}>{etiquetaEstadoBitacora(b.estado)}</Badge>
                  <Text fontSize="xs" color="textoSuave">
                    {b.responsable_rol ?? "sin responsable"} · {fmtFecha(b.fecha_simulada)}
                    {b.orden_id ? ` · orden ${b.orden_id}` : ""}
                  </Text>
                  <Box ml="auto" display="flex" gap={2}>
                    {b.estado === "borrador" && (
                      <Button size="xs" onClick={() => setParams({ borrador: String(b.id) })}>
                        Completar
                      </Button>
                    )}
                    <Button size="xs" variant="outline" onClick={() => void exportar(b)}>
                      Exportar Markdown
                    </Button>
                  </Box>
                </Flex>
                <Text fontSize="sm" whiteSpace="pre-wrap">
                  {b.decision || "Sin decisión redactada todavía."}
                </Text>
              </Box>
            ))}
          </Box>
        )} />
        <AlertaError error={error} />
      </Seccion>
    </>
  );
}
