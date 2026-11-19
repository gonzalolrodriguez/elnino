import NetInfo from "@react-native-community/netinfo";

/**
 * Hay conectividad de red local. Se confía solo en `isConnected`: en una red Wi-Fi sin salida a
 * internet (la configuración típica de la demo, con el backend en la misma LAN) NetInfo informa
 * `isInternetReachable: false` aunque el servidor sea alcanzable. Si en verdad no hay camino hasta
 * el servidor, el error de `fetch` lo decide y la cola reintenta con espera creciente.
 */
export async function hayRed(): Promise<boolean> {
  const estado = await NetInfo.fetch();
  return estado.isConnected === true;
}

export function escucharRed(fn: (conectado: boolean) => void): () => void {
  return NetInfo.addEventListener((e) => fn(e.isConnected === true));
}
