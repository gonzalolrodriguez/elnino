import { Text, View } from "react-native";

import { AvisoPanelWeb } from "@/components/AvisoPanelWeb";
import { EnlaceQueHacer } from "@/components/EnlaceQueHacer";
import { TarjetaConfirmacion, useConsultas } from "@/components/TarjetaConfirmacion";
import { Boton, Cargando, COLOR, ErrorCaja, Insignia, Pantalla, Rejilla, Tarjeta, Texto, Titulo, Vacio } from "@/components/ui";
import { useAlertas } from "@/lib/AlertasContext";
import { datosDeConfirmacion } from "@/lib/confirmacion";
import { formatearFechaHora } from "@/lib/etiquetas";
import { useUsuario } from "@/lib/SesionContext";

const CANAL: Record<string, string> = {
  conectado: "Tiempo real conectado",
  conectando: "Conectando en tiempo real…",
  desconectado: "Sin tiempo real: se consulta cada 30 segundos",
};

export default function Alertas() {
  const { estado, notificaciones, canal, recargar, marcarLeida } = useAlertas();
  const { rol } = useUsuario();
  const hayConfirmaciones = notificaciones.some((n) => datosDeConfirmacion(n) !== null);
  const { consultas, recargar: recargarConsultas } = useConsultas(hayConfirmaciones);
  const institucional = rol === "operador" || rol === "decisor" || rol === "admin";

  return (
    <Pantalla dosColumnas>
      <Titulo>Alertas y órdenes</Titulo>
      {institucional ? <AvisoPanelWeb /> : null}
      <Texto suave>{CANAL[canal]}. Las órdenes las emite una persona con rol autorizado.</Texto>

      {estado.tipo === "cargando" ? <Cargando texto="Cargando alertas…" /> : null}
      {estado.tipo === "error" ? <ErrorCaja mensaje={estado.mensaje} onReintentar={recargar} /> : null}
      {estado.tipo === "ok" && notificaciones.length === 0 ? (
        <Vacio texto="No tenés alertas ni órdenes para tu sector." />
      ) : null}

      <Rejilla>
      {notificaciones.map((n) => {
        const conf = datosDeConfirmacion(n);
        if (conf) {
          // Si un operador reabrió la consulta llegó otra notificación con otro código: solo vale la
          // más reciente de cada pedido y la anterior se reemplaza.
          const masNueva = notificaciones.some(
            (o) => o.id > n.id && datosDeConfirmacion(o)?.solicitud_id === conf.solicitud_id,
          );
          if (masNueva) return null;
          const consulta = consultas
            .filter((c) => c.solicitud_id === conf.solicitud_id)
            .sort((a, b) => b.id - a.id)[0];
          const pendienteActual = consulta && !consulta.respondida ? consulta : null;
          return (
            <TarjetaConfirmacion
              key={`${n.id}-${pendienteActual?.codigo ?? conf.codigo}`}
              solicitudId={conf.solicitud_id}
              codigo={pendienteActual?.codigo ?? conf.codigo}
              centroNombre={conf.centro_nombre}
              respondida={consulta?.respondida ? consulta.respuesta : null}
              alResponder={() => void recargarConsultas()}
            />
          );
        }
        return (
        <Tarjeta key={n.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
            <Text style={{ fontWeight: "700", color: n.leida ? COLOR.suave : COLOR.primario }}>
              {n.leida ? "Leída" : "Nueva"}
            </Text>
            <Texto suave>{formatearFechaHora(n.creada_en)}</Texto>
          </View>
          <Texto>{n.mensaje}</Texto>
          <Insignia categoria="SIMULADO" />
          {!n.leida ? (
            <Boton titulo="Marcar como leída" variante="secundario" onPress={() => void marcarLeida(n.id)} />
          ) : null}
        </Tarjeta>
        );
      })}
      </Rejilla>
      <EnlaceQueHacer />
    </Pantalla>
  );
}
