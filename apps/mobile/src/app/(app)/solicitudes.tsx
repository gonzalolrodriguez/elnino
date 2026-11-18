import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";

import { Boton, Cargando, COLOR, ErrorCaja, Insignia, Pantalla, Tarjeta, Texto, Titulo, Vacio } from "@/components/ui";
import { useCola } from "@/lib/ColaContext";
import { mensajeError } from "@/lib/errores";
import { api, type Solicitud } from "@/lib/servicios";

const ETIQUETA_ESTADO: Record<Solicitud["estado"], string> = {
  recibida: "Recibida",
  verificada: "Verificada",
  asignada: "Asignada a una cuadrilla",
  en_curso: "En curso",
  resuelta: "Resuelta",
};

type Carga =
  | { tipo: "cargando" }
  | { tipo: "ok"; filas: Solicitud[] }
  | { tipo: "error"; mensaje: string };

export default function Solicitudes() {
  const { items, reintentar, descartar, sinRed } = useCola();
  const [carga, setCarga] = useState<Carga>({ tipo: "cargando" });

  const cargar = useCallback(async () => {
    try {
      setCarga({ tipo: "ok", filas: (await api.solicitudes()).solicitudes });
    } catch (e) {
      setCarga({ tipo: "error", mensaje: mensajeError(e) });
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar, items.length]);

  const locales = items.filter((i) => i.estado !== "enviada");

  return (
    <Pantalla>
      <Titulo>Mis solicitudes</Titulo>

      {locales.length > 0 ? (
        <>
          <Text style={{ fontWeight: "700" }}>En este teléfono ({locales.length})</Text>
          {locales.map((i) => (
            <Tarjeta key={i.id}>
              <Text style={{ fontWeight: "600" }}>
                {i.estado === "pendiente" ? "Pendiente de envío" : "Rechazada por el servidor"}
              </Text>
              <Texto>
                {i.datos.tipo} · {i.datos.personas} personas · {i.datos.animales} animales
              </Texto>
              {i.fotoUri && !i.fotoSubida ? <Texto suave>La foto se enviará después del pedido.</Texto> : null}
              {i.ultimoError ? (
                <Text style={{ color: COLOR.error, fontSize: 13 }}>{i.ultimoError}</Text>
              ) : null}
              {i.estado === "pendiente" ? (
                <Texto suave>
                  {sinRed ? "Sin conexión. " : ""}Intentos: {i.intentos}. Se reintenta con espera creciente.
                </Texto>
              ) : null}
              <View style={{ flexDirection: "row", gap: 8 }}>
                {i.estado === "pendiente" ? (
                  <Boton titulo="Reintentar ahora" variante="secundario" onPress={() => void reintentar()} />
                ) : null}
                {i.estado === "rechazada" ? (
                  <Boton titulo="Descartar" variante="peligro" onPress={() => void descartar(i.id)} />
                ) : null}
              </View>
            </Tarjeta>
          ))}
        </>
      ) : null}

      <Text style={{ fontWeight: "700" }}>Enviadas</Text>
      {carga.tipo === "cargando" ? <Cargando texto="Cargando solicitudes…" /> : null}
      {carga.tipo === "error" ? <ErrorCaja mensaje={carga.mensaje} onReintentar={cargar} /> : null}
      {carga.tipo === "ok" && carga.filas.length === 0 ? (
        <Vacio texto="Todavía no enviaste solicitudes." />
      ) : null}
      {carga.tipo === "ok"
        ? carga.filas.map((s) => (
            <Tarjeta key={s.id}>
              <Text style={{ fontWeight: "700" }}>
                #{s.id} · {ETIQUETA_ESTADO[s.estado]}
              </Text>
              <Texto>
                {s.tipo} · {s.personas} personas · {s.animales} animales
                {s.sector_id ? ` · sector ${s.sector_id}` : ""}
              </Texto>
              {s.texto ? <Texto suave>{s.texto}</Texto> : null}
              <Texto suave>{new Date(s.actualizado_en).toLocaleString("es-AR")}</Texto>
              <Insignia categoria={s.categoria} />
            </Tarjeta>
          ))
        : null}
      <Boton titulo="Actualizar" variante="secundario" onPress={cargar} />
    </Pantalla>
  );
}
