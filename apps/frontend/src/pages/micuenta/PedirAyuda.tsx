import { Alert, AlertIcon, Box, Button, FormControl, FormErrorMessage, FormLabel, Heading, Select, Text, Textarea, VStack } from "@chakra-ui/react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { AvisoFueraDeFormosa, BotonUbicacion } from "../../components/BotonUbicacion";
import { ElegirEnMapa } from "../../components/ElegirEnMapa";
import { AlertaError, Campo } from "../../components/Formulario";
import { Plegable } from "../../components/Plegable";
import { solicitar } from "../../lib/api";
import { etiquetaEstadoSolicitud, TIPO_SOLICITUD } from "../../lib/etiquetas";
import { coordenadaATexto, decimal, enfocarPrimerError, enRango, entero, validarCoordenadas, type Errores } from "../../lib/validacion";

type Creada = { id: number; estado: string };

/** Tipos que ofrece la ciudadanía; «ganado» solo para productores (el backend acepta los cinco). */
const TIPOS_CIUDADANIA = ["asistencia", "evacuacion", "otro"] as const;
const TIPOS_PRODUCTOR = ["asistencia", "evacuacion", "ganado", "otro"] as const;

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

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (k === "personas") personasEditadas.current = true;
    setV({ ...v, [k]: e.target.value });
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
    <Box as="section" aria-labelledby="pedir-ayuda" layerStyle="tarjeta" p={{ base: 4, md: 6 }} mb={6}>
      <Heading as="h2" id="pedir-ayuda" size="md" mb={2}>
        Pedir ayuda
      </Heading>
      <Alert status="warning" fontSize="sm" mb={4} alignItems="flex-start">
        <AlertIcon />
        <span>
          Si hay peligro inmediato, llamá al 103. Este pedido necesita conexión a internet; sin datos, usá la app o un SMS. Es un prototipo: el
          pedido lo recibe un operador y no garantiza un traslado.
        </span>
      </Alert>
      {creada ? (
        <Alert status="success" role="status" alignItems="flex-start">
          <AlertIcon />
          <Box>
            <Text fontWeight={600}>
              Pedido enviado (n.º {creada.id}). Estado: {etiquetaEstadoSolicitud(creada.estado)}.
            </Text>
            <Button size="sm" variant="outline" mt={2} minH="2.75rem" onClick={() => setCreada(null)}>
              Hacer otro pedido
            </Button>
          </Box>
        </Alert>
      ) : (
        <form onSubmit={(e) => void enviar(e)} noValidate aria-label="Pedir ayuda">
          <VStack spacing={4} align="stretch" maxW="34rem">
            <AlertaError error={errorApi} />
            <FormControl>
              <FormLabel htmlFor="ayuda-tipo">Qué necesitás</FormLabel>
              <Select id="ayuda-tipo" bg="superficie" value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value })}>
                {tipos.map((t) => (
                  <option key={t} value={t}>
                    {TIPO_SOLICITUD[t]}
                  </option>
                ))}
              </Select>
            </FormControl>
            <Box display="grid" gridTemplateColumns={esProductor ? "repeat(2, 1fr)" : "1fr"} gap={4}>
              <Campo id="ayuda-personas" etiqueta="Personas" inputMode="numeric" value={v.personas} onChange={set("personas")} error={errores.personas} />
              {esProductor && (
                <Campo id="ayuda-animales" etiqueta="Animales" inputMode="numeric" value={v.animales} onChange={set("animales")} error={errores.animales} />
              )}
            </Box>
            <FormControl isInvalid={!!errores.texto}>
              <FormLabel htmlFor="ayuda-texto">Mensaje (opcional)</FormLabel>
              <Textarea id="ayuda-texto" bg="superficie" rows={3} maxLength={500} value={v.texto} onChange={(e) => setV({ ...v, texto: e.target.value })} />
              {errores.texto && <FormErrorMessage>{errores.texto}</FormErrorMessage>}
            </FormControl>
            <BotonUbicacion primario onUbicacion={(lo, la) => setV((x) => ({ ...x, lon: coordenadaATexto(lo), lat: coordenadaATexto(la) }))} />
            <ElegirEnMapa lon={v.lon} lat={v.lat} onChange={(p) => setV((x) => ({ ...x, lon: coordenadaATexto(p.lon), lat: coordenadaATexto(p.lat) }))} />
            <Plegable titulo="O escribí las coordenadas a mano" abierto={errores.lat || errores.lon ? true : undefined}>
              <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={4} pb={2}>
                <Campo id="ayuda-lat" etiqueta="Latitud" inputMode="decimal" value={v.lat} onChange={set("lat")} error={errores.lat} placeholder="-26,183" />
                <Campo id="ayuda-lon" etiqueta="Longitud" inputMode="decimal" value={v.lon} onChange={set("lon")} error={errores.lon} placeholder="-58,183" />
              </Box>
            </Plegable>
            {errores.lat && errores.lon && !v.lat && !v.lon && (
              <Text fontSize="sm" color="umbral.textoEvacuacion" role="alert">
                Necesitamos tu ubicación para enviar el pedido.
              </Text>
            )}
            <AvisoFueraDeFormosa lon={puntoValido ? lon : null} lat={puntoValido ? lat : null} />
            <Button type="submit" isLoading={enviando} loadingText="Enviando" minH="2.75rem">
              Enviar pedido
            </Button>
          </VStack>
        </form>
      )}
    </Box>
  );
}
