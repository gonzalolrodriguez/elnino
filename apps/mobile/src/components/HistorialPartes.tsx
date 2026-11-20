import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { COLOR, Texto } from "@/components/ui";
import { guardarCache, leerCache } from "@/lib/cacheLocal";
import { mensajeError } from "@/lib/errores";
import { etiquetaRolOperativo, formatearFechaHora } from "@/lib/etiquetas";
import { etiquetaParte, type ParteTarea } from "@/lib/partes";
import { obtenerUrlServidor } from "@/lib/servidor";
import { api } from "@/lib/servicios";
import { useUsuario } from "@/lib/SesionContext";

/**
 * Historial de partes de una tarea (más nuevo primero). Sin conexión muestra la última copia guardada
 * con su fecha. La clave lleva el usuario y el servidor, y empieza distinto de la lista pública de la
 * brújula: `borrarCachePersonal` la borra al terminar la sesión, igual que el resto de lo personal.
 */
export function HistorialPartes({ tareaId, version = 0 }: { tareaId: number; version?: number }) {
  const usuario = useUsuario();
  const clave = `partes:${usuario.id}:${obtenerUrlServidor()}:${tareaId}`;
  const [partes, setPartes] = useState<ParteTarea[] | null>(null);
  const [copia, setCopia] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const lista = (await api.partesDeTarea(tareaId)).items;
        if (!vivo) return;
        setPartes(lista);
        setCopia(null);
        setError(null);
        await guardarCache(clave, lista);
      } catch (e) {
        const guardado = await leerCache<ParteTarea[]>(clave);
        if (!vivo) return;
        if (guardado && Array.isArray(guardado.valor)) {
          setPartes(guardado.valor);
          setCopia(guardado.guardadoEn);
        } else {
          setError(mensajeError(e));
        }
      }
    })();
    return () => {
      vivo = false;
    };
  }, [clave, tareaId, version]);

  if (error) return <Texto suave>No se pudo cargar el historial: {error}</Texto>;
  if (partes === null) return <Texto suave>Cargando partes…</Texto>;
  return (
    <View style={{ gap: 8 }}>
      {copia !== null ? (
        <Texto suave pequeno>
          Sin conexión: se muestra lo último guardado, actualizado el {formatearFechaHora(new Date(copia).toISOString())}.
        </Texto>
      ) : null}
      {partes.length === 0 ? <Texto suave>Todavía no hay partes de esta tarea.</Texto> : null}
      {partes.map((p) => (
        <View key={p.id} style={{ gap: 2 }} accessible>
          <Text style={{ fontWeight: "600" }}>
            {etiquetaParte(p)}
            {p.tipo === "dificultad" ? (p.resuelta ? " · resuelta" : " · sin resolver") : ""}
          </Text>
          {p.observacion ? <Texto>{p.observacion}</Texto> : null}
          <Text style={{ color: COLOR.suave, fontSize: 13 }} maxFontSizeMultiplier={1.5}>
            {formatearFechaHora(p.creado_en)}
            {p.autor_rol ? ` · ${etiquetaRolOperativo(p.autor_rol)}` : ""}
          </Text>
        </View>
      ))}
    </View>
  );
}
