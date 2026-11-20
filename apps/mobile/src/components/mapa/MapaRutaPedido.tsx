import { useCallback, useMemo, useState } from "react";
import { Text, View } from "react-native";

import { MapaAbierto } from "@/components/mapa/MapaAbierto";
import { Boton, COLOR, Subtitulo, Tarjeta, Texto } from "@/components/ui";
import { TIPO } from "@/components/tema";
import { acumuladas, largoTotal, minutosRestantes, type Par } from "@/lib/animacionRuta";
import { formatearDistancia } from "@/lib/seguimiento";
import { useMovimientoReducido } from "@/lib/movimientoReducido";
import type { PuntoCapa, RutaMapa } from "@/lib/mapaProtocolo";
import type { PedidoCiudadano, RutaSeguimiento } from "@/lib/servicios";

/** Ruta utilizable: al menos dos vértices (si no, el mapa no se muestra). */
export function rutaDe(p: Pick<PedidoCiudadano, "seguimiento">): RutaSeguimiento | null {
  const r = p.seguimiento?.ruta;
  return r && Array.isArray(r.coordenadas) && r.coordenadas.length >= 2 ? r : null;
}

/** «Llega en ~N min» a partir de los metros que faltan y la velocidad media de la ruta. */
export function textoLlegada(restanteM: number, velocidadKmh: number): string | null {
  const min = minutosRestantes(restanteM, velocidadKmh);
  if (min === null) return null;
  return min === 0 ? "La cuadrilla está llegando" : `Llega en ~${min} min`;
}

export const TEXTO_METODO: Record<RutaSeguimiento["metodo"], string> = {
  red_vial: "Recorrido calculado sobre la red vial.",
  aproximado: "Recorrido aproximado (línea recta con desvío): no sigue calles reales.",
};

function Barra({ valor }: { valor: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, valor)) * 100);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Avance del recorrido de la cuadrilla"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={{ height: 10, borderRadius: 5, backgroundColor: COLOR.borde, overflow: "hidden" }}
    >
      <View style={{ width: `${pct}%`, height: 10, backgroundColor: COLOR.primario }} />
    </View>
  );
}

/**
 * Recorrido de la cuadrilla en «Mis pedidos»: el mapa (Leaflet/OSM) anima el vehículo con
 * requestAnimationFrame a partir del progreso y la velocidad, y se reajusta con cada consulta. Todo lo
 * importante (llegada, distancia, método, avance) también está en texto fuera del mapa. Con el
 * movimiento reducido del sistema no hay animación: el vehículo salta a su posición estimada.
 */
export function MapaRutaPedido({ pedido, ruta }: { pedido: PedidoCiudadano; ruta: RutaSeguimiento }) {
  const reducido = useMovimientoReducido();
  const [seguir, setSeguir] = useState(false);
  const [vivo, setVivo] = useState<{ restanteM: number; largoM: number } | null>(null);

  const largoM = useMemo(() => largoTotal(acumuladas(ruta.coordenadas as Par[])), [ruta.coordenadas]);
  // Antes de la primera señal del mapa (o si no carga), la cuenta sale del progreso del servidor.
  const restanteM = vivo ? vivo.restanteM : (1 - Math.min(1, Math.max(0, ruta.progreso))) * largoM;
  const total = vivo ? vivo.largoM : largoM;
  const avance = total > 0 ? 1 - restanteM / total : 0;
  const llegada = textoLlegada(restanteM, ruta.velocidad_kmh);
  const distancia = formatearDistancia(restanteM);

  const rutaMapa = useMemo<RutaMapa>(
    () => ({ coordenadas: ruta.coordenadas as Par[], progreso: ruta.progreso, velocidadKmh: ruta.velocidad_kmh, simulada: ruta.simulada }),
    [ruta.coordenadas, ruta.progreso, ruta.velocidad_kmh, ruta.simulada],
  );

  const puntos = useMemo<PuntoCapa[]>(() => {
    const lista: PuntoCapa[] = [];
    if (pedido.lon != null && pedido.lat != null) {
      lista.push({ id: "pedido", lon: pedido.lon, lat: pedido.lat, etiqueta: "Tu pedido", forma: "circulo", color: COLOR.primario });
    }
    if (pedido.centro && pedido.centro.lon != null && pedido.centro.lat != null) {
      lista.push({
        id: "centro",
        lon: pedido.centro.lon,
        lat: pedido.centro.lat,
        etiqueta: `Centro: ${pedido.centro.nombre} (SIMULADO)`,
        forma: "cuadrado",
        color: COLOR.ok,
      });
    }
    return lista;
  }, [pedido.lon, pedido.lat, pedido.centro]);

  const encuadre = useMemo<Par[]>(
    () => [...(ruta.coordenadas as Par[]), ...puntos.map((p) => [p.lon, p.lat] as Par)],
    [ruta.coordenadas, puntos],
  );

  const alAvanzar = useCallback((r: number, l: number) => setVivo({ restanteM: r, largoM: l }), []);

  return (
    <Tarjeta>
      <Subtitulo>Recorrido de la cuadrilla</Subtitulo>
      {ruta.simulada ? (
        <View
          accessible
          accessibilityLabel="Simulado: recorrido de demostración"
          style={{ alignSelf: "flex-start", backgroundColor: COLOR.avisoFondo, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}
        >
          <Text maxFontSizeMultiplier={1.5} style={{ ...TIPO.minimo, color: COLOR.avisoTexto }}>
            SIMULADO · recorrido de demostración
          </Text>
        </View>
      ) : null}
      <MapaAbierto
        etiqueta="Mapa del recorrido de la cuadrilla hasta tu pedido. La llegada estimada está escrita debajo."
        sectores={[]}
        puntos={puntos}
        encuadre={encuadre}
        zoomMax={15}
        ruta={rutaMapa}
        vehiculo={pedido.tarea?.cuadrilla.vehiculo ?? null}
        reducido={reducido}
        seguir={seguir}
        alAvanzar={alAvanzar}
      />
      <Boton
        titulo={seguir ? "Ver todo el recorrido" : "Seguir a la cuadrilla"}
        variante="secundario"
        onPress={() => setSeguir((v) => !v)}
      />
      <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.5} style={{ ...TIPO.subtitulo, color: COLOR.texto }}>
        {llegada ?? "Llegada: sin estimación"}
      </Text>
      {distancia ? <Texto>Faltan {distancia}.</Texto> : null}
      <Barra valor={avance} />
      <Texto suave pequeno>
        {TEXTO_METODO[ruta.metodo] ?? ""} Velocidad media supuesta: {String(Math.round(ruta.velocidad_kmh)).replace(".", ",")} km/h. Es una estimación, no una promesa de llegada.
      </Texto>
    </Tarjeta>
  );
}
