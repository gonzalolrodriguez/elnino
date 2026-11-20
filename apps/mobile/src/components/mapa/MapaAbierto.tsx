import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type Ref } from "react";
import { StyleSheet, View } from "react-native";
import { WebView as WebViewNativo, type WebViewMessageEvent, type WebViewProps } from "react-native-webview";

import { Boton, COLOR, RADIO, Texto } from "@/components/ui";
import { useDiseno } from "@/lib/responsive";
import { BASE_URL_MAPA, construirHtml } from "@/lib/mapaHtml";
import {
  parsearMensajeDelMapa,
  TEXTO_MAPA_SIN_INTERNET,
  type MensajeAlMapa,
  type Par,
  type PuntoCapa,
  type RutaMapa,
  type SectorMapa,
} from "@/lib/mapaProtocolo";

export type PuntoElegido = { lon: number; lat: number };

type Props = {
  /** Descripción para lectores de pantalla; la información clave también debe estar como texto fuera del mapa. */
  etiqueta: string;
  /** `"lleno"` ocupa el alto disponible del contenedor; si no, un alto en dp (por defecto, según la pantalla). */
  alto?: number | "lleno";
  sectores?: SectorMapa[];
  puntos?: PuntoCapa[];
  /** Puntos que deben quedar a la vista. Sin esto el mapa queda en Formosa. */
  encuadre?: Par[];
  zoomMax?: number;
  /** Con `alElegir` el mapa deja marcar un punto tocando o arrastrando el marcador. */
  seleccion?: PuntoElegido | null;
  alElegir?: (p: PuntoElegido) => void;
  /** Recorrido del vehículo; la página lo anima con `requestAnimationFrame` (sin movimiento si `reducido`). */
  ruta?: RutaMapa | null;
  vehiculo?: string | null;
  reducido?: boolean;
  seguir?: boolean;
  /** Cerca de una vez por segundo: metros que faltan y largo total de la ruta. */
  alAvanzar?: (restanteM: number, largoM: number) => void;
  alListo?: () => void;
  /** El mapa no se pudo dibujar (sin internet, error del WebView o tiempo agotado). */
  alFallar?: () => void;
};

/** Si la página no avisa que está lista en este tiempo, se muestra el respaldo en texto. */
export const ESPERA_MAPA_MS = 15_000;

const HTML = construirHtml();

type ManejadorWebView = { postMessage: (mensaje: string) => void };

// Con el árbol de dependencias de pnpm (dos versiones de @types/react) los tipos de clase del WebView no
// resuelven; se tipa por sus props públicas y por el único método que se usa del `ref`.
const WebView = WebViewNativo as unknown as ComponentType<WebViewProps & { ref?: Ref<ManejadorWebView> }>;

/**
 * Mapa abierto (OpenStreetMap + Leaflet) dentro de un WebView. No usa Google Maps ni ninguna clave.
 *
 * Seguridad del WebView (el mapa es contenido de terceros, así que se le dan los mínimos permisos):
 *  - Solo JavaScript: sin acceso a archivos ni a URLs `file://`, sin almacenamiento DOM, sin cookies
 *    de terceros ni compartidas con el resto de la app, sin geolocalización, sin ventanas múltiples
 *    y sin contenido mixto (todo es https).
 *  - Navegación bloqueada: `onShouldStartLoadWithRequest` solo admite la página inicial; cualquier
 *    otra navegación (enlaces, redirecciones) se descarta, así el mapa nunca se convierte en un navegador.
 *  - La página lleva CSP y SRI (ver `mapaHtml.ts`). La app solo le manda datos JSON y solo acepta de
 *    ella mensajes que `parsearMensajeDelMapa` valida; no se ejecuta código recibido.
 *  - Sin internet (o si Leaflet no carga) aparece un texto claro: los datos y la brújula siguen funcionando.
 */
export function MapaAbierto({
  etiqueta,
  alto,
  sectores,
  puntos,
  encuadre,
  zoomMax,
  seleccion,
  alElegir,
  ruta,
  vehiculo = null,
  reducido = false,
  seguir = false,
  alAvanzar,
  alListo,
  alFallar,
}: Props) {
  const d = useDiseno();
  const ref = useRef<ManejadorWebView>(null);
  const [intento, setIntento] = useState(0);
  const [fallo, setFallo] = useState(false);
  const [sinTeselas, setSinTeselas] = useState(false);
  const listo = useRef(false);
  const numero = useRef(0);
  const pendientes = useRef(new Map<string, MensajeAlMapa>());

  const vivos = useRef({ alElegir, alAvanzar, alListo, alFallar });
  vivos.current = { alElegir, alAvanzar, alListo, alFallar };

  const fallar = useCallback(() => {
    setFallo(true);
    vivos.current.alFallar?.();
  }, []);

  /** Envía un mensaje; hasta que la página esté lista se guarda solo el último de cada tipo. */
  const mandar = useCallback((m: MensajeAlMapa) => {
    if (!listo.current) {
      pendientes.current.set(m.t, m);
      return;
    }
    numero.current += 1;
    ref.current?.postMessage(JSON.stringify({ n: numero.current, m }));
  }, []);

  // Cada prop se vuelve a enviar solo cuando cambia su contenido (se compara por JSON, no por identidad).
  const claveCapas = JSON.stringify([sectores ?? [], puntos ?? []]);
  const claveEncuadre = JSON.stringify([encuadre ?? null, zoomMax ?? null]);
  const claveSeleccion = JSON.stringify([seleccion ?? null, !!alElegir]);
  const claveRuta = JSON.stringify([ruta ?? null, vehiculo, reducido]);

  useEffect(() => {
    mandar({ t: "capas", sectores: sectores ?? [], puntos: puntos ?? [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveCapas, mandar, intento]);
  useEffect(() => {
    if (encuadre && encuadre.length > 0) mandar({ t: "encuadre", puntos: encuadre, zoomMax });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveEncuadre, mandar, intento]);
  useEffect(() => {
    mandar({ t: "seleccion", punto: seleccion ?? null, elegir: !!alElegir });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveSeleccion, mandar, intento]);
  useEffect(() => {
    mandar({ t: "ruta", ruta: ruta ?? null, vehiculo, reducido });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveRuta, mandar, intento]);
  useEffect(() => {
    mandar({ t: "seguir", seguir });
  }, [seguir, mandar, intento]);

  // Tiempo máximo de espera: sin «listo» en `ESPERA_MAPA_MS`, respaldo en texto.
  useEffect(() => {
    if (fallo) return;
    const t = setTimeout(() => {
      if (!listo.current) fallar();
    }, ESPERA_MAPA_MS);
    return () => clearTimeout(t);
  }, [fallo, intento, fallar]);

  const alMensaje = useCallback(
    (e: WebViewMessageEvent) => {
      const m = parsearMensajeDelMapa(e.nativeEvent.data);
      if (!m) return;
      switch (m.t) {
        case "listo": {
          listo.current = true;
          const orden = ["capas", "encuadre", "seleccion", "ruta", "seguir"];
          for (const t of orden) {
            const p = pendientes.current.get(t);
            if (p) mandar(p);
          }
          pendientes.current.clear();
          vivos.current.alListo?.();
          break;
        }
        case "punto":
          vivos.current.alElegir?.({ lon: Math.round(m.lon * 1e5) / 1e5, lat: Math.round(m.lat * 1e5) / 1e5 });
          break;
        case "avance":
          vivos.current.alAvanzar?.(m.restanteM, m.largoM);
          break;
        case "sinTeselas":
          setSinTeselas(true);
          break;
        case "error":
          fallar();
          break;
      }
    },
    [fallar, mandar],
  );

  const reintentar = () => {
    listo.current = false;
    numero.current = 0;
    pendientes.current.clear();
    setFallo(false);
    setSinTeselas(false);
    setIntento((n) => n + 1);
  };

  const estiloAlto = useMemo(
    () => (alto === "lleno" ? { flex: 1, minHeight: 240 } : { height: alto ?? d.altoMapa }),
    [alto, d.altoMapa],
  );

  if (fallo) {
    return (
      <View style={estilos.respaldo}accessibilityLabel={`${etiqueta}: no disponible sin internet`}>
        <Texto>{TEXTO_MAPA_SIN_INTERNET}</Texto>
        <Boton titulo="Reintentar el mapa" variante="secundario" onPress={reintentar} />
      </View>
    );
  }

  return (
    <View style={{ gap: 6 }}>
      <View style={[estilos.marco, estiloAlto]}>
        <WebView
          key={intento}
          ref={ref}
          style={estilos.web}
          accessibilityLabel={etiqueta}
          source={{ html: HTML, baseUrl: BASE_URL_MAPA }}
          originWhitelist={["https://*", "about:blank"]}
          onShouldStartLoadWithRequest={(r) => r.url === BASE_URL_MAPA || r.url === "about:blank"}
          onMessage={alMensaje}
          onError={fallar}
          onHttpError={fallar}
          onRenderProcessGone={fallar}
          javaScriptEnabled
          domStorageEnabled={false}
          allowFileAccess={false}
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          allowsLinkPreview={false}
          geolocationEnabled={false}
          thirdPartyCookiesEnabled={false}
          sharedCookiesEnabled={false}
          setSupportMultipleWindows={false}
          mixedContentMode="never"
          javaScriptCanOpenWindowsAutomatically={false}
          allowsInlineMediaPlayback={false}
          mediaPlaybackRequiresUserAction
          scalesPageToFit={false}
          overScrollMode="never"
          nestedScrollEnabled
          androidLayerType="hardware"
        />
      </View>
      {sinTeselas ? (
        <Texto suave pequeno>
          Sin internet no se ven las calles del fondo, pero los sectores y los puntos se muestran igual.
        </Texto>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  marco: { borderRadius: RADIO.tarjeta, overflow: "hidden", width: "100%", backgroundColor: COLOR.cielo },
  web: { flex: 1, backgroundColor: COLOR.cielo },
  respaldo: { backgroundColor: COLOR.avisoFondo, borderRadius: RADIO.boton, padding: 14, gap: 10 },
});
