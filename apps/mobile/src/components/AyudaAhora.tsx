import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Icono } from "@/components/Icono";
import { Disco } from "@/components/Piezas";
import { Boton, COLOR, ErrorCaja, Insignia, Tarjeta, Texto } from "@/components/ui";
import { RADIO } from "@/components/tema";
import { useCola } from "@/lib/ColaContext";
import { datosPedidoRapido, personasParaPedidoRapido, SEGUNDOS_CONFIRMACION } from "@/lib/ayudaRapida";
import { abrirSMS } from "@/lib/ayudaSms";
import { obtenerUbicacion, type Coordenadas } from "@/lib/dispositivo";
import { obtenerUrlServidor } from "@/lib/servidor";
import { useUsuario } from "@/lib/SesionContext";
import { TOQUE_MIN } from "@/lib/responsive";

type Fase =
  | { tipo: "reposo" }
  | { tipo: "confirmando"; segundos: number }
  | { tipo: "enviando" }
  | { tipo: "listo"; estado: "enviada" | "encolada" | "foto_pendiente"; id: number | null; punto: Coordenadas }
  | { tipo: "sin_ubicacion"; motivo: "permiso" | "error" };

/**
 * «Necesito ayuda ahora»: un solo botón grande para pedir asistencia sin completar el formulario.
 * Pide confirmación con una cuenta regresiva de 5 s que se puede cancelar (o enviar de inmediato),
 * toma el GPS solo y manda un pedido mínimo por el mismo camino y la misma cola offline que el
 * formulario. Sin GPS se puede enviar con la referencia del formulario; si no, se explica qué hacer.
 * El SMS nunca se envía solo: solo se abre la app de mensajes.
 */
export function AyudaAhora({
  referencia,
  alNecesitarDetalle,
}: {
  /** Referencia de ubicación escrita en el formulario (sirve si el GPS falla). */
  referencia: string;
  /** Abre «Detallar pedido» para que la persona escriba una referencia. */
  alNecesitarDetalle: () => void;
}) {
  const usuario = useUsuario();
  const router = useRouter();
  const { enviar, sinRed, pendientes } = useCola();
  const [fase, setFase] = useState<Fase>({ tipo: "reposo" });
  const [error, setError] = useState<string | null>(null);
  const enCurso = useRef(false);

  const mandar = useCallback(async () => {
    if (enCurso.current) return;
    enCurso.current = true;
    setError(null);
    setFase({ tipo: "enviando" });
    try {
      const gps = await obtenerUbicacion();
      const punto = gps.ok ? gps.coordenadas : null;
      const personas = await personasParaPedidoRapido(usuario.rol, `grupo_integrantes:${usuario.id}:${obtenerUrlServidor()}`);
      const datos = datosPedidoRapido(punto, personas, referencia);
      if (!datos) {
        setFase({ tipo: "sin_ubicacion", motivo: gps.ok ? "error" : gps.motivo });
        return;
      }
      const r = await enviar(datos, null);
      if (r.rechazada) {
        setError(r.rechazada);
        setFase({ tipo: "reposo" });
        return;
      }
      setFase({
        tipo: "listo",
        estado: r.enviadaYa ? "enviada" : r.fotoPendiente ? "foto_pendiente" : "encolada",
        id: r.servidorId ?? null,
        punto: punto ?? { lat: NaN, lon: NaN },
      });
    } catch {
      setError("No se pudo guardar el pedido en el teléfono. Probá de nuevo o llamá al 103.");
      setFase({ tipo: "reposo" });
    } finally {
      enCurso.current = false;
    }
  }, [enviar, referencia, usuario.id, usuario.rol]);

  // Cuenta regresiva: cada segundo baja uno; al llegar a 0 se envía.
  useEffect(() => {
    if (fase.tipo !== "confirmando") return;
    if (fase.segundos <= 0) {
      void mandar();
      return;
    }
    const t = setTimeout(() => setFase({ tipo: "confirmando", segundos: fase.segundos - 1 }), 1000);
    return () => clearTimeout(t);
  }, [fase, mandar]);

  const porSMS = async (p: Coordenadas) => {
    try {
      // Solo abre la app de mensajes: la persona revisa y envía. Nunca se envía solo.
      await abrirSMS({
        lat: p.lat,
        lon: p.lon,
        perfil: usuario.rol === "productor" ? "productor" : "ciudadano",
        familiares: 1,
        bovinos: 0,
        especie: null,
        tipoPedido: "asistencia",
        acceso: referencia,
        texto: "",
      });
    } catch {
      setError("No se pudo abrir la app de mensajes. Llamá al 103.");
    }
  };

  return (
    <Tarjeta>
      {fase.tipo === "reposo" || fase.tipo === "sin_ubicacion" ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Necesito ayuda ahora"
          accessibilityHint="Pide confirmación y envía tu ubicación al panel operativo"
          onPress={() => {
            setError(null);
            setFase({ tipo: "confirmando", segundos: SEGUNDOS_CONFIRMACION });
          }}
          style={({ pressed }) => ({
            minHeight: 84,
            borderRadius: RADIO.tarjeta,
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
            backgroundColor: pressed ? "#8F1D14" : COLOR.error,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}>
            <Icono nombre="alerta" tam={28} color={COLOR.papel} />
          </View>
          <Text maxFontSizeMultiplier={1.5} style={{ color: COLOR.papel, fontSize: 22, lineHeight: 27, fontWeight: "700", letterSpacing: -0.3, flexShrink: 1 }}>
            Necesito ayuda ahora
          </Text>
        </Pressable>
      ) : null}

      {fase.tipo === "reposo" ? (
        <Texto suave pequeno>
          Un toque: toma tu ubicación y avisa al panel operativo. Antes de enviar tenés {SEGUNDOS_CONFIRMACION} segundos para
          cancelar. No reemplaza al 103.
        </Texto>
      ) : null}

      {fase.tipo === "confirmando" ? (
        <>
          <Text
            accessibilityLiveRegion="polite"
            style={{ fontSize: 20, lineHeight: 26, fontWeight: "700", letterSpacing: -0.2, color: COLOR.texto }}
          >
            Se enviará tu pedido de ayuda en {fase.segundos} s
          </Text>
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ height: 8, borderRadius: 4, backgroundColor: COLOR.borde, overflow: "hidden" }}>
            <View style={{ height: 8, borderRadius: 4, width: `${Math.round((fase.segundos / SEGUNDOS_CONFIRMACION) * 100)}%`, backgroundColor: COLOR.error }} />
          </View>
          <Texto suave>Se toma tu ubicación y se avisa al panel operativo. Podés cancelar ahora.</Texto>
          <Boton titulo="Enviar ahora" onPress={() => void mandar()} />
          <Boton titulo="Cancelar" variante="secundario" onPress={() => setFase({ tipo: "reposo" })} />
        </>
      ) : null}

      {fase.tipo === "enviando" ? (
        <Texto>Tomando tu ubicación y enviando el pedido…</Texto>
      ) : null}

      {fase.tipo === "sin_ubicacion" ? (
        <ErrorCaja
          mensaje={
            fase.motivo === "permiso"
              ? "No tenemos permiso para usar tu ubicación. Habilitalo en los ajustes del teléfono, o escribí una referencia (paraje, camino, escuela cercana) y volvé a tocar el botón."
              : "No pudimos tomar tu ubicación. Probá al aire libre, o escribí una referencia (paraje, camino, escuela cercana) y volvé a tocar el botón."
          }
        >
          <Boton titulo="Escribir una referencia" variante="secundario" onPress={alNecesitarDetalle} />
          <Texto suave pequeno>
            Sin datos móviles también podés usar «¿Sin datos? Enviar por SMS» más abajo, o llamar al 103.
          </Texto>
        </ErrorCaja>
      ) : null}

      {error ? <ErrorCaja mensaje={error} /> : null}

      {fase.tipo === "listo" ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Disco tono={fase.estado === "encolada" ? "aviso" : "ok"} icono={fase.estado === "encolada" ? "reloj" : "tilde"} tam={40} />
            <Text
              accessibilityLiveRegion="polite"
              style={{ flex: 1, color: fase.estado === "encolada" ? COLOR.avisoTexto : COLOR.okTexto, fontWeight: "700", fontSize: 18, lineHeight: 24 }}
            >
              {fase.estado === "encolada" ? "Pedido guardado en el teléfono" : "Pedido enviado"}
              {fase.id !== null ? ` · n.º ${fase.id}` : ""}
            </Text>
          </View>
          <Insignia categoria="SIMULADO" />
          <Texto suave>
            {fase.estado === "encolada"
              ? `${sinRed ? "No hay conexión. Se enviará solo cuando vuelva la red." : "No se pudo enviar ahora. Se reintentará automáticamente."} Pendientes: ${pendientes}.`
              : fase.estado === "foto_pendiente"
                ? "Llegó al panel operativo."
                : "Llegó al panel operativo. Esperá indicaciones y, si es una emergencia, llamá al 103."}
          </Texto>
          {fase.estado === "encolada" && Number.isFinite(fase.punto.lat) ? (
            <Boton titulo="Avisar también por SMS" variante="secundario" onPress={() => void porSMS(fase.punto)} />
          ) : null}
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Ver Mis pedidos"
            onPress={() => router.push("/solicitudes")}
            style={{ minHeight: TOQUE_MIN, justifyContent: "center", alignItems: "center" }}
          >
            <Text style={{ color: COLOR.primario, fontWeight: "600", fontSize: 15 }}>Ver Mis pedidos</Text>
          </Pressable>
          <Boton titulo="Listo" variante="secundario" onPress={() => setFase({ tipo: "reposo" })} />
        </>
      ) : null}
    </Tarjeta>
  );
}
