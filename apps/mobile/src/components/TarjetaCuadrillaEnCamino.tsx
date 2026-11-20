import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Text, View } from "react-native";

import { Aviso, Cifra, Encabezado } from "@/components/Piezas";
import { COLOR, Insignia, Tarjeta, Texto } from "@/components/ui";
import { TIPO as TIPOGRAFIA } from "@/components/tema";
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

/** Llegada en cifra grande: «8 min», «1:20 h» o «Ya» cuando está llegando. */
function cifraLlegada(min: number): { valor: string; unidad: string } {
  if (min === 0) return { valor: "Ya", unidad: "llegando" };
  if (min < 60) return { valor: String(min), unidad: "min" };
  return { valor: `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`, unidad: "h" };
}

/** «3,5 km» o «250 m» partido en cifra y unidad. */
function cifraDistancia(texto: string): { valor: string; unidad: string } {
  const corte = texto.lastIndexOf(" ");
  return { valor: texto.slice(0, corte), unidad: texto.slice(corte + 1) };
}

/** Una tarjeta por pedido. `distanciaInicialM` es la mayor distancia vista, para la barra de avance. */
export function ItemCuadrillaEnCamino({ s, ahoraMs, distanciaInicialM }: { s: SeguimientoCuadrilla; ahoraMs: number; distanciaInicialM?: number | null }) {
  const llegada = formatearLlegada(s.llegada_estimada_min);
  const distancia = formatearDistancia(s.distancia_m);
  const hora = horaLocal(s.actualizada_en);
  const vieja = s.estado === "en_camino" && (s.posicion_vieja ?? esPosicionVieja(s.actualizada_en, ahoraMs, s.supuestos.posicion_vieja_minutos));
  const progreso = progresoRecorrido(s.distancia_m, distanciaInicialM ?? s.distancia_m);
  const cifraL = llegada && s.llegada_estimada_min !== null ? cifraLlegada(s.llegada_estimada_min) : null;
  const cifraD = distancia ? cifraDistancia(distancia) : null;
  return (
    <Tarjeta>
      <Encabezado icono="camion">Cuadrilla en camino</Encabezado>
      <Texto suave>
        Pedido n.º {s.solicitud_id} · cuadrilla {TIPO[s.tipo_cuadrilla] ?? s.tipo_cuadrilla}
      </Texto>
      {s.estado === "asignada_sin_posicion" ? (
        <Aviso tono="info" icono="reloj">
          Una cuadrilla tomó tu pedido. Todavía no recibimos su posición: apenas la comparta, la vas a ver acá.
        </Aviso>
      ) : (
        <>
          {cifraL || cifraD ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 28, rowGap: 12 }}>
              {cifraL ? (
                <Cifra rotulo="Llegada estimada" valor={cifraL.valor} unidad={cifraL.unidad} etiquetaAccesible={`Llegada estimada: ${llegada}`} color={COLOR.primario} />
              ) : null}
              {cifraD ? (
                <Cifra rotulo="Distancia a tu pedido" valor={cifraD.valor} unidad={cifraD.unidad} etiquetaAccesible={`Distancia a tu pedido: ${distancia}`} />
              ) : null}
            </View>
          ) : (
            <Text style={{ ...TIPOGRAFIA.subtitulo, color: COLOR.texto }}>La cuadrilla está en camino</Text>
          )}
          {!llegada ? (
            <Texto>No podemos calcular la llegada porque tu pedido no tiene una ubicación exacta. Un operador la va a verificar.</Texto>
          ) : null}
          {progreso !== null ? <BarraProgreso valor={progreso} /> : null}
          {hora ? <Texto suave>Última posición recibida a las {hora}.</Texto> : null}
          {vieja ? (
            <Aviso tono="aviso" icono="advertencia">
              La última posición tiene más de {s.supuestos.posicion_vieja_minutos} minutos: la distancia y la llegada pueden no ser confiables. Si es urgente, llamá al 103.
            </Aviso>
          ) : null}
        </>
      )}
      <Texto suave pequeno>
        Es una estimación (supuesto del equipo: línea recta por un factor de desvío de {String(s.supuestos.factor_desvio).replace(".", ",")} y una velocidad media de{" "}
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
