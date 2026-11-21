import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { COLOR, RADIO } from "@/components/tema";
import { Insignia, Texto } from "@/components/ui";
import { MapaAbierto } from "@/components/mapa/MapaAbierto";
import { type Par, type PuntoCapa, type SectorMapa } from "@/lib/mapaProtocolo";
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
  /** Se llama cuando el mapa terminó de inicializarse. */
  alListo?: () => void;
};

/** Mapa del sector propio (polígono K10, SIMULADO) y del centro sugerido (SIMULADO), sobre OpenStreetMap. */
export function MapaSector({ geo, estados, centro, alto, alListo, alFallar }: Props & { alFallar?: () => void }) {
  const propios = useMemo(
    () => (geo?.features ?? []).filter((f) => f.properties.id in estados),
    [geo, estados],
  );
  const sectores = useMemo<SectorMapa[]>(
    () =>
      propios.map((f) => ({
        id: f.properties.id,
        etiqueta: f.properties.id,
        anillo: (f.geometry.coordinates[0] ?? []).map(([lon, lat]) => [lon, lat] as Par),
        color: COLOR_ESTADO[estados[f.properties.id]] ?? COLOR.suave,
      })),
    [propios, estados],
  );
  const puntos = useMemo<PuntoCapa[]>(
    () =>
      centro
        ? [{ id: "centro", lon: centro.lon, lat: centro.lat, etiqueta: `${centro.nombre} (SIMULADO): centro de recepción sugerido`, forma: "cuadrado", color: COLOR.primario }]
        : [],
    [centro],
  );
  const encuadre = useMemo<Par[]>(() => {
    const todos = sectores.flatMap((s) => s.anillo);
    if (centro) todos.push([centro.lon, centro.lat]);
    return todos.length > 0 ? todos : [[-58.17, -26.18]];
  }, [sectores, centro]);

  return (
    <MapaAbierto
      etiqueta="Mapa del sector"
      alto={alto}
      sectores={sectores}
      puntos={puntos}
      encuadre={encuadre}
      zoomMax={15}
      alListo={alListo}
      alFallar={alFallar}
    />
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
      <Texto>Esto es lo mismo que muestra el mapa, en texto:</Texto>
      {sectores.map((s) => (
        <Texto key={s.id}>
          Sector {s.id} · {s.nombre}: {TEXTO_ESTADO[s.estado] ?? s.estado}
        </Texto>
      ))}
      <Texto>{centro ? `Centro de recepción sugerido: ${centro.nombre}` : "Sin centro de recepción sugerido."}</Texto>
    </View>
  );
}

/**
 * Mapa con su categoría a la vista (los polígonos K10 y el centro son SIMULADO). Si el mapa no se puede
 * dibujar (sin internet, error del WebView), debajo aparece el mismo contenido en texto.
 */
export function MapaConRespaldo({ resumen, ...props }: Props & { resumen: Resumen }) {
  const [fallo, setFallo] = useState(false);
  return (
    <View style={{ gap: 8, ...(props.alto === "lleno" ? { flex: 1 } : null) }}>
      <Insignia categoria="SIMULADO" />
      <MapaSector {...props} alFallar={() => setFallo(true)} />
      {fallo ? <ResumenSinMapa {...resumen} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  respaldo: { backgroundColor: COLOR.avisoFondo, borderRadius: RADIO.boton, padding: 14, gap: 6 },
});
