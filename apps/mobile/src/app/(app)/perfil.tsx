import { Alert } from "react-native";

import { FormEstablecimientos } from "@/components/FormEstablecimientos";
import { FormGrupoFamiliar } from "@/components/FormGrupoFamiliar";
import { Boton, Pantalla, Tarjeta, Texto, Titulo } from "@/components/ui";
import { useCola } from "@/lib/ColaContext";
import { useSesion, useUsuario } from "@/lib/SesionContext";

export default function Perfil() {
  const usuario = useUsuario();
  const { salir } = useSesion();
  const { pendientes, borrarLocal } = useCola();
  const ciudadania = usuario.rol === "ciudadano" || usuario.rol === "productor";

  const cerrar = () => {
    const confirmar = async () => {
      // Borrado local: la cola contiene ubicación y texto de la persona y no debe quedar en el teléfono.
      await borrarLocal();
      await salir();
    };
    if (pendientes > 0) {
      Alert.alert(
        "Solicitudes sin enviar",
        `Tenés ${pendientes} solicitud(es) sin enviar. Si cerrás la sesión se borran de este teléfono.`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Cerrar sesión y borrar", style: "destructive", onPress: () => void confirmar() },
        ],
      );
    } else {
      void confirmar();
    }
  };

  return (
    <Pantalla>
      <Titulo>Perfil</Titulo>
      <Tarjeta>
        <Texto>{usuario.nombre_visible}</Texto>
        <Texto suave>{usuario.email}</Texto>
        <Texto suave>
          Rol: {usuario.rol}
          {usuario.rol_operativo ? ` · ${usuario.rol_operativo}` : ""}
        </Texto>
      </Tarjeta>

      {ciudadania ? <FormGrupoFamiliar /> : null}
      {usuario.rol === "productor" ? <FormEstablecimientos /> : null}
      {!ciudadania && usuario.rol !== "cuadrilla" ? (
        <Texto suave>
          Los mandos operativos trabajan desde el panel web. Esta app solo muestra tus alertas.
        </Texto>
      ) : null}

      <Boton titulo="Cerrar sesión" variante="peligro" onPress={cerrar} />
    </Pantalla>
  );
}
