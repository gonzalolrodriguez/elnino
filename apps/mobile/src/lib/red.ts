import NetInfo from "@react-native-community/netinfo";

/** Hay conectividad de red. `isInternetReachable` puede ser null (desconocido): se confía en `isConnected`. */
export async function hayRed(): Promise<boolean> {
  const estado = await NetInfo.fetch();
  return estado.isConnected === true && estado.isInternetReachable !== false;
}

export function escucharRed(fn: (conectado: boolean) => void): () => void {
  return NetInfo.addEventListener((e) =>
    fn(e.isConnected === true && e.isInternetReachable !== false),
  );
}
