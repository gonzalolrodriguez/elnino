import { Box, Button, Heading, Link, Text, VStack } from "@chakra-ui/react";
import { useState, type FormEvent } from "react";
import { Link as RouterLink, Navigate, useLocation, useNavigate } from "react-router-dom";

import { rutaInicio, useAuth } from "../auth/AuthContext";
import { rutaInterna } from "../auth/rutaInterna";
import { AlertaError, Campo } from "../components/Formulario";
import { Layout } from "../components/Layout";
import { Plegable } from "../components/Plegable";
import { BloqueApoyo, PaginaFormulario } from "../components/PaginaFormulario";
import { TarjetaFormulario } from "../components/TarjetaFormulario";

export default function Login() {
  const { iniciarSesion, estado, usuario } = useAuth();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const desde = rutaInterna((ubicacion.state as { desde?: unknown } | null)?.desde);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);

  if (estado === "autenticado" && usuario) return <Navigate to={desde ?? rutaInicio(usuario.rol)} replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const err: Record<string, string> = {};
    if (!email.trim()) err.email = "Ingresá tu correo electrónico.";
    if (!password) err.password = "Ingresá tu contraseña.";
    setErrores(err);
    if (Object.keys(err).length) return;
    setEnviando(true);
    try {
      const u = await iniciarSesion(email, password);
      navegar(desde ?? rutaInicio(u.rol), { replace: true });
    } catch (x) {
      setError(x);
      setEnviando(false);
    }
  }

  return (
    <Layout titulo="Ingresar">
      <PaginaFormulario
        titulo="Ingresar"
        intro="Para ciudadanía, productores y cuentas institucionales."
        anchoFormulario="26rem"
        aside={
          <>
            <BloqueApoyo titulo="Qué encontrás adentro">
              <Box as="dl" m={0}>
                <Text as="dt" fontWeight={600}>Ciudadanía</Text>
                <Text as="dd" m={0} mb={3} color="textoSuave">Tu sector, tus alertas y el centro de recepción que te corresponde.</Text>
                <Text as="dt" fontWeight={600}>Productores</Text>
                <Text as="dd" m={0} mb={3} color="textoSuave">Tu establecimiento y tu hacienda declarada, para planificar el traslado.</Text>
                <Text as="dt" fontWeight={600}>Cuentas institucionales</Text>
                <Text as="dd" m={0} color="textoSuave">Panel operativo o tareas de cuadrilla. Las crea el administrador: no hay autorregistro.</Text>
              </Box>
            </BloqueApoyo>
            <Box borderTop="1px solid" borderColor="borde" pt={1}>
              <Plegable titulo={<Heading as="h2" size="bloque">Si no podés ingresar</Heading>}>
                <Text pb={2} color="textoSuave">
                  Después de varios intentos fallidos el acceso se bloquea un tiempo. Revisá el correo y la contraseña, y volvé a intentar
                  más tarde.
                </Text>
              </Plegable>
            </Box>
          </>
        }
      >
        <TarjetaFormulario maxW="none">
        <form onSubmit={enviar} noValidate aria-label="Ingreso">
          <VStack spacing={4} align="stretch">
            <AlertaError error={error} />
            <Campo id="email" etiqueta="Correo electrónico" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errores.email} autoComplete="username" />
            <Campo id="password" etiqueta="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} error={errores.password} autoComplete="current-password" />
            <Button type="submit" isLoading={enviando} loadingText="Ingresando" w={{ base: "100%", sm: "auto" }} alignSelf="flex-start" minW="10rem">
              Ingresar
            </Button>
            <Box borderTop="1px solid" borderColor="borde" pt={4}>
              <Text fontWeight={600}>¿No tenés cuenta?</Text>
              <Text mt={1} color="textoSuave">
                Registrate como{" "}
                <Link as={RouterLink} to="/registro/ciudadania">
                  ciudadanía
                </Link>{" "}
                o como{" "}
                <Link as={RouterLink} to="/registro/productor">
                  productor
                </Link>
                . Las cuentas institucionales las crea el administrador.
              </Text>
            </Box>
          </VStack>
        </form>
        </TarjetaFormulario>
      </PaginaFormulario>
    </Layout>
  );
}
