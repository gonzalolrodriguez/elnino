import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Extiende app.json. Los mapas de la app son abiertos (OpenStreetMap + Leaflet dentro de un WebView):
 * no se usa Google Maps ni se necesita ninguna clave de API.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
});
