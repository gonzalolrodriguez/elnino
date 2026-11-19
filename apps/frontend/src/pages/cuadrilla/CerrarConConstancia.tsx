import { Alert, AlertDescription, AlertIcon, Box, Button, Flex, FormControl, FormErrorMessage, FormHelperText, FormLabel, Heading, Input, Select, SimpleGrid, Text, Textarea } from "@chakra-ui/react";
import { useRef, useState } from "react";

import { AlertaError } from "../../components/Formulario";
import { BotonUbicacion } from "../../components/BotonUbicacion";
import { useCarga } from "../../lib/useCarga";
import { api, subirFotoCierre } from "../../panel/api";
import type { CierreEvacuacion } from "../../panel/tipos";

export const ESPECIES = [
  ["bovinos", "Bovinos"],
  ["ovinos", "Ovinos"],
  ["caprinos", "Caprinos"],
  ["porcinos", "Porcinos"],
  ["equinos", "Equinos"],
] as const;
export const MAX_FOTOS = 5;
const TIPOS_FOTO = "image/jpeg,image/png,image/webp";

type Errores = Partial<Record<"lat" | "lon" | "personas" | "nota" | "animales" | "fotos", string>>;

const numero = (t: string): number => Number(t.trim().replace(",", "."));

/** Valida el formulario del cierre. Devuelve el cuerpo listo para enviar o los errores por campo. */
export function validarCierre(f: { lat: string; lon: string; centro: string; personas: string; animales: Record<string, string>; nota: string; fotos: number }): { cuerpo: CierreEvacuacion } | { errores: Errores } {
  const errores: Errores = {};
  const lat = numero(f.lat);
  const lon = numero(f.lon);
  if (f.lat.trim() === "" || !Number.isFinite(lat) || lat < -90 || lat > 90) errores.lat = "Indicá la latitud del destino (entre −90 y 90). Podés usar el botón de ubicación.";
  if (f.lon.trim() === "" || !Number.isFinite(lon) || lon < -180 || lon > 180) errores.lon = "Indicá la longitud del destino (entre −180 y 180).";
  const personas = f.personas.trim() === "" ? 0 : numero(f.personas);
  if (!Number.isInteger(personas) || personas < 0 || personas > 5000) errores.personas = "Las personas trasladadas deben ser un número entre 0 y 5000.";
  const animales: Record<string, number> = {};
  for (const [k, v] of Object.entries(f.animales)) {
    if (v.trim() === "") continue;
    const n = numero(v);
    if (!Number.isInteger(n) || n < 0 || n > 100000) errores.animales = "Las cantidades de animales deben ser números enteros, de 0 a 100000.";
    else if (n > 0) animales[k] = n;
  }
  const nota = f.nota.trim();
  if (nota.length > 1000) errores.nota = "La nota admite hasta 1000 caracteres.";
  else if (!errores.personas && !errores.animales && personas === 0 && Object.keys(animales).length === 0 && !nota) errores.nota = "Si no se trasladaron personas ni animales, explicá qué pasó en la nota.";
  if (f.fotos > MAX_FOTOS) errores.fotos = `Podés subir hasta ${MAX_FOTOS} fotos.`;
  if (Object.keys(errores).length > 0) return { errores };
  return { cuerpo: { lat, lon, ...(f.centro ? { centro_id: Number(f.centro) } : {}), personas_trasladadas: personas, animales_trasladados: animales, ...(nota ? { nota } : {}) } };
}

/**
 * Cierre de una tarea de evacuación con constancia: destino por GPS, centro, personas, animales, nota y fotos.
 * La clave de idempotencia se genera una sola vez por formulario: si el envío se corta y se repite, el servidor
 * reconoce el mismo cierre en vez de duplicarlo. Si alguna foto falla, el cierre ya está hecho y solo se reintentan las fotos.
 */
export function CerrarConConstancia({ tareaId, alTerminar, alCancelar }: { tareaId: number; alTerminar: () => void; alCancelar: () => void }) {
  const clave = useRef<string>("");
  const centros = useCarga(() => api.centros());
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [centro, setCentro] = useState("");
  const [personas, setPersonas] = useState("");
  const [animales, setAnimales] = useState<Record<string, string>>({});
  const [nota, setNota] = useState("");
  const [fotos, setFotos] = useState<File[]>([]);
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);
  const [cerrado, setCerrado] = useState(false);
  const [sinSubir, setSinSubir] = useState<File[]>([]);

  async function subirFotos(lista: File[]) {
    const fallidas: File[] = [];
    for (const f of lista) {
      try {
        await subirFotoCierre(tareaId, f);
      } catch {
        fallidas.push(f);
      }
    }
    setSinSubir(fallidas);
    if (fallidas.length === 0) alTerminar();
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const r = validarCierre({ lat, lon, centro, personas, animales, nota, fotos: fotos.length });
    if ("errores" in r) {
      setErrores(r.errores);
      return;
    }
    setErrores({});
    clave.current ||= crypto.randomUUID();
    setEnviando(true);
    try {
      await api.cerrarConConstancia(tareaId, r.cuerpo, clave.current);
      setCerrado(true);
      await subirFotos(fotos);
    } catch (err) {
      setError(err);
    } finally {
      setEnviando(false);
    }
  }

  if (cerrado) {
    return (
      <Box mt={3} p={3} border="1px solid" borderColor="borde" borderRadius="lg" role="status" data-testid="cierre-hecho">
        <Text fontSize="sm" fontWeight={600}>
          La constancia quedó registrada.
        </Text>
        {sinSubir.length > 0 && (
          <>
            <Alert status="warning" variant="subtle" fontSize="sm" mt={2}>
              <AlertIcon />
              <AlertDescription>
                No se pudieron subir {sinSubir.length} {sinSubir.length === 1 ? "foto" : "fotos"} ({sinSubir.map((f) => f.name).join(", ")}). El cierre ya está guardado; podés reintentar solo las fotos.
              </AlertDescription>
            </Alert>
            <Flex gap={2} mt={2}>
              <Button size="sm" isLoading={enviando} onClick={() => void (async () => { setEnviando(true); await subirFotos(sinSubir); setEnviando(false); })()}>
                Reintentar fotos
              </Button>
              <Button size="sm" variant="outline" onClick={alTerminar}>
                Seguir sin esas fotos
              </Button>
            </Flex>
          </>
        )}
      </Box>
    );
  }

  return (
    <Box as="form" onSubmit={(e: React.FormEvent) => void enviar(e)} noValidate mt={3} p={3} border="1px solid" borderColor="borde" borderRadius="lg" aria-label={`Constancia de la tarea ${tareaId}`}>
      <Heading as="h4" size="sm" mb={1}>
        Cerrar con constancia
      </Heading>
      <Text fontSize="sm" color="textoSuave" mb={3}>
        Registrá dónde quedó la gente o los animales. La ubicación solo la ven los mandos.
      </Text>

      <BotonUbicacion
        primario
        onUbicacion={(lo, la) => {
          setLon(String(lo));
          setLat(String(la));
        }}
      />
      <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3} mt={3}>
        <FormControl isInvalid={!!errores.lat} isRequired>
          <FormLabel htmlFor={`cc-lat-${tareaId}`} fontSize="sm">
            Latitud del destino
          </FormLabel>
          <Input id={`cc-lat-${tareaId}`} size="sm" bg="superficie" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
          <FormErrorMessage>{errores.lat}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errores.lon} isRequired>
          <FormLabel htmlFor={`cc-lon-${tareaId}`} fontSize="sm">
            Longitud del destino
          </FormLabel>
          <Input id={`cc-lon-${tareaId}`} size="sm" bg="superficie" inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} />
          <FormErrorMessage>{errores.lon}</FormErrorMessage>
        </FormControl>
      </SimpleGrid>

      <FormControl mt={3}>
        <FormLabel htmlFor={`cc-centro-${tareaId}`} fontSize="sm">
          Centro de recepción
        </FormLabel>
        <Select id={`cc-centro-${tareaId}`} size="sm" bg="superficie" value={centro} onChange={(e) => setCentro(e.target.value)} placeholder="Sin centro (otro destino)">
          {(centros.datos?.centros ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
        {centros.estado === "error" && <FormHelperText>No se pudo cargar la lista de centros; podés cerrar sin elegir uno.</FormHelperText>}
      </FormControl>

      <FormControl mt={3} isInvalid={!!errores.personas}>
        <FormLabel htmlFor={`cc-personas-${tareaId}`} fontSize="sm">
          Personas trasladadas
        </FormLabel>
        <Input id={`cc-personas-${tareaId}`} size="sm" bg="superficie" inputMode="numeric" w="8rem" value={personas} onChange={(e) => setPersonas(e.target.value)} />
        <FormErrorMessage>{errores.personas}</FormErrorMessage>
      </FormControl>

      <Box as="fieldset" mt={3}>
        <Text as="legend" fontSize="sm" fontWeight={600} mb={1}>
          Animales trasladados
        </Text>
        <Flex gap={3} wrap="wrap">
          {ESPECIES.map(([k, etiqueta]) => (
            <FormControl key={k} w="7.5rem">
              <FormLabel htmlFor={`cc-${k}-${tareaId}`} fontSize="xs" mb={0}>
                {etiqueta}
              </FormLabel>
              <Input id={`cc-${k}-${tareaId}`} size="sm" bg="superficie" inputMode="numeric" value={animales[k] ?? ""} onChange={(e) => setAnimales((a) => ({ ...a, [k]: e.target.value }))} />
            </FormControl>
          ))}
        </Flex>
        {errores.animales && (
          <Text fontSize="sm" color="evacuacion.700" role="alert">
            {errores.animales}
          </Text>
        )}
      </Box>

      <FormControl mt={3} isInvalid={!!errores.nota}>
        <FormLabel htmlFor={`cc-nota-${tareaId}`} fontSize="sm">
          Nota
        </FormLabel>
        <Textarea id={`cc-nota-${tareaId}`} size="sm" bg="superficie" rows={3} maxLength={1000} value={nota} onChange={(e) => setNota(e.target.value)} />
        <FormErrorMessage>{errores.nota}</FormErrorMessage>
      </FormControl>

      <FormControl mt={3} isInvalid={!!errores.fotos}>
        <FormLabel htmlFor={`cc-fotos-${tareaId}`} fontSize="sm">
          Fotos (hasta {MAX_FOTOS})
        </FormLabel>
        <Input id={`cc-fotos-${tareaId}`} type="file" accept={TIPOS_FOTO} multiple size="sm" p={1} onChange={(e) => setFotos(Array.from(e.target.files ?? []))} />
        <FormHelperText>Sacá fotos del lugar o del transporte. No fotografíes caras ni menores de edad.</FormHelperText>
        <FormErrorMessage>{errores.fotos}</FormErrorMessage>
      </FormControl>

      {error !== null && (
        <Box mt={3}>
          <AlertaError error={error} />
          <Text fontSize="xs" color="textoSuave" mt={1}>
            Si se cortó la conexión, volvé a enviar: el servidor reconoce el mismo cierre y no lo duplica.
          </Text>
        </Box>
      )}
      <Flex gap={2} mt={4}>
        <Button type="submit" size="sm" isLoading={enviando}>
          Cerrar con constancia
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={alCancelar} isDisabled={enviando}>
          Volver
        </Button>
      </Flex>
    </Box>
  );
}
