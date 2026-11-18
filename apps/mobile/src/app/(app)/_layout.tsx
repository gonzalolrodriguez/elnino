import { Redirect, Tabs } from "expo-router";

import { Cargando } from "@/components/ui";
import { AlertasProvider, useAlertas } from "@/lib/AlertasContext";
import { ColaProvider, useCola } from "@/lib/ColaContext";
import { pestanasPorRol, useSesion, type Pestana } from "@/lib/SesionContext";

const TITULOS: Record<Pestana, string> = {
  asistencia: "Asistencia",
  solicitudes: "Solicitudes",
  alertas: "Alertas",
  sector: "Sector",
  perfil: "Perfil",
  cuadrilla: "Tareas",
};

const TODAS: Pestana[] = ["asistencia", "solicitudes", "alertas", "sector", "perfil", "cuadrilla"];

function Pestanas({ visibles }: { visibles: Pestana[] }) {
  const { noLeidas } = useAlertas();
  const { pendientes } = useCola();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: "#7c2d12" }}>
      <Tabs.Screen name="index" options={{ href: null }} />
      {TODAS.map((p) => (
        <Tabs.Screen
          key={p}
          name={p}
          options={{
            title: TITULOS[p],
            // Una pestaña fuera de `visibles` no existe para ese rol (p. ej. cuadrilla).
            href: visibles.includes(p) ? undefined : null,
            tabBarBadge:
              p === "alertas" && noLeidas > 0
                ? noLeidas
                : p === "solicitudes" && pendientes > 0
                  ? pendientes
                  : undefined,
          }}
        />
      ))}
    </Tabs>
  );
}

export default function LayoutApp() {
  const { estado } = useSesion();
  if (estado.tipo === "cargando") return <Cargando texto="Abriendo la sesión…" />;
  if (estado.tipo === "anonimo") return <Redirect href="/" />;
  return (
    <ColaProvider>
      <AlertasProvider>
        <Pestanas visibles={pestanasPorRol(estado.usuario.rol)} />
      </AlertasProvider>
    </ColaProvider>
  );
}
