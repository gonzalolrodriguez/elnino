import { useState } from "react";
import { Image, Text, View } from "react-native";

import { Boton, Campo, ErrorCaja, FilaBotones, Insignia, Opcion, Opciones, Subtitulo, Tarjeta, Texto } from "@/components/ui";
import { formatearBytes, MAX_ADJUNTOS_PARTE, validarAdjunto, type AdjuntoLocal } from "@/lib/adjuntos";
import { useCola } from "@/lib/ColaContext";
import { elegirAdjunto } from "@/lib/dispositivo";
import {
  armarParte,
  etiquetaResultadoParte,
  exigeConstancia,
  exigeObservacion,
  OBSERVACION_MAX,
  RESULTADOS,
  type ResultadoParte,
  type TipoParte,
} from "@/lib/partes";

const TITULO: Record<TipoParte, string> = {
  avance: "Informar avance",
  dificultad: "Informar dificultad",
  resultado: "Terminar tarea",
};

const AYUDA: Record<TipoParte, string> = {
  avance: "Contale al operador cómo viene la tarea. La observación es opcional.",
  dificultad: "Contá qué te impide avanzar (camino cortado, falta de vehículo, etc.). El operador la ve enseguida.",
  resultado: "Elegí cómo terminó. Si no quedó completa, explicá por qué: el operador la va a reprogramar.",
};

/**
 * Parte de la cuadrilla sobre una tarea. Se guarda en el teléfono y se envía solo cuando hay conexión:
 * la cuadrilla trabaja en zonas anegadas, a menudo sin señal. Si la tarea es una evacuación el servidor
 * exige constancia (409): en ese caso se pasa al formulario de cierre con constancia.
 */
export function FormParte({
  tareaId,
  tipo,
  alEnviado,
  alCerrar,
  alPedirConstancia,
}: {
  tareaId: number;
  tipo: TipoParte;
  alEnviado: (enviadaYa: boolean) => void;
  alCerrar: () => void;
  alPedirConstancia: () => void;
}) {
  const { enviar, descartar } = useCola();
  const [resultado, setResultado] = useState<ResultadoParte | null>(null);
  const [observacion, setObservacion] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [final, setFinal] = useState<{ enviada: boolean; archivosPendientes: boolean } | null>(null);
  const [adjuntos, setAdjuntos] = useState<AdjuntoLocal[]>([]);
  const [errorAdjunto, setErrorAdjunto] = useState<string | null>(null);
  const [eligiendo, setEligiendo] = useState(false);

  const obligatoria = exigeObservacion(tipo, tipo === "resultado" ? resultado : null);

  const agregar = async (fuente: "camara" | "galeria") => {
    setErrorAdjunto(null);
    setEligiendo(true);
    try {
      const r = await elegirAdjunto(fuente);
      if (!r.ok) {
        if (r.motivo === "permiso") setErrorAdjunto("Sin permiso de cámara. Habilitalo en los ajustes del teléfono.");
        else if (r.motivo === "error") setErrorAdjunto("No se pudo obtener el archivo. Probá de nuevo.");
        return;
      }
      const v = validarAdjunto(r.adjunto, adjuntos.length);
      if (!v.ok) {
        setErrorAdjunto(v.mensaje);
        return;
      }
      setAdjuntos((l) => (l.length < MAX_ADJUNTOS_PARTE ? [...l, r.adjunto] : l));
    } finally {
      setEligiendo(false);
    }
  };

  const mandar = async () => {
    const r = armarParte({ tareaId, tipo, resultado, observacion, adjuntos });
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    setError(null);
    setTrabajando(true);
    try {
      const envio = await enviar(r.datos, null);
      if (envio.rechazada) {
        // El rechazo se muestra aquí: el ítem no se deja en la cola para no duplicarlo en pantalla.
        if (envio.itemId !== undefined) await descartar(envio.itemId);
        if (exigeConstancia(envio.rechazada)) {
          alPedirConstancia();
          return;
        }
        setError(`El servidor no aceptó el parte: ${envio.rechazada}`);
        return;
      }
      setFinal({ enviada: envio.enviadaYa, archivosPendientes: envio.fotoPendiente });
      alEnviado(envio.enviadaYa);
    } catch {
      setError("No se pudo guardar el parte en el teléfono.");
    } finally {
      setTrabajando(false);
    }
  };

  if (final) {
    return (
      <Tarjeta>
        <Text style={{ fontWeight: "700" }}>{final.enviada ? "Parte enviado" : "Parte guardado"}</Text>
        <Texto>
          {final.enviada
            ? "El operador ya lo tiene."
            : final.archivosPendientes
              ? "El parte ya llegó. Las fotos y los videos esperan su turno y se suben solos cuando haya conexión."
              : "Pendiente de envío: se manda solo cuando haya conexión; no hace falta cargarlo de nuevo."}
        </Texto>
        <Insignia categoria="SIMULADO" />
        <Boton titulo="Listo" variante="secundario" onPress={alCerrar} />
      </Tarjeta>
    );
  }

  return (
    <Tarjeta>
      <Subtitulo>{TITULO[tipo]}</Subtitulo>
      <Texto suave>{AYUDA[tipo]}</Texto>
      {tipo === "resultado" ? (
        <>
          <Text style={{ fontWeight: "600" }}>¿Cómo terminó?</Text>
          <Opciones>
            {RESULTADOS.map((r) => (
              <Opcion key={r} titulo={etiquetaResultadoParte(r)} elegida={resultado === r} onPress={() => setResultado(r)} />
            ))}
          </Opciones>
        </>
      ) : null}
      <Campo
        etiqueta={obligatoria ? "Observación (obligatoria)" : "Observación (opcional)"}
        value={observacion}
        onChangeText={setObservacion}
        multiline
        maxLength={OBSERVACION_MAX}
        style={{ minHeight: 80, textAlignVertical: "top" }}
      />

      <Text style={{ fontWeight: "600" }}>
        Evidencia: fotos o videos ({adjuntos.length} de {MAX_ADJUNTOS_PARTE})
      </Text>
      <Texto suave pequeno>
        Foto hasta 5 MB o video MP4 o MOV hasta 20 MB. No saques fotos de caras ni de menores. Se suben después del parte, solas, cuando haya conexión.
      </Texto>
      {adjuntos.map((a, i) => (
        <View key={a.uri} style={{ gap: 6 }}>
          {a.tipo === "imagen" ? (
            <Image
              source={{ uri: a.uri }}
              style={{ width: "100%", aspectRatio: 4 / 3, maxHeight: 180, borderRadius: 12 }}
              resizeMode="cover"
              accessibilityLabel={`Foto ${i + 1}`}
            />
          ) : null}
          <Texto>
            {a.tipo === "video" ? "Video" : "Foto"} {i + 1}
            {a.bytes !== null ? ` · ${formatearBytes(a.bytes)}` : ""}
          </Texto>
          <Boton
            titulo={`Quitar ${a.tipo === "video" ? "video" : "foto"} ${i + 1}`}
            variante="secundario"
            onPress={() => setAdjuntos((l) => l.filter((x) => x.uri !== a.uri))}
          />
        </View>
      ))}
      {adjuntos.length < MAX_ADJUNTOS_PARTE ? (
        <FilaBotones>
          <Boton titulo="Sacar foto o video" variante="secundario" onPress={() => void agregar("camara")} deshabilitado={eligiendo || trabajando} />
          <Boton titulo="Elegir de la galería" variante="secundario" onPress={() => void agregar("galeria")} deshabilitado={eligiendo || trabajando} />
        </FilaBotones>
      ) : null}
      {errorAdjunto ? <ErrorCaja mensaje={errorAdjunto} /> : null}

      {error ? <ErrorCaja mensaje={error} /> : null}
      <FilaBotones>
        <Boton titulo="Enviar parte" onPress={() => void mandar()} cargando={trabajando} />
        <Boton titulo="Cancelar" variante="secundario" onPress={alCerrar} deshabilitado={trabajando} />
      </FilaBotones>
      <Insignia categoria="SIMULADO" />
    </Tarjeta>
  );
}
