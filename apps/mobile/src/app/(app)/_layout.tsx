import { Redirect, Tabs } from "expo-router";

import { Icono, type NombreIcono } from "@/components/Icono";
import { COLOR } from "@/components/tema";
import { Cargando, EnPestanasContext } from "@/components/ui";
import { AlertasProvider, useAlertas } from "@/lib/AlertasContext";
import { ColaProvider, useCola } from "@/lib/ColaContext";
import { fuenteAcotada, useDiseno } from "@/lib/responsive";
import { pestanasPorRol, useSesion, type Pestana } from "@/lib/SesionContext";

const TITULOS: Record<Pestana, string> = {
  asistencia: "Asistencia",
  solicitudes: "Pedidos",
  alertas: "Alertas",
  sector: "Sector",
  perfil: "Perfil",
  cuadrilla: "Tareas",
  monitor: "Monitor",
};

/** Ícono de cada pestaña (los de la web: bandeja, campana, punto…); el nombre siempre va escrito debajo. */
const ICONOS: Record<Pestana, NombreIcono> = {
  asistencia: "personas",
  solicitudes: "bandeja",
  alertas: "campana",
  sector: "punto",
  perfil: "persona",
  cuadrilla: "tarea",
  monitor: "gota",
};

const TODAS: Pestana[] = ["asistencia", "solicitudes", "alertas", "sector", "perfil", "cuadrilla", "monitor"];

function Pestanas({ visibles }: { visibles: Pestana[] }) {
  const { noLeidas } = useAlertas();
  const { pendientes } = useCola();
  const d = useDiseno();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLOR.primario,
        tabBarInactiveTintColor: COLOR.suave,
        tabBarStyle: { backgroundColor: COLOR.superficie, borderTopColor: COLOR.borde, elevation: 0 },
        // La barra tiene alto fijo: su etiqueta sigue la fuente del sistema solo hasta 1,3x para no
        // recortarse; el resto de la app escala sin tope.
        tabBarAllowFontScaling: false,
        tabBarLabelStyle: { fontSize: fuenteAcotada(11, d.fontScale, 1.3) },
        tabBarItemStyle: { minHeight: 48 },
        tabBarBadgeStyle: { backgroundColor: COLOR.error, color: COLOR.papel, fontWeight: "700" },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      {TODAS.map((p) => (
        <Tabs.Screen
          key={p}
          name={p}
          options={{
            title: TITULOS[p],
            tabBarIcon: ({ color }) => <Icono nombre={ICONOS[p]} tam={22} color={String(color)} />,
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
        <EnPestanasContext.Provider value>
          <Pestanas visibles={pestanasPorRol(estado.usuario.rol)} />
        </EnPestanasContext.Provider>
      </AlertasProvider>
    </ColaProvider>
  );
}
