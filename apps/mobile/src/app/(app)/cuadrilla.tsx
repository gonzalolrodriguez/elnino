import { useCallback, useEffect, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";

import { EnlaceBrujula } from "@/components/EnlaceBrujula";
import { FormCierre } from "@/components/FormCierre";
import { FormParte } from "@/components/FormParte";
import { HistorialPartes } from "@/components/HistorialPartes";
import { SoloRol } from "@/components/SoloRol";
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
import { esCierre, esParte } from "@/lib/cola";
import { useCola } from "@/lib/ColaContext";
import { useCompartirPosicion } from "@/lib/compartirPosicion";
import { mensajeError } from "@/lib/errores";
import { etiquetaEstadoTarea } from "@/lib/etiquetas";
import { descripcionParte, exigeConstancia, type TipoParte } from "@/lib/partes";
import { api, type Tarea } from "@/lib/servicios";

function TarjetaTarea({ tarea, alCambiar, alCerrada }: { tarea: Tarea; alCambiar: (t: Tarea) => void; alCerrada: () => void }) {
  const { items, descartar } = useCola();
  const [cerrando, setCerrando] = useState(false);
  const [parte, setParte] = useState<TipoParte | null>(null);
  const [verPartes, setVerPartes] = useState(false);
  const [versionPartes, setVersionPartes] = useState(0);
  // Cierre ya guardado en el teléfono que todavía no llegó al servidor.
  const cierreLocal = items.find((i) => esCierre(i.datos) && i.datos.tarea_id === tarea.id && i.estado === "pendiente");
  // Partes guardados en el teléfono: pendientes de envío o rechazados por el servidor.
  const partesLocales = items.filter((i) => esParte(i.datos) && i.datos.tarea_id === tarea.id && i.estado !== "enviada");
  const pendientesParte = partesLocales.filter((i) => i.estado === "pendiente");
  const rechazadosParte = partesLocales.filter((i) => i.estado === "rechazada");
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const aplicar = async (cambios: Parameters<typeof api.actualizarTarea>[1]) => {
    setError(null);
    setTrabajando(true);
    try {
      alCambiar(await api.actualizarTarea(tarea.id, cambios));
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setTrabajando(false);
    }
  };

  // Una tarea completada o cancelada ya no admite cambios en su checklist.
  const cerrada = tarea.estado === "completada" || tarea.estado === "cancelada";

  const alternar = (i: number) => {
    const lista = (tarea.checklist ?? []).map((c, j) => (j === i ? { ...c, hecho: !c.hecho } : c));
    void aplicar({ checklist: lista });
  };

  return (
    <Tarjeta>
      <Text style={{ fontWeight: "700", fontSize: 16 }}>{tarea.titulo}</Text>
      <Text style={{ fontWeight: "600", color: tarea.estado === "completada" ? COLOR.ok : COLOR.primario }}>
        {etiquetaEstadoTarea(tarea.estado)}
        {tarea.sector_id ? ` · sector ${tarea.sector_id}` : ""}
      </Text>
      {tarea.requiere_atencion ? (
        <View accessibilityRole="alert" style={{ backgroundColor: COLOR.avisoFondo, borderRadius: 8, padding: 10 }}>
          <Text style={{ color: COLOR.avisoTexto, fontWeight: "700" }}>
            ⚠ Requiere atención: la tarea volvió a pendiente y el operador la va a reprogramar.
          </Text>
        </View>
      ) : null}
      {tarea.descripcion ? <Texto>{tarea.descripcion}</Texto> : null}

      {(tarea.checklist ?? []).map((c, i) => (
        <Pressable
          key={`${tarea.id}-${i}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: c.hecho, disabled: trabajando || cerrada }}
          disabled={trabajando || cerrada}
          onPress={() => alternar(i)}
          style={{ flexDirection: "row", gap: 8, paddingVertical: 10, minHeight: 48, alignItems: "center" }}
        >
          <Text>{c.hecho ? "[x]" : "[ ]"}</Text>
          <Text style={{ flex: 1 }}>{c.item}</Text>
        </Pressable>
      ))}

      {error ? <ErrorCaja mensaje={error} /> : null}
      <FilaBotones>
        {tarea.estado === "pendiente" ? (
          <Boton titulo="Iniciar" onPress={() => void aplicar({ estado: "en_curso" })} cargando={trabajando} />
        ) : null}
        {tarea.estado === "en_curso" ? (
          <Boton titulo="Completar" onPress={() => void aplicar({ estado: "completada" })} cargando={trabajando} />
        ) : null}
      </FilaBotones>
      {cierreLocal ? (
        <Texto>Cierre con constancia guardado en el teléfono: se envía solo cuando haya conexión.</Texto>
      ) : null}
      {pendientesParte.map((i) => (
        <Texto key={i.id} suave>
          Pendiente de envío: {i.datos && esParte(i.datos) ? descripcionParte(i.datos) : "parte"}. Se manda solo cuando haya conexión.
        </Texto>
      ))}
      {rechazadosParte.map((i) => (
        <View key={i.id} style={{ gap: 6 }}>
          <Text style={{ fontWeight: "600" }}>
            {i.datos && esParte(i.datos) ? descripcionParte(i.datos) : "Parte"}: rechazado por el servidor
          </Text>
          {i.ultimoError ? <Text style={{ color: COLOR.error, fontSize: 14 }}>{i.ultimoError}</Text> : null}
          <FilaBotones>
            {exigeConstancia(i.ultimoError) ? (
              <Boton
                titulo="Cerrar con constancia"
                onPress={() => {
                  void descartar(i.id);
                  setCerrando(true);
                }}
              />
            ) : null}
            <Boton titulo="Descartar parte" variante="peligro" onPress={() => void descartar(i.id)} />
          </FilaBotones>
        </View>
      ))}
      {!cerrada && !parte && !cerrando ? (
        <FilaBotones>
          <Boton titulo="Informar avance" variante="secundario" onPress={() => setParte("avance")} />
          <Boton titulo="Informar dificultad" variante="secundario" onPress={() => setParte("dificultad")} />
          <Boton titulo="Terminar tarea" variante="secundario" onPress={() => setParte("resultado")} />
        </FilaBotones>
      ) : null}
      {parte ? (
        <FormParte
          tareaId={tarea.id}
          tipo={parte}
          alEnviado={() => setVersionPartes((v) => v + 1)}
          alCerrar={() => {
            setParte(null);
            alCerrada();
          }}
          alPedirConstancia={() => {
            setParte(null);
            setCerrando(true);
          }}
        />
      ) : null}
      {!cerrada && !cierreLocal && !cerrando ? (
        <Boton titulo="Cerrar con constancia" variante="secundario" onPress={() => setCerrando(true)} />
      ) : null}
      {cerrando ? (
        <FormCierre tareaId={tarea.id} alEnviado={alCerrada} alCerrar={() => setCerrando(false)} />
      ) : null}
      <Enlace titulo={verPartes ? "Ocultar partes" : "Ver partes de la tarea"} onPress={() => setVerPartes((v) => !v)} />
      {verPartes ? <HistorialPartes tareaId={tarea.id} version={versionPartes} /> : null}
      <Insignia categoria="SIMULADO" />
    </Tarjeta>
  );
}

/**
 * Comparte la posición de la cuadrilla con quien pidió ayuda, solo mientras hay una tarea en curso y con
 * esta pantalla abierta (primer plano). Se puede pausar con el interruptor; no se guarda historial.
 */
function CompartirUbicacion() {
  const [compartir, setCompartir] = useState(true);
  const estado = useCompartirPosicion(compartir);
  const motivo =
    estado.fase === "sin_permiso"
      ? "Sin permiso de ubicación: habilitalo en los ajustes del teléfono para compartirla."
      : estado.fase === "sin_tarea"
        ? "Ya no tenés una tarea en curso: dejamos de compartir tu ubicación."
        : estado.fase === "compartiendo" && estado.pendiente
          ? "No pudimos enviar tu última posición; se reintenta sola."
          : null;
  return (
    <Tarjeta>
      <Text style={{ fontWeight: "700", fontSize: 16 }}>
        {compartir && estado.fase === "compartiendo" ? "Compartiendo tu ubicación con el solicitante" : "No estás compartiendo tu ubicación"}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Switch
          value={compartir}
          onValueChange={setCompartir}
          accessibilityLabel="Compartir mi ubicación con quien pidió ayuda"
        />
        <Text style={{ flex: 1 }}>{compartir ? "Pausá el envío con el interruptor." : "Activalo para volver a compartirla."}</Text>
      </View>
      {motivo ? <Text style={{ color: COLOR.avisoTexto }}>{motivo}</Text> : null}
      <Texto suave pequeno>
        Se envía cada 30 segundos mientras la app esté abierta en primer plano (no se usa el segundo plano). La ven quien pidió ayuda y los operadores,
        solo mientras la tarea está en curso; no se guarda un historial.
      </Texto>
      <Insignia categoria="SIMULADO" />
    </Tarjeta>
  );
}

function ListaTareas() {
  const { items, descartar } = useCola();
  const rechazados = items.filter((i) => esCierre(i.datos) && i.estado === "rechazada");
  const [tareas, setTareas] = useState<Tarea[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setTareas((await api.tareas()).tareas);
    } catch (e) {
      setError(mensajeError(e));
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <Pantalla dosColumnas>
      <Titulo>Tareas de la cuadrilla</Titulo>
      <EnlaceBrujula />
      <Texto suave>
        Los cambios de estado requieren conexión. Los partes y el cierre con constancia se pueden cargar
        sin conexión: quedan en el teléfono y se envían solos.
      </Texto>
      {error ? <ErrorCaja mensaje={error} onReintentar={cargar} /> : null}
      {!error && tareas === null ? <Cargando texto="Cargando tareas…" /> : null}
      {tareas && tareas.length === 0 ? <Vacio texto="No tenés tareas asignadas." /> : null}
      {tareas?.some((t) => t.estado === "en_curso") ? <CompartirUbicacion /> : null}
      <Rejilla>
      {(tareas ?? []).map((t) => (
        <TarjetaTarea
          key={t.id}
          tarea={t}
          alCambiar={(nueva) => setTareas((l) => (l ?? []).map((x) => (x.id === nueva.id ? nueva : x)))}
          alCerrada={() => void cargar()}
        />
      ))}
      </Rejilla>
      {rechazados.map((i) => (
        <Tarjeta key={i.id}>
          <Text style={{ fontWeight: "600" }}>
            {i.datos && esCierre(i.datos) ? `Cierre de la tarea #${i.datos.tarea_id}` : "Envío"} rechazado por el servidor
          </Text>
          {i.ultimoError ? <Text style={{ color: COLOR.error, fontSize: 14 }}>{i.ultimoError}</Text> : null}
          <Boton titulo="Descartar" variante="peligro" onPress={() => void descartar(i.id)} />
        </Tarjeta>
      ))}
      <Enlace titulo="Actualizar" onPress={cargar} />
    </Pantalla>
  );
}

export default function Cuadrilla() {
  return (
    <SoloRol roles={["cuadrilla"]}>
      <ListaTareas />
    </SoloRol>
  );
}
