import { useState } from "react";
import { Alert, Text, View } from "react-native";

import { AvisoPanelWeb } from "@/components/AvisoPanelWeb";
import { ConfigServidor } from "@/components/ConfigServidor";
import { FormEstablecimientos } from "@/components/FormEstablecimientos";
import { FormGrupoFamiliar } from "@/components/FormGrupoFamiliar";
import { Chip, Chips } from "@/components/Piezas";
import { Boton, COLOR, Pantalla, Rejilla, Subtitulo, Tarjeta, Texto, Titulo } from "@/components/ui";
import { borrarCache } from "@/lib/cacheLocal";
import { useCola } from "@/lib/ColaContext";
import { etiquetaRol, etiquetaRolOperativo } from "@/lib/etiquetas";
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
      await borrarCache();
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: COLOR.primario, alignItems: "center", justifyContent: "center" }}
          >
            <Text maxFontSizeMultiplier={1.2} style={{ color: COLOR.papel, fontSize: 24, fontWeight: "700" }}>
              {(usuario.nombre_visible.trim()[0] ?? "?").toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Subtitulo>{usuario.nombre_visible}</Subtitulo>
            <Texto suave>{usuario.email}</Texto>
          </View>
        </View>
        <Chips>
          <Chip tono="info" icono="persona" texto={etiquetaRol(usuario.rol)} />
          {usuario.rol_operativo ? <Chip icono="escudo" texto={etiquetaRolOperativo(usuario.rol_operativo)} /> : null}
        </Chips>
      </Tarjeta>

      <Rejilla>
        {ciudadania ? <FormGrupoFamiliar /> : null}
        {usuario.rol === "productor" ? <FormEstablecimientos /> : null}
        {verConexion ? (
          <ConfigServidor
            sesion={{ pendientes, descartarPendientes: borrarLocal, cerrarSesionLocal: salirLocal }}
          />
        ) : (
          <Boton titulo="Conexión con el servidor" variante="secundario" icono="info" onPress={() => setVerConexion(true)} />
        )}
      </Rejilla>
      {!ciudadania && usuario.rol !== "cuadrilla" ? (
        <AvisoPanelWeb />
      ) : null}

      <Boton titulo="Cerrar sesión" variante="peligro" onPress={cerrar} />
    </Pantalla>
  );
}
