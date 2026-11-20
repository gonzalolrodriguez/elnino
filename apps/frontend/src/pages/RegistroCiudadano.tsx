import { Alert, AlertIcon, Box, Button, Heading, Link, Text, VStack } from "@chakra-ui/react";
import { useState, type FormEvent } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import { rutaInicio, useAuth } from "../auth/AuthContext";

import { AvisoFueraDeFormosa } from "../components/BotonUbicacion";
import { Contador } from "../components/Contador";
import { AlertaError, Campo, Consentimiento, GrupoCampos } from "../components/Formulario";
import { IconoMascota, IconoMayor, IconoMenor, IconoPersonas } from "../components/iconos/Iconos";
import { Layout } from "../components/Layout";
import { BloqueApoyo, PaginaFormulario, ResumenSectores } from "../components/PaginaFormulario";
import { SelectorUbicacion } from "../components/SelectorUbicacion";
import { TarjetaFormulario } from "../components/TarjetaFormulario";
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

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  const poner = (k: keyof typeof v) => (t: string) => setV((x) => ({ ...x, [k]: t }));

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
              <Box as="ul" m={0} pl={5} color="textoSuave">
                <li>Ubicarte en un sector de evaluación a partir de tu domicilio.</li>
                <li>Avisarte cuando tu sector esté en riesgo o se emita una orden.</li>
                <li>Organizar tu traslado y asignarte un centro de recepción.</li>
              </Box>
            </BloqueApoyo>
            <BloqueApoyo titulo="Tus derechos">
              <Text color="textoSuave">
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
            <VStack spacing={8} align="stretch">
              <AlertaError error={errorApi} />
              <GrupoCampos leyenda="Tus datos de acceso">
                <Campo id="nombre_visible" etiqueta="Nombre para mostrar" value={v.nombre_visible} onChange={set("nombre_visible")} error={errores.nombre_visible} autoComplete="nickname" isRequired />
                <Campo id="email" etiqueta="Correo electrónico" type="email" value={v.email} onChange={set("email")} error={errores.email} autoComplete="email" isRequired />
                <Campo id="password" etiqueta="Contraseña" type="password" value={v.password} onChange={set("password")} error={errores.password} ayuda="Al menos 10 caracteres." autoComplete="new-password" isRequired />
              </GrupoCampos>
              <GrupoCampos leyenda="Grupo familiar">
                <Box display="grid" gridTemplateColumns={{ base: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }} gap={4} alignItems="end">
                  <Contador id="integrantes" etiqueta="Integrantes" icono={<IconoPersonas />} min={1} max={40} value={v.integrantes} onChange={poner("integrantes")} error={errores.integrantes} />
                  <Contador id="menores" etiqueta="Menores" icono={<IconoMenor />} max={40} value={v.menores} onChange={poner("menores")} error={errores.menores} />
                  <Contador id="mayores" etiqueta="Personas mayores" icono={<IconoMayor />} max={40} value={v.mayores} onChange={poner("mayores")} error={errores.mayores} />
                  <Contador id="mascotas" etiqueta="Mascotas" icono={<IconoMascota />} max={100} value={v.mascotas} onChange={poner("mascotas")} error={errores.mascotas} />
                </Box>
                <Box maxW="22rem">
                  <Campo id="telefono" etiqueta="Teléfono (opcional)" type="tel" value={v.telefono} onChange={set("telefono")} error={errores.telefono} ayuda="Se guarda cifrado." autoComplete="tel" />
                </Box>
              </GrupoCampos>
              <GrupoCampos leyenda="Domicilio (opcional)" ayuda="Con tu domicilio sabemos en qué sector estás y a qué centro te corresponde ir.">
                <SelectorUbicacion
                  idBase="domicilio"
                  lon={v.lon}
                  lat={v.lat}
                  errorLon={errores.lon}
                  errorLat={errores.lat}
                  onPunto={(lo, la) => setV((x) => ({ ...x, lon: coordenadaATexto(lo), lat: coordenadaATexto(la) }))}
                  onTexto={(campo, valor) => setV((x) => ({ ...x, [campo]: valor }))}
                />
                <AvisoFueraDeFormosa lon={puntoValido ? lon : null} lat={puntoValido ? lat : null} />
              </GrupoCampos>
              <Box display="grid" rowGap={4}>
                <Consentimiento marcado={consentimiento} onChange={setConsentimiento} error={errores.consentimiento} />
                <Button type="submit" isLoading={enviando} loadingText="Registrando" w={{ base: "100%", sm: "auto" }} justifySelf="start">
                  Crear cuenta
                </Button>
                <Text color="textoSuave">
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
              </Box>
            </VStack>
          </form>
        </TarjetaFormulario>
      </PaginaFormulario>
    </Layout>
  );
}
