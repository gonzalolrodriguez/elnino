import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { SoloRol } from "@/components/SoloRol";
import { Boton, Cargando, COLOR, ErrorCaja, Insignia, Pantalla, Tarjeta, Texto, Titulo, Vacio } from "@/components/ui";
import { mensajeError } from "@/lib/errores";
import { api, type Tarea } from "@/lib/servicios";

const ETIQUETA: Record<Tarea["estado"], string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  completada: "Completada",
  cancelada: "Cancelada",
};

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

  const alternar = (i: number) => {
    const lista = (tarea.checklist ?? []).map((c, j) => (j === i ? { ...c, hecho: !c.hecho } : c));
    void aplicar({ checklist: lista });
  };

  return (
    <Tarjeta>
      <Text style={{ fontWeight: "700", fontSize: 16 }}>{tarea.titulo}</Text>
      <Text style={{ fontWeight: "600", color: tarea.estado === "completada" ? COLOR.ok : COLOR.primario }}>
        {ETIQUETA[tarea.estado]}
        {tarea.sector_id ? ` · sector ${tarea.sector_id}` : ""}
      </Text>
      {tarea.descripcion ? <Texto>{tarea.descripcion}</Texto> : null}

      {(tarea.checklist ?? []).map((c, i) => (
        <Pressable
          key={`${tarea.id}-${i}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: c.hecho, disabled: trabajando || tarea.estado === "completada" }}
          disabled={trabajando || tarea.estado === "completada"}
          onPress={() => alternar(i)}
          style={{ flexDirection: "row", gap: 8, paddingVertical: 6 }}
        >
          <Text>{c.hecho ? "[x]" : "[ ]"}</Text>
          <Text style={{ flex: 1 }}>{c.item}</Text>
        </Pressable>
      ))}

      {error ? <ErrorCaja mensaje={error} /> : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {tarea.estado === "pendiente" ? (
          <Boton titulo="Iniciar" onPress={() => void aplicar({ estado: "en_curso" })} cargando={trabajando} />
        ) : null}
        {tarea.estado === "en_curso" ? (
          <Boton titulo="Completar" onPress={() => void aplicar({ estado: "completada" })} cargando={trabajando} />
        ) : null}
      </View>
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
    <Pantalla>
      <Titulo>Tareas de la cuadrilla</Titulo>
      <Texto suave>
        Los cambios se guardan en el servidor al instante y requieren conexión.
      </Texto>
      {error ? <ErrorCaja mensaje={error} onReintentar={cargar} /> : null}
      {!error && tareas === null ? <Cargando texto="Cargando tareas…" /> : null}
      {tareas && tareas.length === 0 ? <Vacio texto="No tenés tareas asignadas." /> : null}
      {(tareas ?? []).map((t) => (
        <TarjetaTarea
          key={t.id}
          tarea={t}
          alCambiar={(nueva) => setTareas((l) => (l ?? []).map((x) => (x.id === nueva.id ? nueva : x)))}
        />
      ))}
      <Boton titulo="Actualizar" variante="secundario" onPress={cargar} />
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
