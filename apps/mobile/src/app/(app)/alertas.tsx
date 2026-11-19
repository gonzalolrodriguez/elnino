import { Text, View } from "react-native";

import { Boton, Cargando, COLOR, ErrorCaja, Insignia, Pantalla, Rejilla, Tarjeta, Texto, Titulo, Vacio } from "@/components/ui";
import { useAlertas } from "@/lib/AlertasContext";

const CANAL: Record<string, string> = {
  conectado: "Tiempo real conectado",
  conectando: "Conectando en tiempo real…",
  desconectado: "Sin tiempo real: se consulta cada 30 segundos",
};

export default function Alertas() {
  const { estado, notificaciones, canal, recargar, marcarLeida } = useAlertas();

  return (
    <Pantalla dosColumnas>
      <Titulo>Alertas y órdenes</Titulo>
      <Texto suave>{CANAL[canal]}. Las órdenes las emite una persona con rol autorizado.</Texto>

      {estado.tipo === "cargando" ? <Cargando texto="Cargando alertas…" /> : null}
      {estado.tipo === "error" ? <ErrorCaja mensaje={estado.mensaje} onReintentar={recargar} /> : null}
      {estado.tipo === "ok" && notificaciones.length === 0 ? (
        <Vacio texto="No tenés alertas ni órdenes para tu sector." />
      ) : null}

      <Rejilla>
      {notificaciones.map((n) => (
        <Tarjeta key={n.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
            <Text style={{ fontWeight: "700", color: n.leida ? COLOR.suave : COLOR.primario }}>
              {n.leida ? "Leída" : "Nueva"}
            </Text>
            <Texto suave>{new Date(n.creada_en).toLocaleString("es-AR")}</Texto>
          </View>
          <Texto>{n.mensaje}</Texto>
          <Insignia categoria="SIMULADO" />
          {!n.leida ? (
            <Boton titulo="Marcar como leída" variante="secundario" onPress={() => void marcarLeida(n.id)} />
          ) : null}
        </Tarjeta>
      ))}
      </Rejilla>
    </Pantalla>
  );
}
