import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Text, View } from "react-native";

import { COLOR, Insignia, Subtitulo, Tarjeta, Texto } from "@/components/ui";
import { api, type SeguimientoCuadrilla } from "@/lib/servicios";
import {
  esPosicionVieja,
  formatearDistancia,
  formatearLlegada,
  horaLocal,
  INTERVALO_REFRESCO_MS,
  progresoRecorrido,
} from "@/lib/seguimiento";

const TIPO: Record<string, string> = { humana: "de asistencia a personas", ganadera: "de traslado de ganado", apicola: "de apicultura" };

/**
 * Seguimiento de los pedidos propios con una tarea en curso. Se refresca cada ~20 s mientras la app está
 * en primer plano. Si una actualización falla se conserva lo último recibido (y se avisa); si nunca
 * hubo datos no se muestra nada, para no tapar el resto de la pantalla.
 */
export function useSeguimiento() {
  const [lista, setLista] = useState<SeguimientoCuadrilla[] | null>(null);
  const [fallo, setFallo] = useState(false);
  const [recibidoEn, setRecibidoEn] = useState<number | null>(null);
  const activo = useRef(true);

  const cargar = useCallback(async () => {
    try {
      const r = await api.miSeguimiento();
      if (!activo.current) return;
      setLista(Array.isArray(r.seguimientos) ? r.seguimientos : []);
      setRecibidoEn(Date.now());
      setFallo(false);
    } catch {
      if (activo.current) setFallo(true);
    }
  }, []);

  useEffect(() => {
    activo.current = true;
    void cargar();
    const t = setInterval(() => {
      if (AppState.currentState === "active") void cargar();
    }, INTERVALO_REFRESCO_MS);
    return () => {
      activo.current = false;
      clearInterval(t);
    };
  }, [cargar]);

  return { lista, fallo, recibidoEn };
}

function BarraProgreso({ valor }: { valor: number }) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Avance estimado del recorrido"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(valor * 100) }}
      style={{ height: 10, borderRadius: 5, backgroundColor: COLOR.borde, overflow: "hidden" }}
    >
      <View style={{ width: `${Math.round(valor * 100)}%`, height: 10, backgroundColor: COLOR.primario }} />
    </View>
  );
}

/** Una tarjeta por pedido. `distanciaInicialM` es la mayor distancia vista, para la barra de avance. */
export function ItemCuadrillaEnCamino({ s, ahoraMs, distanciaInicialM }: { s: SeguimientoCuadrilla; ahoraMs: number; distanciaInicialM?: number | null }) {
  const llegada = formatearLlegada(s.llegada_estimada_min);
  const distancia = formatearDistancia(s.distancia_m);
  const hora = horaLocal(s.actualizada_en);
  const vieja = s.estado === "en_camino" && (s.posicion_vieja ?? esPosicionVieja(s.actualizada_en, ahoraMs, s.supuestos.posicion_vieja_minutos));
  const progreso = progresoRecorrido(s.distancia_m, distanciaInicialM ?? s.distancia_m);
  return (
    <Tarjeta>
      <Subtitulo>Cuadrilla en camino</Subtitulo>
      <Texto suave>
        Pedido n.º {s.solicitud_id} · cuadrilla {TIPO[s.tipo_cuadrilla] ?? s.tipo_cuadrilla}
      </Texto>
      {s.estado === "asignada_sin_posicion" ? (
        <Text style={{ fontWeight: "700", fontSize: 16 }}>
          Una cuadrilla tomó tu pedido. Todavía no recibimos su posición: apenas la comparta, la vas a ver acá.
        </Text>
      ) : (
        <>
          <Text style={{ fontWeight: "700", fontSize: 18 }}>
            {distancia ? `A ${distancia} de tu pedido` : "La cuadrilla está en camino"}
          </Text>
          {llegada ? (
            <Text style={{ fontSize: 16 }}>Llegada estimada: {llegada}</Text>
          ) : (
            <Texto>No podemos calcular la llegada porque tu pedido no tiene una ubicación exacta. Un operador la va a verificar.</Texto>
          )}
          {progreso !== null ? <BarraProgreso valor={progreso} /> : null}
          {hora ? <Texto suave>Última posición recibida a las {hora}.</Texto> : null}
          {vieja ? (
            <Text style={{ color: COLOR.avisoTexto, fontWeight: "600" }} accessibilityRole="alert">
              La última posición tiene más de {s.supuestos.posicion_vieja_minutos} minutos: la distancia y la llegada pueden no ser confiables. Si es urgente, llamá al 103.
            </Text>
          ) : null}
        </>
      )}
      <Texto suave pequeno>
        Es una estimación (SUPUESTO: línea recta por un factor de desvío de {String(s.supuestos.factor_desvio).replace(".", ",")} y una velocidad media de{" "}
        {s.supuestos.velocidad_cuadrilla_kmh} km/h), no una promesa de llegada.
      </Texto>
      <Insignia categoria={s.categoria} />
    </Tarjeta>
  );
}

export function TarjetaCuadrillaEnCamino() {
  const { lista, fallo, recibidoEn } = useSeguimiento();
  const maxima = useRef<Record<number, number>>({});
  if (!lista || lista.length === 0) return null;
  for (const s of lista) {
    if (s.distancia_m !== null) maxima.current[s.tarea_id] = Math.max(maxima.current[s.tarea_id] ?? 0, s.distancia_m);
  }
  const ahoraMs = Date.now();
  return (
    <>
      {lista.map((s) => (
        <ItemCuadrillaEnCamino key={s.tarea_id} s={s} ahoraMs={ahoraMs} distanciaInicialM={maxima.current[s.tarea_id]} />
      ))}
      {fallo ? (
        <Texto suave pequeno>
          Sin conexión: se muestra lo último recibido{recibidoEn ? ` a las ${horaLocal(new Date(recibidoEn).toISOString())}` : ""}.
        </Texto>
      ) : null}
    </>
  );
}
