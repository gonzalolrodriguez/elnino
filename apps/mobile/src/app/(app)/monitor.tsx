import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";

import { AvisoPanelWeb } from "@/components/AvisoPanelWeb";
import { SoloRol } from "@/components/SoloRol";
import { Icono } from "@/components/Icono";
import { Chip, Chips, Cifra, Disco, Encabezado, FilaKpi, Kpi, TONOS, type Tono } from "@/components/Piezas";
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

const TONO_ESTADO: Record<string, { tono: Tono; icono: "tilde" | "advertencia" | "alerta" }> = {
  normal: { tono: "ok", icono: "tilde" },
  en_riesgo: { tono: "aviso", icono: "advertencia" },
  comprometido: { tono: "error", icono: "alerta" },
};

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
      <View style={{ marginTop: 6 }}>
        <Chips>
          <Chip tono="aviso" icono="advertencia" texto={`Alerta ${metros(rio.umbral_alerta_m ?? 0)}`} />
          <Chip tono="error" icono="alerta" texto={`Evacuación ${metros(rio.umbral_evacuacion_m ?? 0)}`} />
        </Chips>
      </View>
    </View>
  );
}

function TarjetaRio({ rio }: { rio: PanelResumen["rio"] }) {
  const tendencia = textoTendencia(rio);
  return (
    <Tarjeta>
      <Encabezado icono="gota">Río Paraguay en Puerto Formosa</Encabezado>
      {!rio.disponible ? (
        <Texto suave>No hay una lectura del río disponible.</Texto>
      ) : (
        <>
          <Cifra rotulo="Nivel del río" valor={metros(rio.altura_m ?? 0)} nota={`Lectura del ${fechaCorta(rio.fecha_lectura)}`} />
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Disco tono={(TONO_ESTADO[s.estado] ?? TONO_ESTADO.normal).tono} icono={(TONO_ESTADO[s.estado] ?? TONO_ESTADO.normal).icono} tam={36} />
                <Text
                  maxFontSizeMultiplier={1.6}
                  style={{ flex: 1, fontWeight: "700", fontSize: 17, lineHeight: 23, color: TONOS[(TONO_ESTADO[s.estado] ?? TONO_ESTADO.normal).tono].texto }}
                >
                  {s.nombre}: {etiquetaEstadoSector(s.estado)}
                  {s.aislado ? " · aislado" : ""}
                </Text>
              </View>
              <FilaKpi>
                <Kpi rotulo="Margen al compromiso" valor={metros(s.margen_a_compromiso_m)} icono="gota" />
                <Kpi rotulo="Personas (modelo)" valor={numeroAR(s.personas_k10 ?? 0, 0)} icono="personas" />
                <Kpi rotulo="Personas registradas" valor={numeroAR(s.personas_registradas ?? 0, 0)} icono="persona" />
                <Kpi rotulo="Animales expuestos" valor={numeroAR(s.animales_expuestos ?? 0, 0)} icono="mascota" />
              </FilaKpi>
              <Chip tono={abiertos === s.accesos.length ? "ok" : "aviso"} icono="camion" texto={`Accesos transitables: ${abiertos} de ${s.accesos.length}`} />
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
      <Encabezado icono="bandeja">Solicitudes de asistencia</Encabezado>
      <FilaKpi>
        <Kpi rotulo="Total" valor={numeroAR(r.total, 0)} tono="info" icono="bandeja" />
        {estados.map(([e, n]) => (
          <Kpi key={e} rotulo={etiquetaEstadoSolicitud(e)} valor={numeroAR(n, 0)} />
        ))}
        {typeof r.a_verificar === "number" ? (
          <Kpi rotulo="A verificar por un operador" valor={numeroAR(r.a_verificar, 0)} tono={r.a_verificar > 0 ? "aviso" : "neutro"} icono="escudo" />
        ) : null}
        {typeof r.recibidas_mas_antigua_min === "number" ? (
          <Kpi rotulo="Recibida más antigua sin atender" valor={`${numeroAR(r.recibidas_mas_antigua_min, 0)} min`} tono="aviso" icono="reloj" />
        ) : null}
      </FilaKpi>
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Icono nombre="casa" tam={20} color={COLOR.primario} />
              <Text maxFontSizeMultiplier={1.6} style={{ flex: 1, fontWeight: "700", fontSize: 16, color: COLOR.texto }}>
                {c.nombre}
              </Text>
            </View>
            <Texto>
              Ocupación: {numeroAR(c.ocupacion ?? 0, 0)} de {c.capacidad_personas === null ? "—" : numeroAR(c.capacidad_personas, 0)}
              {c.ocupacion_pct === null ? "" : ` (${numeroAR(c.ocupacion_pct, 0)} %)`}
            </Texto>
            {c.ocupacion_pct !== null ? (
              <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ height: 8, borderRadius: 4, backgroundColor: COLOR.borde, overflow: "hidden" }}>
                <View
                  style={{
                    height: 8,
                    borderRadius: 4,
                    width: `${Math.min(100, Math.max(0, Math.round(c.ocupacion_pct)))}%`,
                    backgroundColor: c.ocupacion_pct >= 90 ? COLOR.error : c.ocupacion_pct >= 70 ? COLOR.aviso : COLOR.primario,
                  }}
                />
              </View>
            ) : null}
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Icono nombre="tarea" tam={20} color={COLOR.primario} />
              <Text maxFontSizeMultiplier={1.6} style={{ flex: 1, fontWeight: "700", fontSize: 16, color: COLOR.texto }}>
                {c.nombre}
              </Text>
            </View>
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
      <Encabezado icono="reloj">Frescura de los datos</Encabezado>
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
