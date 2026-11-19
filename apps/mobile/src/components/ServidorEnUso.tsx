import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { Boton, COLOR, Texto } from "@/components/ui";
import {
  cargarServidor,
  direccionServidor,
  escucharServidor,
  esUrlHttp,
  obtenerUrlServidor,
} from "@/lib/servidor";

export const MENSAJE_SIN_SERVIDOR = "Configurá el servidor antes de ingresar";
export const MENSAJE_HTTP =
  "Conexión sin cifrar (http). Tu contraseña viaja sin protección: usala solo en la red de la demo y con datos de prueba.";

/** URL del servidor vigente, actualizada cuando cambia o termina de leerse del dispositivo. */
export function useServidorActual(): string {
  const [url, setUrl] = useState(obtenerUrlServidor());
  useEffect(() => {
    let activo = true;
    void cargarServidor().then(() => {
      if (activo) setUrl(obtenerUrlServidor());
    });
    const quitar = escucharServidor(() => {
      if (activo) setUrl(obtenerUrlServidor());
    });
    return () => {
      activo = false;
      quitar();
    };
  }, []);
  return url;
}

/** Advertencia visible (y anunciada por lectores de pantalla) de que la conexión no va cifrada. */
export function AvisoHttp() {
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        borderWidth: 1,
        borderColor: COLOR.aviso,
        backgroundColor: "#fefce8",
        borderRadius: 8,
        padding: 10,
      }}
    >
      <Text style={{ color: "#713f12", fontSize: 13, fontWeight: "600" }}>{MENSAJE_HTTP}</Text>
    </View>
  );
}

/**
 * Muestra a qué servidor se enviarán las credenciales, con acceso para cambiarlo, y la advertencia
 * si es `http://`. Va encima del botón de envío en el login y el registro.
 */
export function ServidorEnUso({ url, onCambiar }: { url: string; onCambiar: () => void }) {
  return (
    <View style={{ gap: 8 }}>
      {url ? (
        <Texto>{`Servidor: ${direccionServidor(url)}`}</Texto>
      ) : (
        <Text accessibilityRole="alert" style={{ color: COLOR.error, fontSize: 14, fontWeight: "600" }}>
          {MENSAJE_SIN_SERVIDOR}
        </Text>
      )}
      {url && esUrlHttp(url) ? <AvisoHttp /> : null}
      <Boton titulo="Cambiar servidor" variante="secundario" onPress={onCambiar} />
    </View>
  );
}
