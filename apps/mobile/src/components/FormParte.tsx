import { useState } from "react";
import { Text } from "react-native";

import { Boton, Campo, ErrorCaja, FilaBotones, Insignia, Opcion, Opciones, Subtitulo, Tarjeta, Texto } from "@/components/ui";
import { useCola } from "@/lib/ColaContext";
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
  const [final, setFinal] = useState<{ enviada: boolean } | null>(null);

  const obligatoria = exigeObservacion(tipo, tipo === "resultado" ? resultado : null);

  const mandar = async () => {
    const r = armarParte({ tareaId, tipo, resultado, observacion });
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
      setFinal({ enviada: envio.enviadaYa });
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
      {error ? <ErrorCaja mensaje={error} /> : null}
      <FilaBotones>
        <Boton titulo="Enviar parte" onPress={() => void mandar()} cargando={trabajando} />
        <Boton titulo="Cancelar" variante="secundario" onPress={alCerrar} deshabilitado={trabajando} />
      </FilaBotones>
      <Insignia categoria="SIMULADO" />
    </Tarjeta>
  );
}
