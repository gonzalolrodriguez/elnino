import { Box, Button, Link, Text, VStack } from "@chakra-ui/react";
import { useState, type FormEvent } from "react";
import { Link as RouterLink, Navigate, useLocation, useNavigate } from "react-router-dom";

import { rutaInicio, useAuth } from "../auth/AuthContext";
import { AlertaError, Campo } from "../components/Formulario";
import { Layout } from "../components/Layout";
import { BloqueApoyo, PaginaFormulario } from "../components/PaginaFormulario";
import { TarjetaFormulario } from "../components/TarjetaFormulario";

export default function Login() {
  const { iniciarSesion, estado, usuario } = useAuth();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const desde = (ubicacion.state as { desde?: string } | null)?.desde;

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
        anchoFormulario="28rem"
        aside={
          <>
            <BloqueApoyo titulo="Qué encontrás adentro">
              <Box as="dl" m={0} fontSize="sm">
                <Text as="dt" fontWeight={700}>Ciudadanía</Text>
                <Text as="dd" m={0} mb={2}>Tu sector, tus alertas y el centro de recepción que te corresponde.</Text>
                <Text as="dt" fontWeight={700}>Productores</Text>
                <Text as="dd" m={0} mb={2}>Tu establecimiento y tu hacienda declarada, para planificar el traslado.</Text>
                <Text as="dt" fontWeight={700}>Cuentas institucionales</Text>
                <Text as="dd" m={0}>Panel operativo o tareas de cuadrilla. Las crea el administrador: no hay autorregistro.</Text>
              </Box>
            </BloqueApoyo>
            <BloqueApoyo titulo="Si no podés ingresar">
              <Text fontSize="sm">
                Después de varios intentos fallidos el acceso se bloquea un tiempo. Revisá el correo y la contraseña, y volvé a intentar
                más tarde.
              </Text>
            </BloqueApoyo>
          </>
        }
      >
        <TarjetaFormulario maxW="none">
        <form onSubmit={enviar} noValidate aria-label="Ingreso">
          <VStack spacing={4} align="stretch">
            <AlertaError error={error} />
            <Campo id="email" etiqueta="Correo electrónico" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errores.email} autoComplete="username" />
            <Campo id="password" etiqueta="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} error={errores.password} autoComplete="current-password" />
            <Button type="submit" isLoading={enviando} loadingText="Ingresando">
              Ingresar
            </Button>
            <Text fontSize="sm">
              ¿No tenés cuenta? Registrate como{" "}
              <Link as={RouterLink} to="/registro/ciudadania">
                ciudadanía
              </Link>{" "}
              o como{" "}
              <Link as={RouterLink} to="/registro/productor">
                productor
              </Link>
              . Las cuentas institucionales las crea el administrador.
            </Text>
          </VStack>
        </form>
        </TarjetaFormulario>
      </PaginaFormulario>
    </Layout>
  );
}
