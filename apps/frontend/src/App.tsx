import { Center, Spinner } from "@chakra-ui/react";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useInRouterContext, useLocation } from "react-router-dom";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { Layout } from "./components/Layout";
import { AuthProvider } from "./auth/AuthContext";
import { RutaProtegida } from "./auth/RutaProtegida";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import { AppMovil } from "./pages/Placeholders";

const Informacion = lazy(() => import("./pages/Informacion"));
const RegistroCiudadano = lazy(() => import("./pages/RegistroCiudadano"));
const RegistroProductor = lazy(() => import("./pages/RegistroProductor"));
const MiCuenta = lazy(() => import("./pages/MiCuenta"));
const Panel = lazy(() => import("./panel/Panel"));
const Cuadrilla = lazy(() => import("./pages/Cuadrilla"));
const Admin = lazy(() => import("./pages/Admin"));

/** `/el-nino` era la ruta anterior de la sección: se conserva como redirección (con su ancla). */
function RedirigirAInformacion() {
  const { hash } = useLocation();
  return <Navigate to={{ pathname: "/informacion", hash }} replace />;
}

function Rutas() {
  const { pathname } = useLocation();
  return (
    <AuthProvider>
      <ErrorBoundary ruta={pathname}>
      <Suspense
        fallback={
          <Layout>
            <Center py={20} role="status" aria-label="Cargando">
              <Spinner />
            </Center>
          </Layout>
        }
      >
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/informacion" element={<Informacion />} />
          <Route path="/el-nino" element={<RedirigirAInformacion />} />
          <Route path="/registro/ciudadania" element={<RegistroCiudadano />} />
          <Route path="/registro/productor" element={<RegistroProductor />} />
          <Route path="/login" element={<Login />} />
          <Route path="/app" element={<AppMovil />} />
          <Route
            path="/mi-cuenta"
            element={
              <RutaProtegida roles={["ciudadano", "productor"]}>
                <MiCuenta />
              </RutaProtegida>
            }
          />
          <Route
            path="/comando/*"
            element={
              <RutaProtegida roles={["operador", "decisor", "admin"]}>
                <Panel />
              </RutaProtegida>
            }
          />
          <Route
            path="/cuadrilla"
            element={
              <RutaProtegida roles={["cuadrilla", "admin"]}>
                <Cuadrilla />
              </RutaProtegida>
            }
          />
          <Route
            path="/admin"
            element={
              <RutaProtegida roles={["admin"]}>
                <Admin />
              </RutaProtegida>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </AuthProvider>
  );
}

/** Usa el router del entorno (pruebas) o crea uno de navegador. */
export default function App() {
  const dentro = useInRouterContext();
  return dentro ? (
    <Rutas />
  ) : (
    <BrowserRouter>
      <Rutas />
    </BrowserRouter>
  );
}
