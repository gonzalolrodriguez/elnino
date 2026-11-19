import { Redirect, useRouter } from "expo-router";
import { View } from "react-native";

import { EnlaceConexion } from "@/components/EnlaceConexion";
import { Boton, Cargando, Pantalla, Texto, Titulo } from "@/components/ui";
import { useDiseno } from "@/lib/responsive";
import { useSesion } from "@/lib/SesionContext";

export default function Bienvenida() {
  const { estado } = useSesion();
  const router = useRouter();
  const d = useDiseno();

  if (estado.tipo === "cargando") return <Cargando texto="Abriendo la aplicación…" />;
  if (estado.tipo === "autenticado") return <Redirect href="/(app)" />;

  return (
    <Pantalla>
      <View style={{ flex: 1, justifyContent: "center", gap: d.paso * 1.5 }}>
        <View style={{ gap: 10 }}>
          <Titulo>Plataforma de Gestión de Evacuaciones</Titulo>
          <Texto suave>
            Pedí asistencia, recibí alertas de tu sector y consultá tu centro de recepción sugerido.
          </Texto>
        </View>
        <View style={{ gap: 10 }}>
          <Boton titulo="Ingresar" onPress={() => router.push("/login")} />
          <Boton titulo="Registrarme" variante="secundario" onPress={() => router.push("/registro")} />
        </View>
        <Texto suave pequeno>
          Es una herramienta de simulación y planificación. Decidir una evacuación corresponde a las
          autoridades: esta aplicación no reemplaza al 103 ni a Defensa Civil. Los mandos operativos
          ingresan con una cuenta institucional.
        </Texto>
      </View>
      <EnlaceConexion />
    </Pantalla>
  );
}
