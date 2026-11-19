import { useState } from "react";
import { Alert } from "react-native";

import { AvisoPanelWeb } from "@/components/AvisoPanelWeb";
import { ConfigServidor } from "@/components/ConfigServidor";
import { FormEstablecimientos } from "@/components/FormEstablecimientos";
import { FormGrupoFamiliar } from "@/components/FormGrupoFamiliar";
import { Boton, Pantalla, Rejilla, Subtitulo, Tarjeta, Texto, Titulo } from "@/components/ui";
import { useCola } from "@/lib/ColaContext";
import { useSesion, useUsuario } from "@/lib/SesionContext";

export default function Perfil() {
  const usuario = useUsuario();
  const { salir, salirLocal } = useSesion();
  const { pendientes, borrarLocal } = useCola();
  const [verConexion, setVerConexion] = useState(false);
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
    <Pantalla dosColumnas>
      <Titulo>Perfil</Titulo>
      <Tarjeta>
        <Subtitulo>{usuario.nombre_visible}</Subtitulo>
        <Texto suave>{usuario.email}</Texto>
        <Texto suave>
          {usuario.rol}
          {usuario.rol_operativo ? ` · ${usuario.rol_operativo}` : ""}
        </Texto>
      </Tarjeta>

      <Rejilla>
        {ciudadania ? <FormGrupoFamiliar /> : null}
        {usuario.rol === "productor" ? <FormEstablecimientos /> : null}
        {verConexion ? (
          <ConfigServidor
            sesion={{ pendientes, descartarPendientes: borrarLocal, cerrarSesionLocal: salirLocal }}
          />
        ) : (
          <Boton titulo="Conexión con el servidor" variante="secundario" onPress={() => setVerConexion(true)} />
        )}
      </Rejilla>
      {!ciudadania && usuario.rol !== "cuadrilla" ? (
        <AvisoPanelWeb />
      ) : null}

      <Boton titulo="Cerrar sesión" variante="peligro" onPress={cerrar} />
    </Pantalla>
  );
}
