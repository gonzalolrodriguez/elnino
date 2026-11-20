import { Box, Button, chakra, Flex, FormControl, FormErrorMessage, FormLabel, Text, Textarea, VStack } from "@chakra-ui/react";
import { useEffect, useRef, useState, type FormEvent, type ReactElement } from "react";

import { AvisoFueraDeFormosa } from "../../components/BotonUbicacion";
import { Contador } from "../../components/Contador";
import { AlertaError } from "../../components/Formulario";
import { IconoMascota, IconoPersonas, IconoPuntos, IconoRumbo, IconoSalvavidas, IconoTilde, IconoTriangulo } from "../../components/iconos/Iconos";
import { SelectorUbicacion } from "../../components/SelectorUbicacion";
import { solicitar } from "../../lib/api";
import { etiquetaEstadoSolicitud, TIPO_SOLICITUD } from "../../lib/etiquetas";
import { coordenadaATexto, decimal, enfocarPrimerError, enRango, entero, validarCoordenadas, type Errores } from "../../lib/validacion";

type Creada = { id: number; estado: string };

/** Tipos que ofrece la ciudadanía; «ganado» solo para productores (el backend acepta los cinco). */
const TIPOS_CIUDADANIA = ["asistencia", "evacuacion", "otro"] as const;
const TIPOS_PRODUCTOR = ["asistencia", "evacuacion", "ganado", "otro"] as const;

const ICONO_TIPO: Record<string, ReactElement> = {
  asistencia: <IconoPersonas />,
  evacuacion: <IconoRumbo />,
  ganado: <IconoMascota />,
  otro: <IconoPuntos />,
};

/** Radio nativo (teclado y lectores de pantalla) que pinta la ficha hermana cuando está marcado o enfocado. */
const RadioOculto = chakra("input", {
  baseStyle: {
    position: "absolute",
    opacity: 0,
    inset: 0,
    w: "100%",
    h: "100%",
    m: 0,
    cursor: "pointer",
    "&:checked + div": { bg: "agua.100", borderColor: "agua.700", color: "agua.800", boxShadow: "0 0 0 1px var(--chakra-colors-agua-700)" },
    "&:focus-visible + div": { outline: "3px solid", outlineColor: "foco", outlineOffset: "2px" },
  },
});

/**
 * «Pedir ayuda» desde la web: POST /solicitudes (origen «web»). Necesita conexión; sin datos la app y el SMS
 * son el camino. Lleva `Idempotency-Key` por envío: un reintento del mismo envío no duplica el pedido.
 */
export function PedirAyuda({ esProductor, alEnviar }: { esProductor: boolean; alEnviar?: () => void }) {
  const tipos = esProductor ? TIPOS_PRODUCTOR : TIPOS_CIUDADANIA;
  const [v, setV] = useState({ tipo: "asistencia", personas: "1", animales: "0", texto: "", lon: "", lat: "" });
  const [errores, setErrores] = useState<Errores>({});
  const [enviando, setEnviando] = useState(false);
  const [errorApi, setErrorApi] = useState<unknown>(null);
  const [creada, setCreada] = useState<Creada | null>(null);
  const clave = useRef<string | null>(null);
  const personasEditadas = useRef(false);

  // «Personas» arranca en el tamaño del grupo familiar (nunca en 0); sin grupo cargado queda en 1.
  useEffect(() => {
    let vivo = true;
    solicitar<{ integrantes?: number }>("/mi/grupo-familiar", { autenticado: true })
      .then((g) => {
        const n = g?.integrantes;
        if (vivo && !personasEditadas.current && typeof n === "number" && n >= 1) setV((x) => ({ ...x, personas: String(n) }));
      })
      .catch(() => undefined); // 404 o sin conexión: se queda en 1
    return () => {
      vivo = false;
    };
  }, []);

  const poner = (k: keyof typeof v, valor: string) => {
    if (k === "personas") personasEditadas.current = true;
    setV((x) => ({ ...x, [k]: valor }));
  };
  const lon = decimal(v.lon);
  const lat = decimal(v.lat);
  const puntoValido = lon !== null && lat !== null && !Number.isNaN(lon) && !Number.isNaN(lat);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setErrorApi(null);
    const personas = entero(v.personas);
    const animales = entero(v.animales);
    const err: Errores = { ...validarCoordenadas(v.lon, v.lat, true) };
    if (!enRango(personas, 1, 500)) err.personas = "Entre 1 y 500 personas.";
    if (!enRango(animales, 0, 100000)) err.animales = "Entre 0 y 100.000 animales.";
    if (v.texto.length > 500) err.texto = "Máximo 500 caracteres.";
    setErrores(err);
    if (Object.keys(err).length) {
      enfocarPrimerError();
      return;
    }
    clave.current ??= crypto.randomUUID();
    setEnviando(true);
    try {
      const cuerpo: Record<string, unknown> = { tipo: v.tipo, personas, animales, lon, lat, origen: "web" };
      if (v.texto.trim()) cuerpo.texto = v.texto.trim();
      setCreada(await solicitar<Creada>("/solicitudes", { autenticado: true, cuerpo, cabeceras: { "Idempotency-Key": clave.current } }));
      clave.current = null; // el próximo pedido es otro envío
      alEnviar?.();
    } catch (x) {
      setErrorApi(x); // la clave se conserva: reintentar el mismo envío no duplica
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Box>
      <Flex align="flex-start" gap={3} p={3.5} mb={5} borderRadius="xl" bg="alerta.50" border="1px solid" borderColor="alerta.200" color="alerta.900">
        <Box aria-hidden="true" display="flex" mt="2px" color="alerta.700">
          <IconoTriangulo />
        </Box>
        <Text fontSize="sm" lineHeight={1.5}>
          <strong>Si hay peligro inmediato, llamá al 103.</strong> Este pedido necesita conexión a internet; sin datos, usá la app o un SMS. Es un prototipo: el pedido lo recibe un operador y no garantiza un traslado.
        </Text>
      </Flex>
      {creada ? (
        <Flex role="status" align="flex-start" gap={4} p={{ base: 4, md: 5 }} borderRadius="xl" bg="verde.50" border="1px solid" borderColor="verde.200">
          <Flex aria-hidden="true" align="center" justify="center" flex="none" w="2.75rem" h="2.75rem" borderRadius="full" bg="verde.600" color="papel">
            <IconoTilde tam="1.5rem" />
          </Flex>
          <Box>
            <Text fontWeight={700} fontSize="lg" lineHeight={1.3}>
              Pedido enviado (n.º {creada.id}). Estado: {etiquetaEstadoSolicitud(creada.estado)}.
            </Text>
            <Text fontSize="sm" color="textoSuave">
              Vas a ver cómo avanza arriba, en «Mi pedido activo».
            </Text>
            <Button size="sm" variant="outline" mt={3} minH="2.75rem" onClick={() => setCreada(null)}>
              Hacer otro pedido
            </Button>
          </Box>
        </Flex>
      ) : (
        <form onSubmit={(e) => void enviar(e)} noValidate aria-label="Pedir ayuda">
          <VStack spacing={6} align="stretch">
            <AlertaError error={errorApi} />
            <Box as="fieldset" border="0" p={0} m={0} minW={0}>
              <Text as="legend" fontWeight={700} mb={2} p={0}>
                Qué necesitás
              </Text>
              <Box display="grid" gridTemplateColumns={{ base: tipos.length === 3 ? "repeat(3, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))", sm: `repeat(${tipos.length}, minmax(0, 1fr))` }} gap={2}>
                {tipos.map((t) => (
                  <Box as="label" key={t} position="relative" display="block">
                    <RadioOculto type="radio" name="ayuda-tipo" value={t} checked={v.tipo === t} onChange={() => setV((x) => ({ ...x, tipo: t }))} />
                    <Flex
                      direction="column"
                      align="center"
                      justify="center"
                      gap={1.5}
                      minH="4.5rem"
                      px={2}
                      py={3}
                      borderRadius="xl"
                      bg="superficie"
                      border="1px solid"
                      borderColor="bordeControl"
                      color="texto"
                      fontWeight={600}
                      textAlign="center"
                      lineHeight={1.2}
                      transition="background-color 160ms var(--ease-out), border-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out)"
                    >
                      <Box aria-hidden="true" display="flex" fontSize="1.5rem">
                        {ICONO_TIPO[t] ?? <IconoPuntos />}
                      </Box>
                      {TIPO_SOLICITUD[t]}
                    </Flex>
                  </Box>
                ))}
              </Box>
            </Box>
            <Box display="grid" gridTemplateColumns={esProductor ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 14rem)"} gap={4}>
              <Contador id="ayuda-personas" etiqueta="Personas" icono={<IconoPersonas />} min={1} max={500} value={v.personas} onChange={(t) => poner("personas", t)} error={errores.personas} />
              {esProductor && <Contador id="ayuda-animales" etiqueta="Animales" icono={<IconoMascota />} min={0} max={100000} value={v.animales} onChange={(t) => poner("animales", t)} error={errores.animales} />}
            </Box>
            <FormControl isInvalid={!!errores.texto}>
              <FormLabel htmlFor="ayuda-texto">Mensaje (opcional)</FormLabel>
              <Textarea id="ayuda-texto" bg="superficie" rows={3} maxLength={500} value={v.texto} onChange={(e) => setV({ ...v, texto: e.target.value })} placeholder="Contanos qué pasa o cómo llegar" />
              {errores.texto && <FormErrorMessage>{errores.texto}</FormErrorMessage>}
            </FormControl>
            <Box>
              <Text fontWeight={700} mb={1}>
                Dónde estás
              </Text>
              <Text fontSize="sm" color="textoSuave" mb={3}>
                Un operador usa este punto para ubicarte y mandar a la cuadrilla.
              </Text>
              <SelectorUbicacion
                idBase="ayuda"
                lon={v.lon}
                lat={v.lat}
                errorLon={errores.lon}
                errorLat={errores.lat}
                onPunto={(lo, la) => setV((x) => ({ ...x, lon: coordenadaATexto(lo), lat: coordenadaATexto(la) }))}
                onTexto={(campo, valor) => setV((x) => ({ ...x, [campo]: valor }))}
              />
              {errores.lat && errores.lon && !v.lat && !v.lon && (
                <Text fontSize="sm" color="umbral.textoEvacuacion" fontWeight={600} mt={1}>
                  Necesitamos tu ubicación para enviar el pedido.
                </Text>
              )}
            </Box>
            <AvisoFueraDeFormosa lon={puntoValido ? lon : null} lat={puntoValido ? lat : null} />
            <Button type="submit" isLoading={enviando} loadingText="Enviando" minH="3rem" size="lg" leftIcon={<IconoSalvavidas />} alignSelf={{ base: "stretch", sm: "flex-start" }}>
              Enviar pedido
            </Button>
          </VStack>
        </form>
      )}
    </Box>
  );
}
