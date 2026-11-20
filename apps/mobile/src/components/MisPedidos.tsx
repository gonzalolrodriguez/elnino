import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { ItemCuadrillaEnCamino } from "@/components/TarjetaCuadrillaEnCamino";
import { Boton, COLOR, Insignia, Subtitulo, Tarjeta, Texto } from "@/components/ui";
import { etiquetaRolOperativo, etiquetaTipoSolicitud, formatearFechaHora } from "@/lib/etiquetas";
import { textoNovedad } from "@/lib/partes";
import { estadoFinal, etiquetaTipoCuadrilla, etiquetaVehiculo, lineaDeTiempo } from "@/lib/pedidos";
import { etiquetaRespuesta } from "@/lib/respuestas";
import type { PedidoCiudadano } from "@/lib/servicios";

const personas = (n: number) => `${n} ${n === 1 ? "persona" : "personas"}`;

/** Línea de tiempo vertical: cada paso dice si se alcanzó con texto e ícono, no solo con color. */
export function LineaTiempo({ pedido }: { pedido: PedidoCiudadano }) {
  const pasos = lineaDeTiempo(pedido);
  const ultimo = pasos.reduce((u, p, i) => (p.alcanzado ? i : u), -1);
  return (
    <View style={{ gap: 6 }}>
      {pasos.map((p, i) => (
        <View
          key={p.clave}
          accessible
          accessibilityLabel={`${p.etiqueta}: ${p.alcanzado ? "listo" : "pendiente"}${p.en ? `, ${formatearFechaHora(p.en)}` : ""}`}
          style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}
        >
          <Text maxFontSizeMultiplier={1.5} style={{ width: 20, color: p.alcanzado ? COLOR.ok : COLOR.suave, fontWeight: "700" }}>
            {p.alcanzado ? "✓" : "○"}
          </Text>
          <View style={{ flex: 1 }}>
            <Text maxFontSizeMultiplier={1.5} style={{ fontWeight: i === ultimo ? "700" : "400", color: p.alcanzado ? COLOR.texto : COLOR.suave }}>
              {p.etiqueta}
              {i === ultimo && i < pasos.length - 1 ? " (ahora)" : ""}
            </Text>
            {p.en ? (
              <Text maxFontSizeMultiplier={1.5} style={{ color: COLOR.suave, fontSize: 13 }}>
                {formatearFechaHora(p.en)}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Pedido activo: tipo, personas, línea de tiempo, cuadrilla por rol y vehículo, cercanía y centro. */
export function TarjetaPedido({ pedido }: { pedido: PedidoCiudadano }) {
  const router = useRouter();
  const cuadrilla = pedido.tarea?.cuadrilla ?? null;
  const vehiculo = etiquetaVehiculo(cuadrilla?.vehiculo);
  return (
    <>
      <Tarjeta>
        <Text style={{ fontWeight: "700", fontSize: 16 }}>
          Pedido n.º {pedido.id} · {etiquetaTipoSolicitud(pedido.tipo)}
        </Text>
        <Texto>{personas(pedido.personas)}</Texto>
        <LineaTiempo pedido={pedido} />
        {pedido.confirmacion?.respondida && pedido.confirmacion.respuesta ? (
          <Texto>Tu respuesta: {etiquetaRespuesta(pedido.confirmacion.respuesta)}.</Texto>
        ) : null}
        {cuadrilla ? (
          <View style={{ gap: 2 }}>
            <Subtitulo>Cuadrilla</Subtitulo>
            <Texto>
              {etiquetaTipoCuadrilla(cuadrilla.tipo_incidente)}
              {cuadrilla.rol_encargado ? ` · a cargo: ${etiquetaRolOperativo(cuadrilla.rol_encargado)}` : ""}
            </Texto>
            {vehiculo ? <Texto>Vehículo: {vehiculo}</Texto> : null}
          </View>
        ) : (
          <Texto suave>Todavía no hay una cuadrilla asignada.</Texto>
        )}
        {textoNovedad(pedido.novedad) ? <Texto suave>{textoNovedad(pedido.novedad)}</Texto> : null}
        {pedido.centro ? (
          <View style={{ gap: 6 }}>
            <Subtitulo>Centro asignado</Subtitulo>
            <Texto>{pedido.centro.nombre}</Texto>
            <Boton titulo="¿Hacia dónde voy?" variante="secundario" onPress={() => router.push("/brujula")} />
          </View>
        ) : null}
        <Insignia categoria="SIMULADO" />
      </Tarjeta>
      {pedido.seguimiento ? <ItemCuadrillaEnCamino s={pedido.seguimiento} ahoraMs={Date.now()} /> : null}
    </>
  );
}

/** Historial: una tarjeta compacta por pedido con su estado final (texto + ícono). */
export function FilaHistorial({ pedido }: { pedido: PedidoCiudadano }) {
  const f = estadoFinal(pedido);
  return (
    <Tarjeta>
      <Text style={{ fontWeight: "600" }}>
        Pedido n.º {pedido.id} · {etiquetaTipoSolicitud(pedido.tipo)} · {personas(pedido.personas)}
      </Text>
      <Text style={{ color: f.icono === "✓" ? COLOR.ok : COLOR.suave, fontWeight: "600" }}>
        {f.icono} {f.texto}
      </Text>
      <Texto suave pequeno>
        {formatearFechaHora(pedido.creada_en)}
      </Texto>
    </Tarjeta>
  );
}
