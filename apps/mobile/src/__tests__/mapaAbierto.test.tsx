import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { MapaAbierto, ESPERA_MAPA_MS } from "@/components/mapa/MapaAbierto";
import { MapaRutaPedido, rutaDe, textoLlegada } from "@/components/mapa/MapaRutaPedido";
import { MarcarEnMapa } from "@/components/mapa/MarcarEnMapa";
import { MapaSector } from "@/components/MapaSector";
import { acumuladas, estimarDistancia, haversine, puntoEn, rumbo, rumboEn, suavizar, dividir, type Par } from "@/lib/animacionRuta";
import {
  BASE_URL_MAPA,
  construirHtml,
  LEAFLET_CSS_SRI,
  LEAFLET_JS_SRI,
  LEAFLET_VERSION,
  MOTOR_JS,
  PAGINA_JS,
} from "@/lib/mapaHtml";
import { parsearMensajeDelMapa, TEXTO_MAPA_SIN_INTERNET } from "@/lib/mapaProtocolo";
import type { PedidoCiudadano, RutaSeguimiento } from "@/lib/servicios";
import { useState } from "react";

type Instancia = { props: Record<string, any>; postMessage: jest.Mock };
const webview = require("react-native-webview") as { __ultima: () => Instancia; __reiniciar: () => void };

const metricas = { frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const conSafe = (h: React.JSX.Element) => <SafeAreaProvider initialMetrics={metricas}>{h}</SafeAreaProvider>;

/** Mensajes que la app mandó al WebView, ya decodificados. */
const enviados = (): { n: number; m: any }[] => webview.__ultima().postMessage.mock.calls.map((c) => JSON.parse(c[0]));
const deTipo = (t: string) => enviados().filter((e) => e.m.t === t);
const desdeLaPagina = (o: unknown) => act(() => webview.__ultima().props.onMessage({ nativeEvent: { data: JSON.stringify(o) } }));

beforeEach(() => {
  webview.__reiniciar();
  jest.restoreAllMocks();
});

describe("página del mapa (Leaflet + OpenStreetMap)", () => {
  it("carga Leaflet con versión exacta, SRI, CSP y atribución de OSM", async () => {
    const html = construirHtml();
    expect(html).toContain(`leaflet@${LEAFLET_VERSION}/dist/leaflet.js`);
    expect(LEAFLET_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(html).toContain(`integrity="${LEAFLET_JS_SRI}"`);
    expect(html).toContain(`integrity="${LEAFLET_CSS_SRI}"`);
    expect(html).toContain('crossorigin=""');
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("default-src 'none'");
    expect(html).not.toContain("connect-src");
    expect(html).toContain("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    expect(html).toContain("© colaboradores de OpenStreetMap");
    expect(html).not.toMatch(/google/i);
  });

  it("el script de la página es JavaScript válido", async () => {
    expect(() => new Function(PAGINA_JS)).not.toThrow();
  });

  it("la geometría de la página coincide con animacionRuta.ts", async () => {
    const m = new Function(`${MOTOR_JS}; return { haversine, rumbo, acumuladas, puntoEn, rumboEn, dividir, estimarDistancia, suavizar };`)();
    const ruta: Par[] = [
      [-58.2, -26.2],
      [-58.2, -26.19],
      [-58.19, -26.19],
      [-58.18, -26.185],
    ];
    const ac = acumuladas(ruta);
    expect(m.acumuladas(ruta)).toEqual(ac);
    expect(m.haversine(ruta[0], ruta[2])).toBeCloseTo(haversine(ruta[0], ruta[2]), 6);
    expect(m.rumbo(ruta[0], ruta[2])).toBeCloseTo(rumbo(ruta[0], ruta[2]), 6);
    for (const d of [0, 400, 1100, 1700, 99999]) {
      expect(m.puntoEn(ruta, ac, d)).toEqual(puntoEn(ruta, ac, d));
      expect(m.rumboEn(ruta, ac, d)).toBeCloseTo(rumboEn(ruta, ac, d), 6);
      expect(m.dividir(ruta, ac, d)).toEqual(dividir(ruta, ac, d));
    }
    const p = { base: 100, velocidadKmh: 36, transcurridoMs: 5000, largo: 1000, maxSegundos: 3 };
    expect(m.estimarDistancia(p)).toBe(estimarDistancia(p));
    expect(m.suavizar(0, 100, 100)).toBeCloseTo(suavizar(0, 100, 100), 9);
    expect(m.suavizar(100, 90, 16)).toBe(suavizar(100, 90, 16));
  });
});

describe("protocolo de mensajes", () => {
  it("valida lo que llega del WebView y descarta el resto", async () => {
    expect(parsearMensajeDelMapa('{"t":"listo"}')).toEqual({ t: "listo" });
    expect(parsearMensajeDelMapa('{"t":"punto","lon":-58.1,"lat":-26.2,"origen":"arrastre"}')).toEqual({ t: "punto", lon: -58.1, lat: -26.2, origen: "arrastre" });
    expect(parsearMensajeDelMapa('{"t":"punto","lon":999,"lat":-26.2}')).toBeNull();
    expect(parsearMensajeDelMapa('{"t":"punto","lon":"x","lat":1}')).toBeNull();
    expect(parsearMensajeDelMapa('{"t":"avance","restanteM":10,"largoM":50}')).toEqual({ t: "avance", restanteM: 10, largoM: 50 });
    expect(parsearMensajeDelMapa('{"t":"otro"}')).toBeNull();
    expect(parsearMensajeDelMapa("no es json")).toBeNull();
  });
});

describe("MapaAbierto", () => {
  it("configura el WebView con los mínimos permisos y bloquea la navegación", async () => {
    await render(conSafe(<MapaAbierto etiqueta="Mapa de prueba" />));
    const p = webview.__ultima().props;
    expect(p.javaScriptEnabled).toBe(true);
    expect(p.allowFileAccess).toBe(false);
    expect(p.allowUniversalAccessFromFileURLs).toBe(false);
    expect(p.domStorageEnabled).toBe(false);
    expect(p.thirdPartyCookiesEnabled).toBe(false);
    expect(p.geolocationEnabled).toBe(false);
    expect(p.mixedContentMode).toBe("never");
    expect(p.source.baseUrl).toBe(BASE_URL_MAPA);
    expect(p.onShouldStartLoadWithRequest({ url: BASE_URL_MAPA })).toBe(true);
    expect(p.onShouldStartLoadWithRequest({ url: "https://www.openstreetmap.org/copyright" })).toBe(false);
    expect(p.onShouldStartLoadWithRequest({ url: "intent://evil" })).toBe(false);
    expect(screen.getByLabelText("Mapa de prueba")).toBeTruthy();
  });

  it("guarda las capas hasta que la página está lista y luego las manda, numeradas", async () => {
    await render(
      conSafe(
        <MapaAbierto
          etiqueta="Mapa"
          sectores={[{ id: "S4", etiqueta: "S4", anillo: [[-58.15, -26.19], [-58.13, -26.19], [-58.13, -26.17], [-58.15, -26.19]], color: "#B42318" }]}
          puntos={[{ id: "centro", lon: -58.14, lat: -26.18, etiqueta: "Centro", forma: "cuadrado", color: "#1E5AA0" }]}
          encuadre={[[-58.15, -26.19], [-58.13, -26.17]]}
        />,
      ),
    );
    expect(webview.__ultima().postMessage).not.toHaveBeenCalled();
    await desdeLaPagina({ t: "listo" });
    await waitFor(() => expect(deTipo("capas")).toHaveLength(1));
    const capas = deTipo("capas")[0].m;
    expect(capas.sectores[0].id).toBe("S4");
    expect(capas.puntos[0].forma).toBe("cuadrado");
    expect(deTipo("encuadre")[0].m.puntos).toHaveLength(2);
    const numeros = enviados().map((e) => e.n);
    expect(numeros).toEqual([...numeros].sort((a, b) => a - b));
    expect(new Set(numeros).size).toBe(numeros.length);
  });

  it("muestra el texto de respaldo si el WebView falla", async () => {
    const alFallar = jest.fn();
    await render(conSafe(<MapaAbierto etiqueta="Mapa" alFallar={alFallar} />));
    await act(() => webview.__ultima().props.onError({ nativeEvent: { description: "net::ERR_INTERNET_DISCONNECTED" } }));
    expect(screen.getByText(TEXTO_MAPA_SIN_INTERNET)).toBeTruthy();
    expect(screen.queryByTestId("webview")).toBeNull();
    expect(alFallar).toHaveBeenCalledTimes(1);
  });

  it("muestra el respaldo si la página avisa que Leaflet no cargó, y permite reintentar", async () => {
    await render(conSafe(<MapaAbierto etiqueta="Mapa" />));
    await desdeLaPagina({ t: "error", mensaje: "No se pudo cargar el mapa" });
    expect(screen.getByText("El mapa necesita internet; tus datos y la brújula funcionan igual.")).toBeTruthy();
    await fireEvent.press(screen.getByText("Reintentar el mapa"));
    expect(screen.getByTestId("webview")).toBeTruthy();
  });

  it("muestra el respaldo si la página nunca avisa que está lista", async () => {
    jest.useFakeTimers();
    try {
      await render(conSafe(<MapaAbierto etiqueta="Mapa" />));
      await act(() => void jest.advanceTimersByTime(ESPERA_MAPA_MS + 10));
      expect(screen.getByText(TEXTO_MAPA_SIN_INTERNET)).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it("MapaSector dibuja el sector con su color de estado y el centro", async () => {
    await render(
      conSafe(
        <MapaSector
          geo={{ features: [{ geometry: { type: "Polygon", coordinates: [[[-58.15, -26.19], [-58.13, -26.19], [-58.13, -26.17], [-58.15, -26.19]]] }, properties: { id: "S4", nombre: "Sector Rural Este", categoria: "SIMULADO" } }] }}
          estados={{ S4: "comprometido" }}
          centro={{ nombre: "Escuela 1", lon: -58.14, lat: -26.18 }}
        />,
      ),
    );
    await desdeLaPagina({ t: "listo" });
    await waitFor(() => expect(deTipo("capas")).toHaveLength(1));
    const { sectores, puntos } = deTipo("capas")[0].m;
    expect(sectores[0]).toMatchObject({ id: "S4", color: "#B42318" });
    expect(puntos[0].etiqueta).toContain("(SIMULADO)");
  });
});

function Anfitrion() {
  const [p, setP] = useState<{ lon: number; lat: number } | null>(null);
  return <MarcarEnMapa punto={p} alCambiar={setP} />;
}

describe("Marcar en el mapa", () => {
  it("un toque en el mapa fija el punto y el texto dice en qué sector cae", async () => {
    await render(conSafe(<Anfitrion />));
    expect(screen.getByText("Todavía no marcaste ningún punto.")).toBeTruthy();
    await fireEvent.press(screen.getByText("Marcar en el mapa"));
    await desdeLaPagina({ t: "listo" });
    await waitFor(() => expect(deTipo("capas")).toHaveLength(1));
    expect(deTipo("capas")[0].m.sectores.map((s: { id: string }) => s.id)).toEqual(["S1", "S2", "S3", "S4"]);
    expect(deTipo("seleccion")[0].m).toMatchObject({ punto: null, elegir: true });
    await desdeLaPagina({ t: "punto", lon: -58.139, lat: -26.18, origen: "clic" });
    expect(screen.getByText("Marcaste un punto dentro del Sector S4 · Rural Este (SIMULADO).")).toBeTruthy();
    // El marcador de la página se sincroniza con el estado de la app.
    await waitFor(() => expect(deTipo("seleccion").pop()!.m.punto).toEqual({ lon: -58.139, lat: -26.18 }));
    await desdeLaPagina({ t: "punto", lon: -58.0, lat: -26.0, origen: "arrastre" });
    expect(screen.getByText("Marcaste un punto fuera de los sectores simulados.")).toBeTruthy();
  });
});

const ruta: RutaSeguimiento = {
  coordenadas: [
    [-58.2, -26.2],
    [-58.2, -26.19],
    [-58.19, -26.19],
  ],
  distancia_km: 2.1,
  llegada_estimada_min: 4,
  metodo: "red_vial",
  simulada: true,
  progreso: 0.5,
  velocidad_kmh: 30,
  calculada_en: "2026-11-20T15:00:00Z",
};

const pedido = {
  id: 12,
  tipo: "evacuacion",
  personas: 4,
  estado: "en_curso",
  origen: "app",
  creada_en: "2026-11-20T15:00:00Z",
  lat: -26.19,
  lon: -58.19,
  sector_id: "S4",
  linea_tiempo: [],
  tarea: { id: 1, estado: "en_curso", cuadrilla: { id: 1, tipo_incidente: "humana", rol_encargado: null, vehiculo: "4x4" }, iniciada_en: null, cerrada_en: null },
  seguimiento: { ruta } as unknown as PedidoCiudadano["seguimiento"],
  confirmacion: null,
  centro: { id: 1, nombre: "Escuela 1", lat: -26.185, lon: -58.18 },
} as PedidoCiudadano;

describe("Recorrido animado de la cuadrilla", () => {
  it("rutaDe exige al menos dos vértices", async () => {
    expect(rutaDe(pedido)).toBe(ruta);
    expect(rutaDe({ seguimiento: null })).toBeNull();
    expect(rutaDe({ seguimiento: { ruta: { ...ruta, coordenadas: [[-58, -26]] } } as never })).toBeNull();
  });

  it("textoLlegada: minutos, llegando y sin velocidad", async () => {
    expect(textoLlegada(2500, 30)).toBe("Llega en ~5 min");
    expect(textoLlegada(0, 30)).toBe("La cuadrilla está llegando");
    expect(textoLlegada(1000, 0)).toBeNull();
  });

  it("manda la ruta con progreso y velocidad y muestra llegada, avance, método y la insignia SIMULADO", async () => {
    await render(conSafe(<MapaRutaPedido pedido={pedido} ruta={ruta} />));
    await desdeLaPagina({ t: "listo" });
    await waitFor(() => expect(deTipo("ruta").length).toBeGreaterThan(0));
    const m = deTipo("ruta").pop()!.m;
    expect(m.ruta).toMatchObject({ progreso: 0.5, velocidadKmh: 30, simulada: true });
    expect(m.ruta.coordenadas).toHaveLength(3);
    expect(m.vehiculo).toBe("4x4");
    expect(m.reducido).toBe(false);
    // Puntos: el pedido (círculo) y el centro (cuadrado).
    expect(deTipo("capas").pop()!.m.puntos.map((p: { forma: string }) => p.forma)).toEqual(["circulo", "cuadrado"]);

    expect(screen.getByText("SIMULADO · recorrido de demostración")).toBeTruthy();
    expect(screen.getByText(/Llega en ~\d+ min/)).toBeTruthy();
    expect(screen.getByText("Recorrido calculado sobre la red vial. Velocidad media supuesta: 30 km/h. Es una estimación, no una promesa de llegada.")).toBeTruthy();
    expect(screen.getByRole("progressbar").props.accessibilityValue.now).toBe(50);

    // La página informa el avance y la llegada se recalcula en vivo.
    await desdeLaPagina({ t: "avance", restanteM: 500, largoM: 1000 });
    expect(screen.getByText("Llega en ~1 min")).toBeTruthy();
    await desdeLaPagina({ t: "avance", restanteM: 250, largoM: 1000 });
    expect(screen.getByRole("progressbar").props.accessibilityValue.now).toBe(75);
  });

  it("sin insignia si la ruta no es simulada, y «Seguir a la cuadrilla» lo manda al mapa", async () => {
    await render(conSafe(<MapaRutaPedido pedido={pedido} ruta={{ ...ruta, simulada: false, metodo: "aproximado" }} />));
    expect(screen.queryByText("SIMULADO · recorrido de demostración")).toBeNull();
    expect(screen.getByText(/no sigue calles reales/)).toBeTruthy();
    await desdeLaPagina({ t: "listo" });
    await fireEvent.press(screen.getByText("Seguir a la cuadrilla"));
    await waitFor(() => expect(deTipo("seguir").pop()!.m.seguir).toBe(true));
  });

  it("con movimiento reducido le pide al mapa que no anime", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    await render(conSafe(<MapaRutaPedido pedido={pedido} ruta={ruta} />));
    await desdeLaPagina({ t: "listo" });
    await waitFor(() => expect(deTipo("ruta").some((e) => e.m.reducido === true)).toBe(true));
  });
});
