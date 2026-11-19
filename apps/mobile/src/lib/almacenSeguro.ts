import * as SecureStore from "expo-secure-store";

/**
 * Único lugar donde se guardan secretos (refresh token, usuario). Siempre expo-secure-store;
 * nunca AsyncStorage ni SQLite (CLAUDE.md §5.5 y §6.2). También guarda la URL del servidor
 * (`servidor.ts`), que no es secreta pero conviene mantener en el mismo almacén.
 */
export const almacenSeguro = {
  async guardar(clave: string, valor: string): Promise<void> {
    await SecureStore.setItemAsync(clave, valor);
  },
  async leer(clave: string): Promise<string | null> {
    return SecureStore.getItemAsync(clave);
  },
  async borrar(clave: string): Promise<void> {
    await SecureStore.deleteItemAsync(clave);
  },
};
