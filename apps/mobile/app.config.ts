import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Extiende app.json. La clave de Google Maps (necesaria para ver el mapa en el APK de Android) se
 * toma de la variable de entorno GOOGLE_MAPS_API_KEY al compilar; nunca se guarda en el repositorio.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      ...(process.env.GOOGLE_MAPS_API_KEY
        ? { googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY } }
        : {}),
    },
  },
});
