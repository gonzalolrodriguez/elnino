import { Alert, AlertDescription, AlertIcon, Badge, Box, Button, Flex, FormControl, FormErrorMessage, FormLabel, Heading, Input, SimpleGrid, Text, Textarea, useToast } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { AlertaError } from "../../components/Formulario";
import { Insignia } from "../../components/Insignia";
import { useCarga } from "../../lib/useCarga";
import { api, descargar, guardarArchivo } from "../api";
import type { CamposBitacora, EntradaBitacora } from "../tipos";
import { Cargando, fmtFecha, Seccion } from "../ui";

const ESCENARIOS_K8 = [
  {
    codigo: "A · Preparación",
    descripcion: "Comunicación preventiva, verificación de rutas y centros de recepción, monitoreo diario con umbrales de aviso. Sin evacuación.",
    pregunta: "¿Qué dato convertiría A en B? ¿Qué estación aguas arriba avisa antes? (Puerto Pilcomayo, siteCode 55).",
    color: "agua.700",
  },
  {
    codigo: "B · Evacuación preventiva",
    descripcion: "Evacuación inmediata de los sectores por debajo de una altura de escala definida por el comité (ej. S4 a 7,50 m), con alojamiento temporal.",
    pregunta: "¿Qué sectores primero y por qué acceso? (S4 Rural Este por único camino de tierra, 0,30 m antes del alerta oficial).",
    color: "escala.alerta",
  },
  {
    codigo: "C · Espera",
    descripcion: "No disponer acciones hasta que la escala de Puerto Formosa supere el nivel oficial de alerta (7,80 m).",
    pregunta: "¿Cuánto tiempo queda si el río acelera? Esperar a 7,80 m deja a S4 comprometido y con riesgo de bloqueo por lluvia.",
    color: "escala.evacuacion",
  },
] as const;

const CAMPOS = [
  { id: "decision", etiqueta: "Decisión", ayuda: "Qué se decide y para qué sectores." },
  { id: "evidencia", etiqueta: "Evidencia", ayuda: "Dato con fuente abrible (K1, K3, K10, parte de lluvia)." },
  { id: "limites", etiqueta: "Límites", ayuda: "Qué no sabemos o no cubre la evidencia." },
  { id: "riesgos", etiqueta: "Riesgos", ayuda: "De la decisión y de la decisión contraria (falsa alarma frente a demora)." },
  { id: "gatillos", etiqueta: "Gatillos de cambio", ayuda: "Valor y fuente que harían cambiar la decisión." },
] as const;

type Valores = Record<(typeof CAMPOS)[number]["id"] | "responsable_rol" | "fecha_simulada", string>;
const VACIO: Valores = { decision: "", evidencia: "", limites: "", riesgos: "", gatillos: "", responsable_rol: "", fecha_simulada: "" };

const EJEMPLO_K8: Valores = {
  decision: "Adoptar el Escenario A (Preparación activa) al corte del 31/10/2026 (5,60 m), combinándolo con transición preventiva al Escenario B para el Sector S4 Rural Este (compromiso 7,50 m) ante lluvias >= 30 mm o nivel >= 7,00 m.",
  evidencia: "K1 limpio: Puerto Formosa al 31/10/2026 mide 5,60 m (ascenso desde 2,37 m el 01/10). K3: alerta en 7,80 m y evacuación en 8,30 m. K10: S4 se compromete a 7,50 m (0,30 m antes del alerta) y tiene un único camino de tierra.",
  limites: "El kit no incluye lluvia observada en Formosa (planilla vacía) ni pronósticos hidrológicos a más de 15 días (K9). Los polígonos K10 y capacidades de centros son SIMULADO.",
  riesgos: "Actuar hoy con evacuación masiva a 5,60 m implica costo de falsa alarma. Esperar hasta 7,80 m (Escenario C) expone a las 150 personas y rodeos de S4 a quedar aislados por barro o agua a los 7,50 m.",
  gatillos: "1) Puerto Formosa >= 7,00 m en escala INA siteCode 57 (K1/K3). 2) Parte pluvial policial >= 30 mm en 24 h sobre camino de tierra de S4. 3) Alerta en Puerto Pilcomayo aguas arriba (>= 5,35 m, siteCode 55, K3).",
  responsable_rol: "defensa_civil",
  fecha_simulada: "2026-10-31",
};

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

  useEffect(() => {
    if (borrador) {
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
        <Flex justify="flex-end" mb={2}>
          <Button
            size="xs"
            variant="outline"
            type="button"
            onClick={() => {
              setV({
                ...EJEMPLO_K8,
                responsable_rol: usuario?.rol_operativo || EJEMPLO_K8.responsable_rol,
              });
              setErrores({});
            }}
          >
            Cargar plantilla sugerida (Escenario A+B · Ventana Seca S4)
          </Button>
        </Flex>
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
        Bitácora de decisiones K8
      </Heading>
      <Flex gap={2} align="center" mb={4}>
        <Insignia categoria="SIMULADO" />
        <Text fontSize="sm" color="textoSuave">
          Cada decisión lleva responsable (rol), evidencia y fecha del día simulado.
        </Text>
      </Flex>

      <Seccion titulo="Escenarios de actuación del Comité de la Misión (K8)" categoria="SIMULADO" id="sec-escenarios-k8">
        <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={3}>
          {ESCENARIOS_K8.map((esc) => (
            <Box key={esc.codigo} bg="pizarra.100" p={3} borderRadius="sm" borderLeft="4px solid" borderLeftColor={esc.color}>
              <Heading as="h3" size="xs" mb={1}>
                {esc.codigo}
              </Heading>
              <Text fontSize="xs" mb={2}>
                {esc.descripcion}
              </Text>
              <Text fontSize="xs" color="textoSuave">
                <strong>Foco del comité:</strong> {esc.pregunta}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
      </Seccion>

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
                  <Badge colorScheme={b.estado === "borrador" ? "orange" : "green"}>{b.estado}</Badge>
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
