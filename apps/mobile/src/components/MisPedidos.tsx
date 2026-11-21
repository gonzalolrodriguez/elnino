import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { type NombreIcono } from "@/components/Icono";
import { MapaRutaPedido, rutaDe } from "@/components/mapa/MapaRutaPedido";
import { Aviso, Chip, Chips, Encabezado, Paso } from "@/components/Piezas";
import { ItemCuadrillaEnCamino } from "@/components/TarjetaCuadrillaEnCamino";
import { Boton, COLOR, Insignia, Tarjeta, Texto } from "@/components/ui";
import { TIPO } from "@/components/tema";
import { etiquetaRolOperativo, etiquetaTipoSolicitud, formatearFechaHora } from "@/lib/etiquetas";
import { textoNovedad } from "@/lib/partes";
import { estadoFinal, etiquetaTipoCuadrilla, etiquetaVehiculo, lineaDeTiempo } from "@/lib/pedidos";
import { etiquetaRespuesta } from "@/lib/respuestas";
import type { PedidoCiudadano } from "@/lib/servicios";

const personas = (n: number) => `${n} ${n === 1 ? "persona" : "personas"}`;

/** Ícono de cada paso del seguimiento (los mismos que usa el panel web). */
const ICONO_PASO: Record<string, NombreIcono> = {
  recibida: "bandeja",
  verificada: "escudo",
  asignada: "personas",
  en_curso: "camion",
  resuelta: "tilde",
  confirmada: "tilde",
};

/** «14:05» si es de hoy y «19/11 14:05» si es de otro día. */
function cuando(en: string | null): string | null {
  const completa = formatearFechaHora(en);
  if (completa === "—") return null;
  const [dia, hora] = completa.split(" ");
  const [hoy] = formatearFechaHora(new Date()).split(" ");
  return dia === hoy ? hora : `${dia.slice(0, 5)} ${hora}`;
}

/**
 * Seguimiento del pedido, como el de un envío: línea vertical con un disco por paso (lleno si está
 * hecho, con aro si es el actual, vacío si falta). Cada paso dice si se alcanzó con ícono, texto y hora,
 * no solo con color.
 */
export function LineaTiempo({ pedido }: { pedido: PedidoCiudadano }) {
  const pasos = lineaDeTiempo(pedido);
  const ultimo = pasos.reduce((u, p, i) => (p.alcanzado ? i : u), -1);
  return (
    <View>
      {pasos.map((p, i) => (
        <Paso
          key={p.clave}
          estado={i === ultimo && i < pasos.length - 1 ? "actual" : p.alcanzado ? "hecho" : "pendiente"}
          icono={ICONO_PASO[p.clave] ?? "tilde"}
          etiqueta={p.etiqueta}
          hora={cuando(p.en)}
          ultimo={i === pasos.length - 1}
          siguienteHecho={i < pasos.length - 1 && pasos[i + 1].alcanzado}
        />
      ))}
    </View>
  );
}

/** Pedido activo: tipo, personas, línea de tiempo, cuadrilla por rol y vehículo, cercanía y centro. */
export function TarjetaPedido({ pedido }: { pedido: PedidoCiudadano }) {
  const router = useRouter();
  const cuadrilla = pedido.tarea?.cuadrilla ?? null;
  const vehiculo = etiquetaVehiculo(cuadrilla?.vehiculo);
  const novedad = textoNovedad(pedido.novedad);
  return (
    <>
      <Tarjeta>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.6} style={{ ...TIPO.subtitulo, color: COLOR.texto }}>
          Pedido n.º {pedido.id} · {etiquetaTipoSolicitud(pedido.tipo)}
        </Text>
        <Chips>
          <Chip icono="personas" texto={personas(pedido.personas)} />
          {pedido.sector_id ? <Chip icono="punto" texto={`Sector ${pedido.sector_id}`} /> : null}
        </Chips>
        <LineaTiempo pedido={pedido} />
        {novedad ? (
          <Aviso tono="aviso" icono="advertencia">
            {novedad}
          </Aviso>
        ) : null}
        {pedido.confirmacion?.respondida && pedido.confirmacion.respuesta ? (
          <Texto>Tu respuesta: {etiquetaRespuesta(pedido.confirmacion.respuesta)}.</Texto>
        ) : null}
        {cuadrilla ? (
          <View style={{ gap: 8 }}>
            <Encabezado icono="camion">Cuadrilla</Encabezado>
            <Texto>{etiquetaTipoCuadrilla(cuadrilla.tipo_incidente)}</Texto>
            <Chips>
              {cuadrilla.rol_encargado ? <Chip icono="persona" tono="info" texto={`A cargo: ${etiquetaRolOperativo(cuadrilla.rol_encargado)}`} /> : null}
              {vehiculo ? <Chip icono="camion" tono="info" texto={vehiculo} /> : null}
            </Chips>
          </View>
        ) : (
          <Texto suave>Todavía no hay una cuadrilla asignada.</Texto>
        )}
        {pedido.centro ? (
          <View style={{ gap: 8 }}>
            <Encabezado icono="casa">Centro asignado</Encabezado>
            <Texto>{pedido.centro.nombre}</Texto>
            <Boton titulo="¿Hacia dónde voy?" variante="secundario" icono="flecha" onPress={() => router.push("/brujula")} />
          </View>
        ) : null}
        <Insignia categoria="SIMULADO" />
      </Tarjeta>
      {pedido.seguimiento ? <ItemCuadrillaEnCamino s={pedido.seguimiento} ahoraMs={Date.now()} /> : null}
      {rutaDe(pedido) ? <MapaRutaPedido pedido={pedido} ruta={rutaDe(pedido)!} /> : null}
    </>
  );
}

/** Historial: una tarjeta compacta por pedido con su estado final (chip con ícono y texto). */
export function FilaHistorial({ pedido }: { pedido: PedidoCiudadano }) {
  const f = estadoFinal(pedido);
  const listo = f.icono === "✓";
  return (
    <Tarjeta>
      <Text maxFontSizeMultiplier={1.6} style={{ ...TIPO.cuerpoFuerte, fontWeight: "700", color: COLOR.texto }}>
        Pedido n.º {pedido.id} · {etiquetaTipoSolicitud(pedido.tipo)}
      </Text>
      <Chips>
        <Chip icono={listo ? "tilde" : "reloj"} tono={listo ? "ok" : "neutro"} texto={f.texto} />
        <Chip icono="personas" texto={personas(pedido.personas)} />
      </Chips>
      <Texto suave pequeno>
        {formatearFechaHora(pedido.creada_en)}
      </Texto>
    </Tarjeta>
  );
}
