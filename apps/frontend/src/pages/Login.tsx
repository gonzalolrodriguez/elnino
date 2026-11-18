import { Box, Button, Heading, Link, Text, VStack } from "@chakra-ui/react";
import { useState, type FormEvent } from "react";
import { Link as RouterLink, Navigate, useLocation, useNavigate } from "react-router-dom";

import { rutaInicio, useAuth } from "../auth/AuthContext";
import { AlertaError, Campo } from "../components/Formulario";
import { Layout } from "../components/Layout";

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
    <Layout>
      <Box maxW="26rem">
        <Heading as="h1" size="xl" mb={2}>
          Ingresar
        </Heading>
        <Text mb={6}>Para ciudadanía, productores y cuentas institucionales.</Text>
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
              <Link as={RouterLink} to="/registro/ciudadania" textDecoration="underline">
                ciudadanía
              </Link>{" "}
              o como{" "}
              <Link as={RouterLink} to="/registro/productor" textDecoration="underline">
                productor
              </Link>
              . Las cuentas institucionales las crea el administrador.
            </Text>
          </VStack>
        </form>
      </Box>
    </Layout>
  );
}
