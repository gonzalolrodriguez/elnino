import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";

import { COLOR, RADIO } from "@/components/tema";
import { Insignia, Texto } from "@/components/ui";
import { useDiseno } from "@/lib/responsive";
import type { GeoSectores } from "@/lib/servicios";

const COLOR_ESTADO: Record<string, string> = {
  normal: COLOR.ok,
  en_riesgo: COLOR.aviso,
  comprometido: COLOR.error,
};

type Props = {
  geo: GeoSectores | null;
  /** id del sector -> estado, solo para los sectores del usuario. */
  estados: Record<string, string>;
  centro: { nombre: string; lon: number; lat: number } | null;
  /** `"lleno"` ocupa todo el alto disponible del contenedor; si no, un alto según la pantalla. */
  alto?: number | "lleno";
  /** Se llama cuando el mapa terminó de inicializarse (si nunca ocurre, hay un problema con el mapa). */
  alListo?: () => void;
};

/** Mapa del sector propio (polígono K10, SIMULADO) y del centro sugerido (SIMULADO). */
export function MapaSector({ geo, estados, centro, alto, alListo }: Props) {
  const d = useDiseno();
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
    <MapView
      style={[estilos.mapa, alto === "lleno" ? { flex: 1, minHeight: 240 } : { height: alto ?? d.altoMapa }]}
      initialRegion={region}
      onMapReady={alListo}
      accessibilityLabel="Mapa del sector"
    >
      {propios.map((f) => (
        <Polygon
          key={f.properties.id}
          coordinates={(f.geometry.coordinates[0] ?? []).map(([lon, lat]) => ({ latitude: lat, longitude: lon }))}
          strokeColor={COLOR_ESTADO[estados[f.properties.id]] ?? COLOR.suave}
          fillColor={`${COLOR_ESTADO[estados[f.properties.id]] ?? COLOR.suave}33`}
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



type Resumen = {
  sectores: { id: string; nombre: string; estado: string }[];
  centro: { nombre: string } | null;
};

const TEXTO_ESTADO: Record<string, string> = { normal: "normal", en_riesgo: "en riesgo", comprometido: "comprometido" };

/** El mismo contenido del mapa en texto: se muestra cuando el mapa no se puede dibujar. */
export function ResumenSinMapa({ sectores, centro }: Resumen) {
  return (
    <View style={estilos.respaldo} accessibilityLabel="Resumen del sector en texto">
      <Texto>No se pudo mostrar el mapa en este teléfono (puede faltar Google Play Services o la clave del mapa). Esto es lo mismo, en texto:</Texto>
      {sectores.map((s) => (
        <Texto key={s.id}>
          Sector {s.id} · {s.nombre}: {TEXTO_ESTADO[s.estado] ?? s.estado}
        </Texto>
      ))}
      <Texto>{centro ? `Centro de recepción sugerido: ${centro.nombre}` : "Sin centro de recepción sugerido."}</Texto>
    </View>
  );
}

class LimiteMapa extends Component<{ alFallar: () => void; children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false };
  static getDerivedStateFromError() {
    return { fallo: true };
  }
  componentDidCatch() {
    this.props.alFallar();
  }
  render() {
    return this.state.fallo ? null : this.props.children;
  }
}

const ESPERA_MAPA_MS = 8000;

/**
 * Mapa con su categoría a la vista (los polígonos K10 y el centro son SIMULADO) y con respaldo en
 * texto si el mapa lanza un error o no termina de iniciarse (sin Google Play Services, sin clave).
 */
export function MapaConRespaldo({ resumen, ...props }: Props & { resumen: Resumen }) {
  const [listo, setListo] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [vencido, setVencido] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVencido(true), ESPERA_MAPA_MS);
    return () => clearTimeout(t);
  }, []);
  const verRespaldo = fallo || (vencido && !listo);
  return (
    <View style={{ gap: 8, ...(props.alto === "lleno" ? { flex: 1 } : null) }}>
      <Insignia categoria="SIMULADO" />
      {fallo ? null : (
        <LimiteMapa alFallar={() => setFallo(true)}>
          <MapaSector {...props} alListo={() => setListo(true)} />
        </LimiteMapa>
      )}
      {verRespaldo ? <ResumenSinMapa {...resumen} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  mapa: { borderRadius: RADIO.tarjeta, width: "100%" },
  respaldo: { backgroundColor: COLOR.avisoFondo, borderRadius: RADIO.boton, padding: 14, gap: 6 },
});
