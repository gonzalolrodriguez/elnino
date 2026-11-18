import { useMemo } from "react";
import { StyleSheet } from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";

import type { GeoSectores } from "@/lib/servicios";

const COLOR_ESTADO: Record<string, string> = {
  normal: "#15803d",
  en_riesgo: "#a16207",
  comprometido: "#b91c1c",
};

type Props = {
  geo: GeoSectores | null;
  /** id del sector -> estado, solo para los sectores del usuario. */
  estados: Record<string, string>;
  centro: { nombre: string; lon: number; lat: number } | null;
};

/** Mapa del sector propio (polígono K10, SIMULADO) y del centro sugerido (SIMULADO). */
export function MapaSector({ geo, estados, centro }: Props) {
  const propios = useMemo(
    () => (geo?.features ?? []).filter((f) => f.properties.id in estados),
    [geo, estados],
  );
  const puntos = propios.flatMap((f) => f.geometry.coordinates[0] ?? []);
  if (centro) puntos.push([centro.lon, centro.lat]);

  const region = useMemo(() => {
    if (puntos.length === 0) return { latitude: -26.18, longitude: -58.17, latitudeDelta: 0.2, longitudeDelta: 0.2 };
    const lons = puntos.map((p) => p[0]);
    const lats = puntos.map((p) => p[1]);
    const lon0 = Math.min(...lons);
    const lon1 = Math.max(...lons);
    const lat0 = Math.min(...lats);
    const lat1 = Math.max(...lats);
    return {
      latitude: (lat0 + lat1) / 2,
      longitude: (lon0 + lon1) / 2,
      latitudeDelta: Math.max((lat1 - lat0) * 1.6, 0.02),
      longitudeDelta: Math.max((lon1 - lon0) * 1.6, 0.02),
    };
  }, [puntos]);

  return (
    <MapView style={estilos.mapa} initialRegion={region} accessibilityLabel="Mapa del sector">
      {propios.map((f) => (
        <Polygon
          key={f.properties.id}
          coordinates={(f.geometry.coordinates[0] ?? []).map(([lon, lat]) => ({ latitude: lat, longitude: lon }))}
          strokeColor={COLOR_ESTADO[estados[f.properties.id]] ?? "#52525b"}
          fillColor={`${COLOR_ESTADO[estados[f.properties.id]] ?? "#52525b"}33`}
          strokeWidth={2}
        />
      ))}
      {centro ? (
        <Marker
          coordinate={{ latitude: centro.lat, longitude: centro.lon }}
          title={`${centro.nombre} (SIMULADO)`}
          description="Centro de recepción sugerido: lo define la autoridad"
        />
      ) : null}
    </MapView>
  );
}

const estilos = StyleSheet.create({ mapa: { height: 280, borderRadius: 8 } });
