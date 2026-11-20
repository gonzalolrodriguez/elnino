import { useCallback, useEffect, useState } from "react";

import { Encabezado } from "@/components/Piezas";
import { Boton, Campo, ErrorCaja, FilaBotones, Insignia, Tarjeta, Texto } from "@/components/ui";
import { guardarCache, leerCache } from "@/lib/cacheLocal";
import { abrirSMSConfirmacion, MAX_COMENTARIO } from "@/lib/confirmacion";
import { useCola } from "@/lib/ColaContext";
import { obtenerUrlServidor } from "@/lib/servidor";
import { canonicaRespuesta, ETIQUETA_OPCION, etiquetaRespuesta, palabraSMS, RESPUESTAS_CANONICAS } from "@/lib/respuestas";
import { api, type ConsultaConfirmacion, type RespuestaCanonica, type RespuestaEvacuado } from "@/lib/servicios";
import { useUsuario } from "@/lib/SesionContext";
import { textoDestinoSMS } from "@/lib/ayudaSms";

/**
 * Consultas de confirmación propias (`GET /mi/confirmaciones`). Sin conexión se usa la última copia
 * guardada; si el rol no tiene consultas (403) o falla todo, la lista queda vacía sin molestar.
 */
export function useConsultas(activo = true) {
  const usuario = useUsuario();
  const clave = `confirmaciones:${usuario.id}:${obtenerUrlServidor()}`;
  const [consultas, setConsultas] = useState<ConsultaConfirmacion[]>([]);

  const recargar = useCallback(async () => {
    if (!activo) return;
    try {
      const r = await api.confirmaciones();
      setConsultas(Array.isArray(r.confirmaciones) ? r.confirmaciones : []);
      await guardarCache(clave, r.confirmaciones);
    } catch {
      const guardado = await leerCache<ConsultaConfirmacion[]>(clave);
      if (guardado && Array.isArray(guardado.valor)) setConsultas(guardado.valor);
    }
  }, [clave, activo]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return { consultas, recargar };
}

type Props = {
  solicitudId: number;
  codigo: string;
  centroNombre: string | null;
  /** Si la consulta ya fue respondida, se muestra la respuesta y no los botones. */
  respondida?: RespuestaEvacuado | null;
  alResponder?: () => void;
};

type Resultado =
  | { tipo: "enviada" }
  | { tipo: "guardada" }
  | { tipo: "rechazada"; mensaje: string }
  | null;

const REVISION = "Gracias por avisarnos. Un operador va a revisar lo que pasó.";
const GRACIAS: Record<RespuestaCanonica, string> = {
  completa: "Gracias por avisar que te asistieron.",
  parcial: REVISION,
  no_encontraron: REVISION,
  no_vinieron: REVISION,
  otro_problema: REVISION,
};

/**
 * «¿Llegaste a <centro>?»: la persona evacuada confirma si el traslado se hizo bien. Copia neutral:
 * es una consulta, no una acusación. Sin conexión la respuesta queda en la cola; también se puede
 * responder por SMS (canal SIMULADO).
 */
export function TarjetaConfirmacion({ solicitudId, codigo, centroNombre, respondida = null, alResponder }: Props) {
  const { enviar } = useCola();
  const [elegida, setElegida] = useState<RespuestaCanonica | null>(null);
  const [comentario, setComentario] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [resultado, setResultado] = useState<Resultado>(null);
  const [error, setError] = useState<string | null>(null);

  const donde = centroNombre ? `a ${centroNombre}` : "al lugar donde te llevaron";
  const respuestaFinal = respondida ?? null;

  const responder = async () => {
    if (!elegida) return;
    setError(null);
    setTrabajando(true);
    try {
      const texto = comentario.trim().slice(0, MAX_COMENTARIO);
      const r = await enviar(
        {
          clase: "confirmacion",
          solicitud_id: solicitudId,
          respuesta: elegida,
          ...(texto ? { comentario: texto } : {}),
        },
        null,
      );
      if (r.rechazada) {
        setResultado({
          tipo: "rechazada",
          mensaje: `${r.rechazada} Si ya habías respondido, la respuesta es una sola y no se puede cambiar.`,
        });
      } else {
        setResultado({ tipo: r.enviadaYa ? "enviada" : "guardada" });
        alResponder?.();
      }
    } catch {
      setError("No se pudo guardar tu respuesta en el teléfono.");
    } finally {
      setTrabajando(false);
    }
  };

  const porSMS = async () => {
    if (!elegida) return;
    setError(null);
    try {
      await abrirSMSConfirmacion(elegida, codigo, comentario);
    } catch {
      setError("No se pudo abrir la app de mensajes.");
    }
  };

  if (respuestaFinal) {
    return (
      <Tarjeta>
        <Encabezado icono="tilde">¿Llegaste {donde}?</Encabezado>
        <Texto>Tu respuesta: {etiquetaRespuesta(respuestaFinal)}. Es una sola y no se puede cambiar.</Texto>
        <Insignia categoria="SIMULADO" />
      </Tarjeta>
    );
  }

  return (
    <Tarjeta>
      <Encabezado icono="casa">¿Llegaste {donde}?</Encabezado>
      <Texto suave>
        Es solo una consulta para saber si el traslado salió bien. Tu respuesta nos ayuda a ordenar la
        ayuda; no es una evaluación sobre vos.
      </Texto>

      {resultado?.tipo === "enviada" ? (
        <Texto>{elegida ? GRACIAS[canonicaRespuesta(elegida)] : "Gracias."}</Texto>
      ) : null}
      {resultado?.tipo === "guardada" ? (
        <Texto>Guardamos tu respuesta en el teléfono; se va a enviar sola cuando haya conexión.</Texto>
      ) : null}
      {resultado?.tipo === "rechazada" ? <ErrorCaja mensaje={resultado.mensaje} /> : null}

      {resultado?.tipo !== "enviada" && resultado?.tipo !== "guardada" ? (
        <>
          <FilaBotones>
            {RESPUESTAS_CANONICAS.map((r) => (
              <Boton
                key={r}
                titulo={ETIQUETA_OPCION[r]}
                variante={elegida === r ? "primario" : "secundario"}
                icono={elegida === r ? "tilde" : undefined}
                onPress={() => setElegida(r)}
              />
            ))}
          </FilaBotones>
          {elegida ? (
            <>
              <Campo
                etiqueta="Comentario (opcional)"
                value={comentario}
                onChangeText={setComentario}
                multiline
                maxLength={MAX_COMENTARIO}
                style={{ minHeight: 64, textAlignVertical: "top" }}
              />
              {error ? <ErrorCaja mensaje={error} /> : null}
              <Boton titulo="Enviar mi respuesta" onPress={() => void responder()} cargando={trabajando} />
              <Boton titulo="Responder por SMS (si no tenés internet)" variante="secundario" onPress={() => void porSMS()} />
              <Texto suave pequeno>
                Por SMS se manda «{palabraSMS(elegida)} {codigo}
                {palabraSMS(elegida) === "PROBLEMA" ? " y el motivo" : ""}». Solo vale si lo mandás desde el
                teléfono que registraste. La respuesta del canal es siempre la misma, así que no sirve
                para saber si quedó registrada: cuando tengas internet, abrí la app y fijate. {textoDestinoSMS()}
              </Texto>
            </>
          ) : null}
        </>
      ) : null}
      <Insignia categoria="SIMULADO" />
    </Tarjeta>
  );
}
