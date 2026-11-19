import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";

import { AvisoPanelWeb } from "@/components/AvisoPanelWeb";
import { SoloRol } from "@/components/SoloRol";
import { Cargando, COLOR, ErrorCaja, Insignia, Pantalla, Rejilla, Subtitulo, Tarjeta, Texto, Titulo } from "@/components/ui";
import { guardarCache, leerCache } from "@/lib/cacheLocal";
import { mensajeError } from "@/lib/errores";
import { etiquetaEstadoSector, etiquetaEstadoEvacuacionCorta, etiquetaEstadoSolicitud, etiquetaEstadoTarea, formatearFechaHora } from "@/lib/etiquetas";
import { fechaCorta, metros, numeroAR, posicionesBarra, textoTendencia, textoTiempoAUmbral } from "@/lib/panel";
import { obtenerUrlServidor } from "@/lib/servidor";
import { api, type PanelResumen } from "@/lib/servicios";
import { useUsuario } from "@/lib/SesionContext";

type Vista =
  | { tipo: "cargando" }
  | { tipo: "ok"; resumen: PanelResumen; actualizado: number; desdeCache: boolean }
  | { tipo: "error"; mensaje: string };

const COLOR_ESTADO = { normal: COLOR.ok, en_riesgo: COLOR.avisoTexto, comprometido: COLOR.error } as const;

function BarraRio({ rio }: { rio: PanelResumen["rio"] }) {
  const p = posicionesBarra(rio);
  if (!p) return null;
  const pct = (n: number) => `${Math.round(n * 100)}%` as `${number}%`;
  const etiqueta = `Nivel del río ${metros(rio.altura_m ?? 0)}, alerta en ${metros(rio.umbral_alerta_m ?? 0)}, evacuación en ${metros(rio.umbral_evacuacion_m ?? 0)}`;
  return (
    <View accessible accessibilityLabel={etiqueta}>
      <View style={{ height: 14, borderRadius: 7, backgroundColor: COLOR.borde, overflow: "hidden" }}>
        <View style={{ width: pct(p.nivel), height: 14, backgroundColor: COLOR.primario }} />
      </View>
      <View style={{ height: 10 }}>
        <View style={{ position: "absolute", left: pct(p.alerta), width: 3, height: 10, top: -14, backgroundColor: COLOR.avisoTexto }} />
        <View style={{ position: "absolute", left: pct(p.evacuacion), width: 3, height: 10, top: -14, backgroundColor: COLOR.error }} />
      </View>
      <Texto suave pequeno>
        Marcas: alerta {metros(rio.umbral_alerta_m ?? 0)} (naranja) · evacuación {metros(rio.umbral_evacuacion_m ?? 0)} (rojo)
      </Texto>
    </View>
  );
}

function TarjetaRio({ rio }: { rio: PanelResumen["rio"] }) {
  const tendencia = textoTendencia(rio);
  return (
    <Tarjeta>
      <Subtitulo>Río Paraguay en Puerto Formosa</Subtitulo>
      {!rio.disponible ? (
        <Texto suave>No hay una lectura del río disponible.</Texto>
      ) : (
        <>
          <Text style={{ fontSize: 28, fontWeight: "800", color: COLOR.texto }}>{metros(rio.altura_m ?? 0)}</Text>
          <Texto suave>Lectura del {fechaCorta(rio.fecha_lectura)}</Texto>
          <BarraRio rio={rio} />
          {rio.distancia_a_alerta_m !== undefined ? (
            <Texto>
              {rio.distancia_a_alerta_m > 0
                ? `Faltan ${metros(rio.distancia_a_alerta_m)} para la alerta`
                : "Por encima del umbral de alerta"}
              {rio.distancia_a_evacuacion_m !== undefined && rio.distancia_a_evacuacion_m > 0
                ? ` y ${metros(rio.distancia_a_evacuacion_m)} para la evacuación.`
                : "."}
            </Texto>
          ) : null}
        </>
      )}
      <Insignia categoria={rio.categoria} />
      <Texto suave pequeno>
        Fuente: {rio.fuente}
      </Texto>
      {rio.disponible ? (
        <>
          {tendencia ? <Texto>{tendencia}</Texto> : null}
          {(rio.tiempo_a_umbrales ?? []).length > 0 ? (
            <>
              <Subtitulo>Tiempo estimado hasta cada umbral</Subtitulo>
              {(rio.tiempo_a_umbrales ?? []).map((t) => (
                <Texto key={t.objetivo}>{textoTiempoAUmbral(t)}</Texto>
              ))}
              <Insignia categoria={rio.categoria_proyeccion ?? "SIMULADO"} />
              {rio.supuesto_proyeccion ? (
                <Texto suave pequeno>
                  Supuesto: {rio.supuesto_proyeccion}
                </Texto>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </Tarjeta>
  );
}

function Sectores({ r }: { r: PanelResumen["sectores"] }) {
  return (
    <>
      <Subtitulo>Sectores</Subtitulo>
      {r.items.length === 0 ? <Texto suave>No hay sectores cargados.</Texto> : null}
      <Rejilla>
        {r.items.map((s) => {
          const abiertos = s.accesos.filter((a) => a.estado === "transitable").length;
          return (
            <Tarjeta key={s.id}>
              <Text style={{ fontWeight: "700", fontSize: 16, color: COLOR_ESTADO[s.estado] ?? COLOR.texto }}>
                {s.nombre}: {etiquetaEstadoSector(s.estado)}
                {s.aislado ? " · aislado" : ""}
              </Text>
              <Texto>Margen al compromiso: {metros(s.margen_a_compromiso_m)}</Texto>
              <Texto>
                Personas: {numeroAR(s.personas_k10 ?? 0, 0)} (modelo) · {numeroAR(s.personas_registradas ?? 0, 0)} registradas
              </Texto>
              <Texto>Animales expuestos: {numeroAR(s.animales_expuestos ?? 0, 0)}</Texto>
              <Texto suave>
                Accesos transitables: {abiertos} de {s.accesos.length}
              </Texto>
              <Insignia categoria={r.categoria} />
            </Tarjeta>
          );
        })}
      </Rejilla>
    </>
  );
}

function Solicitudes({ r }: { r: PanelResumen["solicitudes"] }) {
  const estados = Object.entries(r.por_estado);
  return (
    <Tarjeta>
      <Subtitulo>Solicitudes de asistencia</Subtitulo>
      <Texto>Total: {numeroAR(r.total, 0)}</Texto>
      {estados.map(([e, n]) => (
        <Texto key={e} suave>
          {etiquetaEstadoSolicitud(e)}: {numeroAR(n, 0)}
        </Texto>
      ))}
      {typeof r.a_verificar === "number" ? <Texto>A verificar por un operador: {numeroAR(r.a_verificar, 0)}</Texto> : null}
      {typeof r.recibidas_mas_antigua_min === "number" ? (
        <Texto>Recibida más antigua sin atender: {numeroAR(r.recibidas_mas_antigua_min, 0)} min</Texto>
      ) : null}
      <Insignia categoria={r.categoria} />
    </Tarjeta>
  );
}

function Centros({ r }: { r: PanelResumen["centros"] }) {
  return (
    <>
      <Subtitulo>Centros de recepción</Subtitulo>
      {r.items.length === 0 ? <Texto suave>No hay centros cargados.</Texto> : null}
      <Rejilla>
        {r.items.map((c) => (
          <Tarjeta key={c.nombre}>
            <Text style={{ fontWeight: "600", color: COLOR.texto }}>{c.nombre}</Text>
            <Texto>
              Ocupación: {numeroAR(c.ocupacion ?? 0, 0)} de {c.capacidad_personas === null ? "—" : numeroAR(c.capacidad_personas, 0)}
              {c.ocupacion_pct === null ? "" : ` (${numeroAR(c.ocupacion_pct, 0)} %)`}
            </Texto>
            <Insignia categoria={r.categoria} />
          </Tarjeta>
        ))}
      </Rejilla>
    </>
  );
}

function Cuadrillas({ r }: { r: NonNullable<PanelResumen["cuadrillas"]> }) {
  if (r.items.length === 0) return null;
  return (
    <>
      <Subtitulo>Cuadrillas</Subtitulo>
      <Rejilla>
        {r.items.map((c) => (
          <Tarjeta key={c.nombre}>
            <Text style={{ fontWeight: "600", color: COLOR.texto }}>{c.nombre}</Text>
            <Texto suave>
              {Object.entries(c.tareas)
                .filter(([, n]) => (n ?? 0) > 0)
                .map(([e, n]) => `${etiquetaEstadoTarea(e)}: ${numeroAR(n ?? 0, 0)}`)
                .join(" · ") || "Sin tareas"}
            </Texto>
            <Insignia categoria={r.categoria} />
          </Tarjeta>
        ))}
      </Rejilla>
    </>
  );
}

/** Bloque `evacuaciones` (constancias de cierre y confirmaciones): se muestra solo si el backend lo envía. */
function Evacuaciones({ b }: { b: NonNullable<PanelResumen["evacuaciones"]> }) {
  const estados = Object.entries(b.por_estado ?? {});
  const animales = Object.entries(b.animales_trasladados ?? {}).filter(([, n]) => n > 0);
  return (
    <Tarjeta>
      <Subtitulo>Evacuaciones</Subtitulo>
      <Texto>Total: {numeroAR(b.total ?? 0, 0)}</Texto>
      {estados.map(([e, n]) => (
        <Texto key={e} suave>
          {etiquetaEstadoEvacuacionCorta(e)}: {numeroAR(n, 0)}
        </Texto>
      ))}
      {typeof b.verificadas_pct === "number" ? <Texto>Verificadas por la persona evacuada: {numeroAR(b.verificadas_pct, 0)} %</Texto> : null}
      <Texto>Discrepancias abiertas: {numeroAR(b.discrepancias_abiertas ?? 0, 0)}</Texto>
      <Texto>Personas trasladadas: {numeroAR(b.personas_trasladadas ?? 0, 0)}</Texto>
      <Texto>
        Animales trasladados: {numeroAR(b.animales_trasladados_total ?? 0, 0)}
        {animales.length > 0 ? ` (${animales.map(([e, n]) => `${e} ${numeroAR(n, 0)}`).join(", ")})` : ""}
      </Texto>
      <Insignia categoria={b.categoria ?? "SIMULADO"} />
    </Tarjeta>
  );
}

function Frescura({ r }: { r: PanelResumen }) {
  const f = r.frescura;
  return (
    <Tarjeta>
      <Subtitulo>Frescura de los datos</Subtitulo>
      <Texto suave>Última lectura del río: {fechaCorta(f?.rio_ultima_lectura)}</Texto>
      <Texto suave>Sectores (K10): {fechaCorta(f?.k10_sectores)}</Texto>
      <Texto suave>
        Última lectura de lluvia: {f?.lluvia_ultima_lectura ? fechaCorta(f.lluvia_ultima_lectura) : "sin dato de lluvia"}
      </Texto>
      <Texto suave>Fecha de corte de los datos: {fechaCorta(f?.fecha_corte)}</Texto>
      <Insignia categoria={r.categoria} />
    </Tarjeta>
  );
}

function ContenidoMonitor() {
  const usuario = useUsuario();
  const [vista, setVista] = useState<Vista>({ tipo: "cargando" });
  const [refrescando, setRefrescando] = useState(false);
  const clave = `panel_resumen:${usuario.id}:${obtenerUrlServidor()}`;

  const cargar = useCallback(async () => {
    try {
      const resumen = await api.panelResumen();
      const ahora = Date.now();
      setVista({ tipo: "ok", resumen, actualizado: ahora, desdeCache: false });
      await guardarCache(clave, resumen, ahora);
    } catch (e) {
      const guardado = await leerCache<PanelResumen>(clave);
      setVista(
        guardado
          ? { tipo: "ok", resumen: guardado.valor, actualizado: guardado.guardadoEn, desdeCache: true }
          : { tipo: "error", mensaje: mensajeError(e) },
      );
    }
  }, [clave]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  return (
    <Pantalla dosColumnas alRefrescar={() => void refrescar()} refrescando={refrescando}>
      <Titulo>Monitor</Titulo>
      <AvisoPanelWeb />
      {vista.tipo === "cargando" ? <Cargando texto="Cargando el resumen del panel…" /> : null}
      {vista.tipo === "error" ? <ErrorCaja mensaje={vista.mensaje} onReintentar={() => void cargar()} /> : null}
      {vista.tipo === "ok" ? (
        <>
          <Texto suave pequeno>
            {vista.desdeCache
              ? `Sin conexión: se muestra lo último guardado, actualizado el ${formatearFechaHora(vista.actualizado)}.`
              : `Actualizado el ${formatearFechaHora(vista.actualizado)}.`}
          </Texto>
          <TarjetaRio rio={vista.resumen.rio} />
          <Sectores r={vista.resumen.sectores} />
          <Solicitudes r={vista.resumen.solicitudes} />
          <Centros r={vista.resumen.centros} />
          {vista.resumen.cuadrillas ? <Cuadrillas r={vista.resumen.cuadrillas} /> : null}
          {vista.resumen.evacuaciones ? <Evacuaciones b={vista.resumen.evacuaciones} /> : null}
          <Frescura r={vista.resumen} />
        </>
      ) : null}
    </Pantalla>
  );
}

export default function Monitor() {
  return (
    <SoloRol roles={["operador", "decisor"]}>
      <ContenidoMonitor />
    </SoloRol>
  );
}
