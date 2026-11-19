import { Badge, Box, Button, Flex, Heading, Link, SimpleGrid, Text, VStack } from "@chakra-ui/react";
import { useState, type FormEvent } from "react";
import { Link as RouterLink, Navigate, useLocation, useNavigate } from "react-router-dom";

import { rutaInicio, useAuth } from "../auth/AuthContext";
import { AlertaError, Campo } from "../components/Formulario";
import { Insignia } from "../components/Insignia";
import { Layout } from "../components/Layout";
import { Plegable } from "../components/Plegable";
import { BloqueApoyo, PaginaFormulario } from "../components/PaginaFormulario";
import { TarjetaFormulario } from "../components/TarjetaFormulario";

const CUENTAS_DEMO = [
  {
    rol: "Decisor (Comité K8)",
    email: "decisor@demo.evacuaciones.invalid",
    alcance: "Tablero de decisión, simulador, órdenes y firma de Bitácora K8",
  },
  {
    rol: "Operador (Sala)",
    email: "operador@demo.evacuaciones.invalid",
    alcance: "Simulador Ventana Seca, bloqueo de caminos, lluvia y Producción",
  },
  {
    rol: "Productor S4",
    email: "productor1@demo.evacuaciones.invalid",
    alcance: "Tranquera Digital en Sector S4 Rural Este, hacienda y alertas",
  },
  {
    rol: "Cuadrilla",
    email: "cuadrilla@demo.evacuaciones.invalid",
    alcance: "Tareas de campo asignadas, cierre con constancia y avisos en vivo",
  },
  {
    rol: "Ciudadanía",
    email: "ciudadano1@demo.evacuaciones.invalid",
    alcance: "Estado del sector, confirmación de traslado y pedidos de ayuda",
  },
  {
    rol: "Administrador",
    email: "admin@demo.evacuaciones.invalid",
    alcance: "Tablero de administración, cuentas institucionales y estado del backend",
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
      <PaginaFormulario
        titulo="Ingresar"
        intro="Para ciudadanía, productores y cuentas institucionales."
        anchoFormulario="28rem"
        aside={
          <>
            <Box layerStyle="tarjeta" p={{ base: 4, md: 5 }} mb={4}>
              <Flex justify="space-between" align="center" wrap="wrap" gap={2} mb={2}>
                <Heading as="h2" size="sm">
                  Perfiles de demostración (guion de 3 minutos)
                </Heading>
                <Insignia categoria="SIMULADO" />
              </Flex>
              <Text fontSize="xs" color="textoSuave" mb={3}>
                Pulsá un perfil para cargar su correo ficticio (<code>@demo.evacuaciones.invalid</code>).
              </Text>
              <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={2.5}>
                {CUENTAS_DEMO.map((c) => {
                  const seleccionado = email === c.email;
                  return (
                    <Box
                      key={c.email}
                      border="1px solid"
                      borderColor={seleccionado ? "primario" : "borde"}
                      bg={seleccionado ? "suave" : "superficie"}
                      borderRadius="lg"
                      p={2.5}
                      display="flex"
                      flexDirection="column"
                      justifyContent="space-between"
                      gap={1.5}
                    >
                      <Box>
                        <Flex justify="space-between" align="center" gap={1} mb={0.5}>
                          <Text fontWeight={700} fontSize="xs">
                            {c.rol}
                          </Text>
                          {seleccionado && <Badge colorScheme="teal" fontSize="2xs">Activo</Badge>}
                        </Flex>
                        <Text fontSize="2xs" fontFamily="mono" color="textoSuave" mb={0.5}>
                          {c.email}
                        </Text>
                        <Text fontSize="2xs" color="textoSuave">
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
                        Cargar {c.rol.split(" ")[0]}
                      </Button>
                    </Box>
                  );
                })}
              </SimpleGrid>
            </Box>
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
            <Box borderTop="1px solid" borderColor="borde" pt={1}>
              <Plegable titulo={<Heading as="h2" size="sm">Si no podés ingresar</Heading>}>
                <Text fontSize="sm" pb={2}>
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
