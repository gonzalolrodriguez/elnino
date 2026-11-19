import { useCallback, useEffect, useState } from "react";
import { Text } from "react-native";

import {
  Boton,
  Cargando,
  COLOR,
  Enlace,
  ErrorCaja,
  FilaBotones,
  Insignia,
  Pantalla,
  Rejilla,
  Subtitulo,
  Tarjeta,
  Texto,
  Titulo,
  Vacio,
} from "@/components/ui";
import { hostDeUrl } from "@/lib/cola";
import { useCola } from "@/lib/ColaContext";
import { mensajeError } from "@/lib/errores";
import { etiquetaEstadoSolicitud, etiquetaOrigen, etiquetaTipoSolicitud, formatearFechaHora } from "@/lib/etiquetas";
import { api, type Solicitud } from "@/lib/servicios";

type Carga =
  | { tipo: "cargando" }
  | { tipo: "ok"; filas: Solicitud[] }
  | { tipo: "error"; mensaje: string };

export default function Solicitudes() {
  const { items, otroServidor, reintentar, descartar, sinRed } = useCola();
  const [carga, setCarga] = useState<Carga>({ tipo: "cargando" });

  const cargar = useCallback(async () => {
    try {
      setCarga({ tipo: "ok", filas: (await api.solicitudes()).solicitudes });
    } catch (e) {
      setCarga({ tipo: "error", mensaje: mensajeError(e) });
    }
  }, []);

  // Se vuelve a consultar cuando cambia la cantidad de ítems o cuando alguno pasa a "enviada"
  // (la longitud de la lista no cambia en esa transición).
  const enviadasLocales = items.filter((i) => i.estado === "enviada").length;
  useEffect(() => {
    void cargar();
  }, [cargar, items.length, enviadasLocales]);

  const locales = items.filter((i) => i.estado !== "enviada" && !otroServidor.some((o) => o.id === i.id));

  return (
    <Pantalla dosColumnas>
      <Titulo>Mis solicitudes</Titulo>

      {locales.length > 0 ? (
        <>
          <Subtitulo>En este teléfono ({locales.length})</Subtitulo>
          <Rejilla>
          {locales.map((i) => (
            <Tarjeta key={i.id}>
              <Text style={{ fontWeight: "600" }}>
                {i.estado === "pendiente" ? "Pendiente de envío" : "Rechazada por el servidor"}
              </Text>
              <Texto>
                {etiquetaTipoSolicitud(i.datos.tipo)} · {i.datos.personas} personas · {i.datos.animales} animales
              </Texto>
              {i.datos.referencia_ubicacion ? <Texto suave>Referencia: {i.datos.referencia_ubicacion}</Texto> : null}
              {i.fotoUri && !i.fotoSubida ? <Texto suave>La foto se enviará después del pedido.</Texto> : null}
              {i.ultimoError ? (
                <Text style={{ color: COLOR.error, fontSize: 14 }}>{i.ultimoError}</Text>
              ) : null}
              {i.estado === "pendiente" ? (
                <Texto suave>
                  {sinRed ? "Sin conexión. " : ""}Intentos: {i.intentos}. Se reintenta con espera creciente.
                </Texto>
              ) : null}
              <FilaBotones>
                {i.estado === "pendiente" ? (
                  <Boton titulo="Reintentar ahora" variante="secundario" onPress={() => void reintentar()} />
                ) : null}
                {i.estado === "rechazada" ? (
                  <Boton titulo="Descartar" variante="peligro" onPress={() => void descartar(i.id)} />
                ) : null}
              </FilaBotones>
            </Tarjeta>
          ))}
          </Rejilla>
        </>
      ) : null}

      {otroServidor.length > 0 ? (
        <>
          <Subtitulo>Pendientes para otro servidor ({otroServidor.length})</Subtitulo>
          <Rejilla>
          {otroServidor.map((i) => (
            <Tarjeta key={i.id}>
              <Text style={{ fontWeight: "600" }}>
                Pendientes para otro servidor ({hostDeUrl(i.servidorUrl)})
              </Text>
              <Texto>
                {etiquetaTipoSolicitud(i.datos.tipo)} · {i.datos.personas} personas · {i.datos.animales} animales
              </Texto>
              <Texto suave>
                No se envía a este servidor. Se enviará si volvés a ese servidor con esta cuenta.
              </Texto>
              <Boton titulo="Descartar" variante="peligro" onPress={() => void descartar(i.id)} />
            </Tarjeta>
          ))}
          </Rejilla>
        </>
      ) : null}

      <Subtitulo>Enviadas</Subtitulo>
      {carga.tipo === "cargando" ? <Cargando texto="Cargando solicitudes…" /> : null}
      {carga.tipo === "error" ? <ErrorCaja mensaje={carga.mensaje} onReintentar={cargar} /> : null}
      {carga.tipo === "ok" && carga.filas.length === 0 ? (
        <Vacio texto="Todavía no enviaste solicitudes." />
      ) : null}
      {carga.tipo === "ok" ? (
        <Rejilla>
          {carga.filas.map((s) => (
            <Tarjeta key={s.id}>
              <Text style={{ fontWeight: "700" }}>
                #{s.id} · {etiquetaEstadoSolicitud(s.estado)}
              </Text>
              <Texto>
                {etiquetaTipoSolicitud(s.tipo)} · {s.personas} personas · {s.animales} animales
                {s.sector_id ? ` · sector ${s.sector_id}` : ""}
              </Texto>
              {s.texto ? <Texto suave>{s.texto}</Texto> : null}
              {s.referencia_ubicacion ? <Texto suave>Referencia: {s.referencia_ubicacion}</Texto> : null}
              {s.ubicacion_aproximada ? (
                <Texto>Ubicación aproximada: un operador la va a verificar</Texto>
              ) : null}
              {s.requiere_verificacion && !s.ubicacion_aproximada ? (
                <Texto>Un operador va a verificar este pedido</Texto>
              ) : null}
              <Texto suave>
                {etiquetaOrigen(s.origen)} · actualizada el {formatearFechaHora(s.actualizado_en)}
              </Texto>
              <Insignia categoria={s.categoria} />
            </Tarjeta>
          ))}
        </Rejilla>
      ) : null}
      <Enlace titulo="Actualizar" onPress={cargar} />
    </Pantalla>
  );
}
