import { Badge, Box, Button, Flex, Heading, Link, SimpleGrid, Text, VStack } from "@chakra-ui/react";
import { useState, type FormEvent } from "react";
import { Link as RouterLink, Navigate, useLocation, useNavigate } from "react-router-dom";

import { rutaInicio, useAuth } from "../auth/AuthContext";
import { AlertaError, Campo } from "../components/Formulario";
import { Insignia } from "../components/Insignia";
import { Layout } from "../components/Layout";
import { TarjetaFormulario } from "../components/TarjetaFormulario";

const CUENTAS_DEMO = [
  {
    rol: "Decisor (Comité K8)",
    email: "decisor@demo.evacuaciones.invalid",
    alcance: "Monitor, simulador, órdenes de evacuación y firma de Bitácora K8",
  },
  {
    rol: "Operador (Sala)",
    email: "operador@demo.evacuaciones.invalid",
    alcance: "Simulador Ventana Seca, bloqueo de caminos, lluvia y Arca Productiva",
  },
  {
    rol: "Productor S4",
    email: "productor1@demo.evacuaciones.invalid",
    alcance: "Tranquera Digital en Sector S4 Rural Este, hacienda y alertas",
  },
  {
    rol: "Cuadrilla",
    email: "cuadrilla@demo.evacuaciones.invalid",
    alcance: "Tareas de campo asignadas, checklists sanitarios y avisos en vivo",
  },
  {
    rol: "Ciudadanía",
    email: "ciudadano1@demo.evacuaciones.invalid",
    alcance: "Grupo familiar, sector asignado y notificaciones recibidas",
  },
  {
    rol: "Administrador",
    email: "admin@demo.evacuaciones.invalid",
    alcance: "Gestión de cuentas institucionales y catálogo de roles operativos",
  },
] as const;

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
      <Heading as="h1" size="xl" mb={2}>
        Ingresar
      </Heading>
      <Text mb={6} maxW="42rem">
        Para ciudadanía, productores y cuentas institucionales. Durante la demostración podés autocompletar cualquiera de los perfiles de prueba con un clic.
      </Text>

      <Box display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", lg: "minmax(0, 28rem) minmax(0, 1fr)" }} gap={8} alignItems="start">
        <TarjetaFormulario maxW="28rem">
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

        <Box bg="superficie" border="1px solid" borderColor="borde" borderTop="3px solid" borderTopColor="pizarra.700" borderRadius="sm" p={{ base: 4, md: 6 }}>
          <Flex justify="space-between" align="center" wrap="wrap" gap={2} mb={3}>
            <Heading as="h2" size="sm">
              Perfiles de demostración (guion de 3 minutos)
            </Heading>
            <Insignia categoria="SIMULADO" />
          </Flex>
          <Text fontSize="sm" color="textoSuave" mb={4}>
            Pulsá un perfil para cargar su correo ficticio (<code>@demo.evacuaciones.invalid</code>). La contraseña de demostración se define en <code>DEMO_PASSWORD</code> del archivo <code>.env</code>.
          </Text>
          <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
            {CUENTAS_DEMO.map((c) => {
              const seleccionado = email === c.email;
              return (
                <Box
                  key={c.email}
                  border="1px solid"
                  borderColor={seleccionado ? "primario" : "borde"}
                  bg={seleccionado ? "pizarra.100" : "superficie"}
                  borderRadius="sm"
                  p={3}
                  display="flex"
                  flexDirection="column"
                  justifyContent="space-between"
                  gap={2}
                >
                  <Box>
                    <Flex justify="space-between" align="center" gap={2} mb={1}>
                      <Text fontWeight={700} fontSize="sm">
                        {c.rol}
                      </Text>
                      {seleccionado && <Badge colorScheme="teal">Seleccionado</Badge>}
                    </Flex>
                    <Text fontSize="xs" fontFamily="mono" color="pizarra.700" mb={1}>
                      {c.email}
                    </Text>
                    <Text fontSize="xs" color="textoSuave">
                      {c.alcance}
                    </Text>
                  </Box>
                  <Button
                    size="xs"
                    variant={seleccionado ? "solid" : "outline"}
                    type="button"
                    onClick={() => {
                      setEmail(c.email);
                      setErrores({});
                    }}
                  >
                    Usar correo de {c.rol.split(" ")[0]}
                  </Button>
                </Box>
              );
            })}
          </SimpleGrid>
        </Box>
      </Box>
    </Layout>
  );
}
