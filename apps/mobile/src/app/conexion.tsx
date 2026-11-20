import { useRouter } from "expo-router";

import { ConfigServidor } from "@/components/ConfigServidor";
import { EstadoBackend } from "@/components/EstadoBackend";
import { Disco } from "@/components/Piezas";
import { Boton, Pantalla, Texto, Titulo } from "@/components/ui";

/**
 * Conexión con el servidor: dirección del backend y estado. Está fuera de la bienvenida, el login y
 * el registro; se llega por un enlace discreto o desde un error de conexión.
 */
export default function Conexion() {
  const router = useRouter();
  return (
    <Pantalla>
      <Disco tono="neutro" icono="info" tam={48} />
      <Titulo>Conexión</Titulo>
      <Texto suave>
        Indicá la dirección del servidor al que se conecta la aplicación. Normalmente no hace falta
        cambiarla.
      </Texto>
      <EstadoBackend />
      <ConfigServidor />
      <Boton titulo="Volver" variante="secundario" onPress={() => router.back()} />
    </Pantalla>
  );
}
