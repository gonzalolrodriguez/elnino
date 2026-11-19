import { Alert, AlertIcon, Box, Button, Heading, Link, Text, VStack } from "@chakra-ui/react";
import { useState, type FormEvent } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import { rutaInicio, useAuth } from "../auth/AuthContext";

import { AlertaError, Campo, Consentimiento } from "../components/Formulario";
import { AvisoFueraDeFormosa, BotonUbicacion } from "../components/BotonUbicacion";
import { Layout } from "../components/Layout";
import { Plegable } from "../components/Plegable";
import { BloqueApoyo, PaginaFormulario, ResumenSectores } from "../components/PaginaFormulario";
import { TarjetaFormulario } from "../components/TarjetaFormulario";
import { sectorDe } from "../datos/kit";
import { solicitar } from "../lib/api";
import { coordenadaATexto, decimal, enfocarPrimerError, enRango, entero, validarAcceso, validarCoordenadas, type Errores } from "../lib/validacion";

type Creado = { id: number; email: string; nombre_visible: string; rol: string };

export default function RegistroCiudadano() {
  const { iniciarSesion } = useAuth();
  const navigate = useNavigate();
  const [v, setV] = useState({
    email: "",
    password: "",
    nombre_visible: "",
    integrantes: "1",
    menores: "0",
    mayores: "0",
    mascotas: "0",
    telefono: "",
    lon: "",
    lat: "",
  });
  const [consentimiento, setConsentimiento] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  const [enviando, setEnviando] = useState(false);
  const [errorApi, setErrorApi] = useState<unknown>(null);
  const [creado, setCreado] = useState<Creado | null>(null);

  const lon = decimal(v.lon);
  const lat = decimal(v.lat);
  const puntoValido = lon !== null && lat !== null && !Number.isNaN(lon) && !Number.isNaN(lat);
  const sector = puntoValido ? sectorDe(lon, lat) : null;

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErrorApi(null);
    const err: Errores = { ...validarAcceso({ ...v, consentimiento }) };
    const integrantes = entero(v.integrantes);
    const menores = entero(v.menores);
    const mayores = entero(v.mayores);
    const mascotas = entero(v.mascotas);
    if (!enRango(integrantes, 1, 40)) err.integrantes = "Entre 1 y 40 integrantes.";
    if (!enRango(menores, 0, 40)) err.menores = "Entre 0 y 40.";
    if (!enRango(mayores, 0, 40)) err.mayores = "Entre 0 y 40.";
    if (!enRango(mascotas, 0, 100)) err.mascotas = "Entre 0 y 100.";
    if (v.telefono.length > 30) err.telefono = "Máximo 30 caracteres.";
    Object.assign(err, validarCoordenadas(v.lon, v.lat, false));
    if ((v.lon.trim() === "") !== (v.lat.trim() === "")) err.lat = "Completá longitud y latitud, o dejá ambas vacías.";
    setErrores(err);
    if (Object.keys(err).length) {
      enfocarPrimerError();
      return;
    }

    const cuerpo: Record<string, unknown> = {
      email: v.email.trim(),
      password: v.password,
      nombre_visible: v.nombre_visible.trim(),
      consentimiento: true,
      integrantes,
      menores,
      mayores,
      mascotas,
    };
    if (v.telefono.trim()) cuerpo.telefono = v.telefono.trim();
    if (v.lon.trim() && v.lat.trim()) {
      cuerpo.lon = decimal(v.lon);
      cuerpo.lat = decimal(v.lat);
    }
    setEnviando(true);
    try {
      const nuevo = await solicitar<Creado>("/auth/registro/ciudadano", { cuerpo });
      try {
        // Igual que en la app: tras registrarse se inicia sesión sola.
        const u = await iniciarSesion(v.email, v.password);
        navigate(rutaInicio(u.rol), { replace: true });
      } catch {
        setCreado(nuevo);
      }
    } catch (x) {
      setErrorApi(x);
    } finally {
      setEnviando(false);
    }
  }

  if (creado) {
    return (
      <Layout titulo="Registro de ciudadanía">
        <Alert status="success" alignItems="flex-start" role="status">
          <AlertIcon />
          <Box>
            <Heading as="h1" size="md">
              Registro creado
            </Heading>
            <Text mt={2}>
              Tu cuenta {creado.email} ya está activa. Ingresá para completar tu perfil.
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
    <Layout titulo="Registro de ciudadanía">
      <PaginaFormulario
        titulo="Registro de ciudadanía"
        intro="Con tu grupo familiar y tu domicilio podemos ubicarte en un sector, avisarte y organizar tu traslado. Esta es una plataforma prototipo: usá datos de prueba."
        aside={
          <>
            <BloqueApoyo titulo="Para qué usamos tus datos">
              <Box as="ul" m={0} pl={5} fontSize="sm">
                <li>Ubicarte en un sector de evaluación a partir de tu domicilio.</li>
                <li>Avisarte cuando tu sector esté en riesgo o se emita una orden.</li>
                <li>Organizar tu traslado y asignarte un centro de recepción.</li>
              </Box>
            </BloqueApoyo>
            <BloqueApoyo titulo="Tus derechos">
              <Text fontSize="sm">
                Podés pedir el acceso, la rectificación y la supresión de tus datos (Ley 25.326). El teléfono se guarda cifrado y la
                ubicación solo se usa para ubicarte en un sector.
              </Text>
            </BloqueApoyo>
            <ResumenSectores />
          </>
        }
      >
        <TarjetaFormulario maxW="none">
        <form onSubmit={enviar} noValidate aria-label="Registro de ciudadanía">
          <VStack spacing={4} align="stretch">
            <AlertaError error={errorApi} />
            <Campo id="nombre_visible" etiqueta="Nombre para mostrar" value={v.nombre_visible} onChange={set("nombre_visible")} error={errores.nombre_visible} autoComplete="nickname" isRequired />
            <Campo id="email" etiqueta="Correo electrónico" type="email" value={v.email} onChange={set("email")} error={errores.email} autoComplete="email" isRequired />
            <Campo id="password" etiqueta="Contraseña" type="password" value={v.password} onChange={set("password")} error={errores.password} ayuda="Al menos 10 caracteres." autoComplete="new-password" isRequired />
            <Heading as="h2" size="sm" pt={2}>
              Grupo familiar
            </Heading>
            <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={4}>
              <Campo id="integrantes" etiqueta="Integrantes" inputMode="numeric" value={v.integrantes} onChange={set("integrantes")} error={errores.integrantes} />
              <Campo id="mascotas" etiqueta="Mascotas" inputMode="numeric" value={v.mascotas} onChange={set("mascotas")} error={errores.mascotas} />
              <Campo id="menores" etiqueta="Menores" inputMode="numeric" value={v.menores} onChange={set("menores")} error={errores.menores} />
              <Campo id="mayores" etiqueta="Personas mayores" inputMode="numeric" value={v.mayores} onChange={set("mayores")} error={errores.mayores} />
            </Box>
            <Campo id="telefono" etiqueta="Teléfono (opcional)" type="tel" value={v.telefono} onChange={set("telefono")} error={errores.telefono} ayuda="Se guarda cifrado." autoComplete="tel" />
            <Heading as="h2" size="sm" pt={2}>
              Domicilio (opcional)
            </Heading>
            <BotonUbicacion primario onUbicacion={(lo, la) => setV((x) => ({ ...x, lon: coordenadaATexto(lo), lat: coordenadaATexto(la) }))} />
            <Plegable titulo="O escribí las coordenadas a mano" abierto={errores.lat || errores.lon ? true : undefined}>
              <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={4} pb={2}>
                <Campo id="lat" etiqueta="Latitud" inputMode="decimal" value={v.lat} onChange={set("lat")} error={errores.lat} placeholder="-26,183" />
                <Campo id="lon" etiqueta="Longitud" inputMode="decimal" value={v.lon} onChange={set("lon")} error={errores.lon} placeholder="-58,183" />
              </Box>
            </Plegable>
            <AvisoFueraDeFormosa lon={puntoValido ? lon : null} lat={puntoValido ? lat : null} />
            {puntoValido && sector && (
              <Text fontSize="sm" role="status">
                Cae en el sector {sector.id} · {sector.nombre} (SIMULADO).
              </Text>
            )}
            <Consentimiento marcado={consentimiento} onChange={setConsentimiento} error={errores.consentimiento} />
            <Button type="submit" isLoading={enviando} loadingText="Registrando">
              Crear cuenta
            </Button>
            <Text fontSize="sm">
              ¿Tenés cuenta?{" "}
              <Link as={RouterLink} to="/login">
                Ingresá
              </Link>
              . ¿Tenés un establecimiento?{" "}
              <Link as={RouterLink} to="/registro/productor">
                Registrate como productor
              </Link>
              .
            </Text>
          </VStack>
        </form>
        </TarjetaFormulario>
      </PaginaFormulario>
    </Layout>
  );
}
