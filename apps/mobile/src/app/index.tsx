import { Redirect, useRouter } from "expo-router";
import { View } from "react-native";

import { ConfigServidor } from "@/components/ConfigServidor";
import { EstadoBackend } from "@/components/EstadoBackend";
import { Boton, Cargando, Pantalla, Texto, Titulo } from "@/components/ui";
import { useSesion } from "@/lib/SesionContext";

export default function Bienvenida() {
  const { estado } = useSesion();
  const router = useRouter();

  if (estado.tipo === "cargando") return <Cargando texto="Abriendo la aplicación…" />;
  if (estado.tipo === "autenticado") return <Redirect href="/(app)" />;

  return (
    <Pantalla>
      <Titulo>Plataforma de Gestión de Evacuaciones</Titulo>
      <Texto>
        Equipo 3 · Instituto Politécnico Formosa. Pedí asistencia, recibí alertas y órdenes de tu
        sector y consultá tu centro de recepción sugerido.
      </Texto>
      <Texto suave>
        Es una herramienta de simulación y planificación. Decidir una evacuación corresponde a las
        autoridades; esta aplicación no reemplaza al 103 ni a Defensa Civil.
      </Texto>
      <View style={{ gap: 10 }}>
        <Boton titulo="Ingresar" onPress={() => router.push("/login")} />
        <Boton
          titulo="Registrarme como ciudadano o productor"
          variante="secundario"
          onPress={() => router.push("/registro")}
        />
      </View>
      <EstadoBackend />
      <ConfigServidor />
      <Texto suave pequeno>
        Los mandos operativos ingresan con una cuenta institucional creada por el administrador.
      </Texto>
    </Pantalla>
  );
}
