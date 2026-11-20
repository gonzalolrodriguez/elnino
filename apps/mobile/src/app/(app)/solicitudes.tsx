import { useCallback, useEffect, useState } from "react";
import { Text } from "react-native";

import { Aviso, Chip, Chips, Encabezado } from "@/components/Piezas";

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
  Tarjeta,
  Texto,
  Titulo,
  Vacio,
} from "@/components/ui";
import { FilaHistorial, TarjetaPedido } from "@/components/MisPedidos";
import { TIPO } from "@/components/tema";
import { guardarCache, leerCache } from "@/lib/cacheLocal";
import { esAvisoLeido, esCierre, esParte, esSolicitud, hostDeUrl } from "@/lib/cola";
import { useCola } from "@/lib/ColaContext";
import { mensajeError } from "@/lib/errores";
import { descripcionItemCola, etiquetaEstadoSolicitud, etiquetaOrigen, etiquetaTipoSolicitud, formatearFechaHora } from "@/lib/etiquetas";
import { esPedidoActivo } from "@/lib/pedidos";
import { obtenerUrlServidor } from "@/lib/servidor";
import { api, type PedidoCiudadano, type Solicitud } from "@/lib/servicios";
import { useUsuario } from "@/lib/SesionContext";

type Carga =
  | { tipo: "cargando" }
  | { tipo: "ok"; filas: Solicitud[] }
  | { tipo: "error"; mensaje: string };

type VistaPedidos = { items: PedidoCiudadano[]; actualizado: number; desdeCache: boolean };

export default function Solicitudes() {
  const { items, otroServidor, reintentar, descartar, sinRed } = useCola();
  const usuario = useUsuario();
  const clave = `mis_pedidos:${usuario.id}:${obtenerUrlServidor()}`;
  const [carga, setCarga] = useState<Carga>({ tipo: "cargando" });
  const [pedidos, setPedidos] = useState<VistaPedidos | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  // Vista del servidor (`GET /mi/pedidos`); sin conexión, la última copia guardada con su fecha. Si el
  // servidor no la ofrece (versión anterior) y no hay copia, se usa la lista simple de `/solicitudes`.
  const cargar = useCallback(async () => {
    setRefrescando(true);
    try {
      const r = await api.misPedidos();
      const ahora = Date.now();
      setPedidos({ items: r.items, actualizado: ahora, desdeCache: false });
      await guardarCache(clave, r.items, ahora);
    } catch {
      const guardado = await leerCache<PedidoCiudadano[]>(clave);
      if (guardado && Array.isArray(guardado.valor)) {
        setPedidos({ items: guardado.valor, actualizado: guardado.guardadoEn, desdeCache: true });
      } else {
        setPedidos(null);
        try {
          setCarga({ tipo: "ok", filas: (await api.solicitudes()).solicitudes });
        } catch (e) {
          setCarga({ tipo: "error", mensaje: mensajeError(e) });
        }
      }
    } finally {
      setRefrescando(false);
    }
  }, [clave]);

  // Se vuelve a consultar cuando cambia la cantidad de ítems o cuando alguno pasa a "enviada"
  // (la longitud de la lista no cambia en esa transición).
  const enviadasLocales = items.filter((i) => i.estado === "enviada").length;
  useEffect(() => {
    void cargar();
  }, [cargar, items.length, enviadasLocales]);

  // Los cierres con constancia pertenecen a la pestaña de la cuadrilla.
  const locales = items.filter((i) => i.estado !== "enviada" && !esCierre(i.datos) && !esParte(i.datos) && !esAvisoLeido(i.datos) && !otroServidor.some((o) => o.id === i.id));

  return (
    <Pantalla dosColumnas alRefrescar={() => void cargar()} refrescando={refrescando}>
      <Titulo>Mis pedidos</Titulo>

      {locales.length > 0 ? (
        <>
          <Encabezado icono="reloj">En este teléfono ({locales.length})</Encabezado>
          <Rejilla>
          {locales.map((i) => (
            <Tarjeta key={i.id}>
              <Chips>
                <Chip
                  tono={i.estado === "pendiente" ? "aviso" : "error"}
                  icono={i.estado === "pendiente" ? "reloj" : "alerta"}
                  texto={i.estado === "pendiente" ? "Pendiente de envío" : "Rechazada por el servidor"}
                />
              </Chips>
              <Texto>{descripcionItemCola(i.datos)}</Texto>
              {esSolicitud(i.datos) && i.datos.referencia_ubicacion ? (
                <Texto suave>Referencia: {i.datos.referencia_ubicacion}</Texto>
              ) : null}
              {esSolicitud(i.datos) && i.datos.lat === undefined ? (
                <Aviso tono="info" icono="punto">
                  Ubicación aproximada: un operador la va a verificar
                </Aviso>
              ) : null}
              {i.fotoUri && !i.fotoSubida ? <Texto suave>La foto se enviará después del pedido.</Texto> : null}
              {i.ultimoError ? (
                <Text style={{ ...TIPO.etiqueta, color: COLOR.errorTexto }}>{i.ultimoError}</Text>
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
          <Encabezado icono="info">Pendientes para otro servidor ({otroServidor.length})</Encabezado>
          <Rejilla>
          {otroServidor.map((i) => (
            <Tarjeta key={i.id}>
              <Text style={{ fontWeight: "600" }}>
                Pendientes para otro servidor ({hostDeUrl(i.servidorUrl)})
              </Text>
              <Texto>{descripcionItemCola(i.datos)}</Texto>
              <Texto suave>
                No se envía a este servidor. Se enviará si volvés a ese servidor con esta cuenta.
              </Texto>
              <Boton titulo="Descartar" variante="peligro" onPress={() => void descartar(i.id)} />
            </Tarjeta>
          ))}
          </Rejilla>
        </>
      ) : null}

      {pedidos ? (
        <>
          <Texto suave pequeno>
            {pedidos.desdeCache
              ? `Sin conexión: se muestra lo último guardado, actualizado el ${formatearFechaHora(pedidos.actualizado)}.`
              : `Actualizado el ${formatearFechaHora(pedidos.actualizado)}.`}
          </Texto>
          {pedidos.items.length === 0 ? <Vacio texto="Todavía no enviaste solicitudes." /> : null}
          {pedidos.items.filter(esPedidoActivo).map((p) => (
            <TarjetaPedido key={p.id} pedido={p} />
          ))}
          {pedidos.items.some((p) => !esPedidoActivo(p)) ? (
            <>
              <Encabezado icono="reloj">Anteriores</Encabezado>
              <Rejilla>
                {pedidos.items.filter((p) => !esPedidoActivo(p)).map((p) => (
                  <FilaHistorial key={p.id} pedido={p} />
                ))}
              </Rejilla>
            </>
          ) : null}
        </>
      ) : (
        <Encabezado icono="bandeja">Enviadas</Encabezado>
      )}
      {!pedidos && carga.tipo === "cargando" ? <Cargando texto="Cargando solicitudes…" /> : null}
      {!pedidos && carga.tipo === "error" ? <ErrorCaja mensaje={carga.mensaje} onReintentar={cargar} /> : null}
      {!pedidos && carga.tipo === "ok" && carga.filas.length === 0 ? (
        <Vacio texto="Todavía no enviaste solicitudes." />
      ) : null}
      {!pedidos && carga.tipo === "ok" ? (
        <Rejilla>
          {carga.filas.map((s) => (
            <Tarjeta key={s.id}>
              <Text style={{ ...TIPO.subtitulo, color: COLOR.texto }}>#{s.id}</Text>
              <Chips>
                <Chip icono={s.estado === "resuelta" ? "tilde" : "reloj"} tono={s.estado === "resuelta" ? "ok" : "info"} texto={etiquetaEstadoSolicitud(s.estado)} />
              </Chips>
              <Texto>
                {etiquetaTipoSolicitud(s.tipo)} · {s.personas} personas · {s.animales} animales
                {s.sector_id ? ` · sector ${s.sector_id}` : ""}
              </Texto>
              {s.texto ? <Texto suave>{s.texto}</Texto> : null}
              {s.referencia_ubicacion ? <Texto suave>Referencia: {s.referencia_ubicacion}</Texto> : null}
              {s.ubicacion_aproximada ? (
                <Aviso tono="info" icono="punto">
                  Ubicación aproximada: un operador la va a verificar
                </Aviso>
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
