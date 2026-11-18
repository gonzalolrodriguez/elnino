import { Alert, AlertIcon, Box, Button, FormControl, FormErrorMessage, FormLabel, Heading, IconButton, Input, Link, Select, Text, VStack } from "@chakra-ui/react";
import { useState, type FormEvent } from "react";
import { Link as RouterLink } from "react-router-dom";

import { AlertaError, Campo, Consentimiento } from "../components/Formulario";
import { Insignia } from "../components/Insignia";
import { AvisoFueraDeFormosa, BotonUbicacion } from "../components/BotonUbicacion";
import { Layout } from "../components/Layout";
import { TarjetaFormulario } from "../components/TarjetaFormulario";
import { sectorDe } from "../datos/kit";
import { MapaSectores } from "../informacion/MapaSectores";
import { solicitar } from "../lib/api";
import { coordenadaATexto, decimal, enfocarPrimerError, enRango, entero, validarAcceso, validarCoordenadas, type Errores } from "../lib/validacion";

type Creado = { id: number; email: string };
type Fila = { clave: number; especie: string; categoria_animal: string; cantidad: string };

const ESPECIES = ["bovino", "ovino", "caprino", "porcino", "equino", "colmenas"];
const EJEMPLO = { lon: "-58,139", lat: "-26,18" }; // dentro del sector S4 (K10)

let contador = 0;
const nuevaFila = (): Fila => ({ clave: ++contador, especie: "bovino", categoria_animal: "", cantidad: "" });

export default function RegistroProductor() {
  const [v, setV] = useState({ email: "", password: "", nombre_visible: "", nombre: "", renspa: "", lon: "", lat: "" });
  const [filas, setFilas] = useState<Fila[]>([]);
  const [consentimiento, setConsentimiento] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  const [enviando, setEnviando] = useState(false);
  const [errorApi, setErrorApi] = useState<unknown>(null);
  const [creado, setCreado] = useState<Creado | null>(null);

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  const lon = decimal(v.lon);
  const lat = decimal(v.lat);
  const puntoValido = lon !== null && lat !== null && !Number.isNaN(lon) && !Number.isNaN(lat);
  const sector = puntoValido ? sectorDe(lon, lat) : null;

  const cambiarFila = (clave: number, campo: keyof Fila, valor: string) =>
    setFilas(filas.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f)));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErrorApi(null);
    const err: Errores = { ...validarAcceso({ ...v, consentimiento }) };
    const n = v.nombre.trim().length;
    if (n < 2 || n > 160) err.nombre = "El nombre del establecimiento debe tener entre 2 y 160 caracteres.";
    if (v.renspa.length > 30) err.renspa = "Máximo 30 caracteres.";
    Object.assign(err, validarCoordenadas(v.lon, v.lat, true));
    filas.forEach((f) => {
      const cant = entero(f.cantidad);
      if (f.categoria_animal.trim().length < 2 || f.categoria_animal.trim().length > 60) err[`cat-${f.clave}`] = "Indicá la categoría (2 a 60 caracteres).";
      if (!enRango(cant, 0, 100000)) err[`cant-${f.clave}`] = "Cantidad entre 0 y 100000.";
    });
    setErrores(err);
    if (Object.keys(err).length) {
      enfocarPrimerError();
      return;
    }

    const cuerpo = {
      email: v.email.trim(),
      password: v.password,
      nombre_visible: v.nombre_visible.trim(),
      consentimiento: true,
      establecimiento: {
        nombre: v.nombre.trim(),
        renspa: v.renspa.trim() || null,
        lon,
        lat,
        stock: filas.map((f) => ({
          especie: f.especie,
          categoria_animal: f.categoria_animal.trim(),
          cantidad: entero(f.cantidad),
        })),
      },
    };
    setEnviando(true);
    try {
      setCreado(await solicitar<Creado>("/auth/registro/productor", { cuerpo }));
    } catch (x) {
      setErrorApi(x);
    } finally {
      setEnviando(false);
    }
  }

  if (creado) {
    return (
      <Layout titulo="Registro de productores">
        <Alert status="success" alignItems="flex-start" role="status">
          <AlertIcon />
          <Box>
            <Heading as="h1" size="md">
              Registro creado
            </Heading>
            <Text mt={2}>
              Tu cuenta {creado.email} y tu establecimiento quedaron registrados{sector ? ` en el sector ${sector.id} (SIMULADO)` : ""}.
            </Text>
            <Button as={RouterLink} to="/login" mt={4} size="sm">
              Ingresar
            </Button>
          </Box>
        </Alert>
      </Layout>
    );
  }

  return (
    <Layout titulo="Registro de productores">
      <Heading as="h1" size="xl" mb={2}>
        Registro de productores
      </Heading>
      <Text mb={6} maxW="40rem">
        Declará tu establecimiento y tu hacienda para que el traslado de animales se planifique antes de que los caminos se saturen.
        Plataforma prototipo: usá datos de prueba.
      </Text>
      <form onSubmit={enviar} noValidate aria-label="Registro de productor">
        <Box display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", lg: "minmax(0, 32rem) minmax(0, 1fr)" }} gap={10} alignItems="start">
          <TarjetaFormulario maxW="none">
          <VStack spacing={4} align="stretch">
            <AlertaError error={errorApi} />
            <Campo id="nombre_visible" etiqueta="Nombre para mostrar" value={v.nombre_visible} onChange={set("nombre_visible")} error={errores.nombre_visible} isRequired />
            <Campo id="email" etiqueta="Correo electrónico" type="email" value={v.email} onChange={set("email")} error={errores.email} autoComplete="email" isRequired />
            <Campo id="password" etiqueta="Contraseña" type="password" value={v.password} onChange={set("password")} error={errores.password} ayuda="Al menos 10 caracteres." autoComplete="new-password" isRequired />
            <Heading as="h2" size="sm" pt={2}>
              Establecimiento
            </Heading>
            <Campo id="nombre" etiqueta="Nombre del establecimiento" value={v.nombre} onChange={set("nombre")} error={errores.nombre} isRequired />
            <Campo id="renspa" etiqueta="RENSPA (opcional)" value={v.renspa} onChange={set("renspa")} error={errores.renspa} />
            <Heading as="h3" size="xs">
              Ubicación de la tranquera
            </Heading>
            <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={4}>
              <Campo id="lat" etiqueta="Latitud" inputMode="decimal" value={v.lat} onChange={set("lat")} error={errores.lat} placeholder="-26,18" />
              <Campo id="lon" etiqueta="Longitud" inputMode="decimal" value={v.lon} onChange={set("lon")} error={errores.lon} placeholder="-58,139" />
            </Box>
            <BotonUbicacion onUbicacion={(lo, la) => setV((x) => ({ ...x, lon: coordenadaATexto(lo), lat: coordenadaATexto(la) }))} />
            <AvisoFueraDeFormosa lon={puntoValido ? lon : null} lat={puntoValido ? lat : null} />
            <Box>
              <Button size="xs" variant="outline" type="button" onClick={() => setV({ ...v, ...EJEMPLO })}>
                Usar el ejemplo del sector S4
              </Button>
              <Text fontSize="sm" mt={2} role="status">
                {puntoValido
                  ? sector
                    ? `Cae en el sector ${sector.id} · ${sector.nombre} (SIMULADO).`
                    : "El punto no cae dentro de ningún sector K10."
                  : "Ingresá las coordenadas o hacé clic en el mapa."}
              </Text>
            </Box>

            <Heading as="h2" size="sm" pt={2}>
              Hacienda
            </Heading>
            {filas.length === 0 && <Text fontSize="sm">Todavía no cargaste hacienda. Podés agregarla ahora o más tarde.</Text>}
            {filas.map((f, i) => (
              <Box key={f.clave} display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr) minmax(0, 1fr)", md: "8rem minmax(0, 1fr) 6rem auto" }} gap={2} alignItems="end">
                <FormControl>
                  <FormLabel htmlFor={`esp-${f.clave}`} fontSize="xs">
                    Especie {i + 1}
                  </FormLabel>
                  <Select id={`esp-${f.clave}`} bg="superficie" value={f.especie} onChange={(e) => cambiarFila(f.clave, "especie", e.target.value)}>
                    {ESPECIES.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl isInvalid={!!errores[`cat-${f.clave}`]}>
                  <FormLabel htmlFor={`cat-${f.clave}`} fontSize="xs">
                    Categoría
                  </FormLabel>
                  <Input id={`cat-${f.clave}`} bg="superficie" list="categorias" value={f.categoria_animal} onChange={(e) => cambiarFila(f.clave, "categoria_animal", e.target.value)} />
                  <FormErrorMessage>{errores[`cat-${f.clave}`]}</FormErrorMessage>
                </FormControl>
                <FormControl isInvalid={!!errores[`cant-${f.clave}`]}>
                  <FormLabel htmlFor={`cant-${f.clave}`} fontSize="xs">
                    Cantidad
                  </FormLabel>
                  <Input id={`cant-${f.clave}`} bg="superficie" inputMode="numeric" value={f.cantidad} onChange={(e) => cambiarFila(f.clave, "cantidad", e.target.value)} />
                  <FormErrorMessage>{errores[`cant-${f.clave}`]}</FormErrorMessage>
                </FormControl>
                <IconButton aria-label={`Quitar hacienda ${i + 1}`} icon={<span aria-hidden="true">×</span>} variant="outline" onClick={() => setFilas(filas.filter((x) => x.clave !== f.clave))} />
              </Box>
            ))}
            <datalist id="categorias">
              {["vaca con cría", "vaca preñada", "ternero", "vaquillona", "toro"].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <Box>
              <Button size="sm" variant="outline" type="button" onClick={() => setFilas([...filas, nuevaFila()])}>
                Agregar hacienda
              </Button>
            </Box>

            <Consentimiento marcado={consentimiento} onChange={setConsentimiento} error={errores.consentimiento} />
            <Button type="submit" isLoading={enviando} loadingText="Registrando">
              Crear cuenta y registrar establecimiento
            </Button>
            <Text fontSize="sm">
              ¿Ya tenés cuenta?{" "}
              <Link as={RouterLink} to="/login">
                Ingresá
              </Link>
              .
            </Text>
          </VStack>
          </TarjetaFormulario>

          <Box position={{ lg: "sticky" }} top={{ lg: "7rem" }}>
            <Box display="flex" gap={2} alignItems="center" mb={2}>
              <Heading as="h2" size="sm">
                Elegir en el mapa
              </Heading>
              <Insignia categoria="SIMULADO" />
            </Box>
            <MapaSectores
              marcador={puntoValido ? { lon, lat } : null}
              onElegir={(lo, la) => setV({ ...v, lon: coordenadaATexto(lo), lat: coordenadaATexto(la) })}
            />
            <Text fontSize="xs" mt={2}>
              Los sectores son de K10, simulados. El mapa solo sirve para elegir la ubicación de la tranquera.
            </Text>
          </Box>
        </Box>
      </form>
    </Layout>
  );
}
