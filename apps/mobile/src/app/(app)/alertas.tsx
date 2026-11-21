import { Text } from "react-native";

import type { NombreIcono } from "@/components/Icono";
import { Chip, Chips, type Tono } from "@/components/Piezas";

import { AvisoPanelWeb } from "@/components/AvisoPanelWeb";
import { EnlaceQueHacer } from "@/components/EnlaceQueHacer";
import { TarjetaConfirmacion, useConsultas } from "@/components/TarjetaConfirmacion";
import { Boton, Cargando, COLOR, ErrorCaja, Insignia, Pantalla, Rejilla, Tarjeta, Texto, Titulo, Vacio } from "@/components/ui";
import { TIPO } from "@/components/tema";
import { useAlertas } from "@/lib/AlertasContext";
import { datosDeConfirmacion } from "@/lib/confirmacion";
import { formatearFechaHora, gravedadAviso, type GravedadAviso } from "@/lib/etiquetas";
import { useUsuario } from "@/lib/SesionContext";

const CANAL: Record<string, string> = {
  conectado: "Tiempo real conectado",
  conectando: "Conectando en tiempo real…",
  desconectado: "Sin tiempo real: se consulta cada 30 segundos",
};

/** Severidad con forma + texto + color: evacuación (rojo), preventiva y alerta (ámbar), aviso (neutro). */
const ESTILO_GRAVEDAD: Record<GravedadAviso["nivel"], { tono: Tono; icono: NombreIcono }> = {
  evacuacion: { tono: "error", icono: "alerta" },
  preventiva: { tono: "aviso", icono: "advertencia" },
  alerta: { tono: "aviso", icono: "campana" },
  discrepancia: { tono: "aviso", icono: "advertencia" },
  aviso: { tono: "info", icono: "info" },
};

export default function Alertas() {
  const { estado, notificaciones, canal, recargar, marcarLeida } = useAlertas();
  const { rol } = useUsuario();
  const hayConfirmaciones = notificaciones.some((n) => datosDeConfirmacion(n) !== null);
  const { consultas, recargar: recargarConsultas } = useConsultas(hayConfirmaciones);
  const institucional = rol === "operador" || rol === "decisor" || rol === "admin";
  // Más nuevas primero: el id crece con el tiempo.
  const ordenadas = [...notificaciones].sort((a, b) => b.id - a.id);

  return (
    <Pantalla dosColumnas>
      <Titulo>Alertas y órdenes</Titulo>
      {institucional ? <AvisoPanelWeb /> : null}
      <Texto suave>{CANAL[canal]}. Las órdenes las emite una persona con rol autorizado.</Texto>

      {estado.tipo === "cargando" ? <Cargando texto="Cargando alertas…" /> : null}
      {estado.tipo === "error" ? <ErrorCaja mensaje={estado.mensaje} onReintentar={recargar} /> : null}
      {estado.tipo === "ok" && notificaciones.length === 0 ? (
        <Vacio icono="campana" texto="No tenés alertas ni órdenes para tu sector." />
      ) : null}

      <Rejilla>
      {ordenadas.map((n) => {
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
          <Chips>
            {(() => {
              const g = gravedadAviso(n.mensaje, n.tipo);
              const e = ESTILO_GRAVEDAD[g.nivel];
              return <Chip tono={e.tono} icono={e.icono} texto={g.texto} />;
            })()}
            <Chip tono={n.leida ? "neutro" : "info"} icono={n.leida ? "tilde" : "campana"} texto={n.leida ? "Leída" : "Nueva"} />
          </Chips>
          <Text maxFontSizeMultiplier={1.6} style={[n.leida ? TIPO.cuerpo : TIPO.cuerpoFuerte, { color: COLOR.texto }]}>
            {n.mensaje}
          </Text>
          <Texto suave pequeno>
            {formatearFechaHora(n.creada_en)}
          </Texto>
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
