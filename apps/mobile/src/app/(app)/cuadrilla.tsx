import { useCallback, useEffect, useState } from "react";
import { Pressable, Text } from "react-native";

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
import { mensajeError } from "@/lib/errores";
import { etiquetaEstadoTarea } from "@/lib/etiquetas";
import { api, type Tarea } from "@/lib/servicios";

function TarjetaTarea({ tarea, alCambiar }: { tarea: Tarea; alCambiar: (t: Tarea) => void }) {
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
      <Insignia categoria="SIMULADO" />
    </Tarjeta>
  );
}

function ListaTareas() {
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
      <Texto suave>
        Los cambios se guardan en el servidor al instante y requieren conexión.
      </Texto>
      {error ? <ErrorCaja mensaje={error} onReintentar={cargar} /> : null}
      {!error && tareas === null ? <Cargando texto="Cargando tareas…" /> : null}
      {tareas && tareas.length === 0 ? <Vacio texto="No tenés tareas asignadas." /> : null}
      <Rejilla>
      {(tareas ?? []).map((t) => (
        <TarjetaTarea
          key={t.id}
          tarea={t}
          alCambiar={(nueva) => setTareas((l) => (l ?? []).map((x) => (x.id === nueva.id ? nueva : x)))}
        />
      ))}
      </Rejilla>
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
