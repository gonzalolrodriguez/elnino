import { useState } from "react";
import { Image, Text } from "react-native";

import { EnlaceQueHacer } from "@/components/EnlaceQueHacer";
import { EstadoSector } from "@/components/EstadoSector";
import { SelectorEspecie } from "@/components/SelectorEspecie";
import { Boton, Campo, COLOR, ErrorCaja, Insignia, Opcion, Opciones, Pantalla, Subtitulo, Tarjeta, Texto, Titulo } from "@/components/ui";
import { useCola } from "@/lib/ColaContext";
import type { DatosSolicitud } from "@/lib/cola";
import { etiquetaTipoSolicitud } from "@/lib/etiquetas";
import { obtenerUbicacion, tomarFotoComprimida, type Coordenadas } from "@/lib/dispositivo";
import { abrirSMS, leerEntero, textoDestinoSMS, validarCantidades } from "@/lib/ayudaSms";
import { ErrorSOS, type EspecieSOS } from "@/lib/sos";
import { useUsuario } from "@/lib/SesionContext";

const TIPOS: { valor: DatosSolicitud["tipo"]; etiqueta: string }[] = [
  { valor: "asistencia", etiqueta: "Asistencia" },
  { valor: "evacuacion", etiqueta: "Evacuación" },
  { valor: "ganado", etiqueta: "Ganado" },
  { valor: "logistica", etiqueta: "Logística" },
  { valor: "otro", etiqueta: "Otro" },
];

/** Tope del texto libre del backend (SolicitudIn.texto). */
const MAX_TEXTO = 500;

const entero = (v: string): number => leerEntero(v) ?? 0;

export default function Asistencia() {
  const usuario = useUsuario();
  const { enviar, sinRed, pendientes } = useCola();
  const [tipo, setTipo] = useState<DatosSolicitud["tipo"]>("asistencia");
  const [personas, setPersonas] = useState("");
  const [animales, setAnimales] = useState("");
  const [especie, setEspecie] = useState<EspecieSOS>("bovinos");
  const [texto, setTexto] = useState("");
  const [referencia, setReferencia] = useState("");
  const [ubicacion, setUbicacion] = useState<Coordenadas | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<"enviada" | "encolada" | "foto_pendiente" | null>(null);

  const cargarUbicacion = async () => {
    setError(null);
    setTrabajando(true);
    const r = await obtenerUbicacion();
    setTrabajando(false);
    if (r.ok) setUbicacion(r.coordenadas);
    else {
      setError(
        r.motivo === "permiso"
          ? "Sin permiso de ubicación. Habilitalo en los ajustes del teléfono."
          : "No se pudo obtener la ubicación. Probá de nuevo al aire libre.",
      );
    }
  };

  const hayContenido = entero(personas) > 0 || entero(animales) > 0 || texto.trim().length > 0 || referencia.trim().length > 0;

  const datos = (): DatosSolicitud | null =>
    ubicacion
      ? {
          tipo,
          personas: entero(personas),
          animales: entero(animales),
          lon: ubicacion.lon,
          lat: ubicacion.lat,
          texto: texto.trim().slice(0, MAX_TEXTO) || null,
          // Campo propio del backend; se omite si está vacío.
          ...(referencia.trim() ? { referencia_ubicacion: referencia.trim() } : {}),
          origen: "app",
        }
      : null;

  const pedir = async () => {
    const d = datos();
    if (!d) return;
    const invalido = validarCantidades(personas, animales);
    if (invalido) {
      setError(invalido);
      return;
    }
    setError(null);
    setTrabajando(true);
    try {
      const r = await enviar(d, foto);
      setResultado(r.enviadaYa ? "enviada" : r.fotoPendiente ? "foto_pendiente" : "encolada");
      // El pedido ya quedó guardado (enviado o en cola): se limpia el formulario siempre, para que un
      // segundo toque no genere un pedido duplicado con otra clave de idempotencia.
      setPersonas("");
      setAnimales("");
      setTexto("");
      setReferencia("");
      setFoto(null);
    } catch {
      setError("No se pudo guardar la solicitud en el teléfono.");
    } finally {
      setTrabajando(false);
    }
  };

  const porSMS = async () => {
    setError(null);
    const invalido = validarCantidades(personas, animales);
    if (invalido) {
      setError(invalido);
      return;
    }
    if (!hayContenido) {
      setError("Para armar el SMS indicá personas, animales o escribí un detalle.");
      return;
    }
    // La ubicación por GPS funciona sin datos móviles: si todavía no se tomó, se toma ahora.
    let punto = ubicacion;
    if (!punto) {
      const r = await obtenerUbicacion();
      if (!r.ok) {
        setError("Para el SMS hace falta tu ubicación. Habilitá el permiso de ubicación y probá de nuevo al aire libre.");
        return;
      }
      punto = r.coordenadas;
      setUbicacion(punto);
    }
    try {
      // Solo abre la app de mensajes: el usuario revisa y envía. Nunca se envía solo.
      await abrirSMS({
        lat: punto.lat,
        lon: punto.lon,
        perfil: usuario.rol === "productor" ? "productor" : "ciudadano",
        familiares: entero(personas),
        bovinos: entero(animales),
        especie: entero(animales) > 0 ? especie : null,
        tipoPedido: etiquetaTipoSolicitud(tipo).toLowerCase(),
        acceso: referencia,
        texto,
      });
    } catch (e) {
      setError(e instanceof ErrorSOS ? e.message : "No se pudo abrir la app de mensajes.");
    }
  };

  return (
    <Pantalla>
      <EstadoSector />
      <Titulo>Pedir asistencia</Titulo>
      <Texto suave>
        Tu pedido llega al panel operativo. No es una orden de evacuación ni reemplaza una llamada de
        emergencia.
      </Texto>

      <Subtitulo>Tipo de pedido</Subtitulo>
      <Opciones>
        {TIPOS.map((t) => (
          <Opcion key={t.valor} titulo={t.etiqueta} elegida={tipo === t.valor} onPress={() => setTipo(t.valor)} />
        ))}
      </Opciones>

      <Campo etiqueta="Personas a asistir" value={personas} onChangeText={setPersonas} keyboardType="number-pad" />
      <Campo etiqueta="Animales" value={animales} onChangeText={setAnimales} keyboardType="number-pad" />
      {entero(animales) > 0 ? <SelectorEspecie valor={especie} alCambiar={setEspecie} /> : null}
      <Campo
        etiqueta="Detalle (máx. 500 caracteres)"
        value={texto}
        onChangeText={setTexto}
        multiline
        maxLength={500}
        style={{ minHeight: 96, textAlignVertical: "top" }}
      />

      <Campo
        etiqueta="Referencia de ubicación (paraje, camino, escuela cercana)"
        value={referencia}
        onChangeText={setReferencia}
        maxLength={60}
      />
      <Texto suave pequeno>
        Ayuda a los operadores a encontrarte y por SMS viaja como «cómo se llega». Para el envío por
        internet hace falta además tomar la ubicación con el GPS.
      </Texto>

      <Tarjeta>
        <Subtitulo>Ubicación</Subtitulo>
        {ubicacion ? (
          <Texto>
            {ubicacion.lat.toFixed(5)}, {ubicacion.lon.toFixed(5)}
          </Texto>
        ) : (
          <Texto suave>Todavía no se tomó la ubicación.</Texto>
        )}
        <Boton
          titulo={ubicacion ? "Actualizar ubicación" : "Tomar mi ubicación"}
          variante="secundario"
          onPress={cargarUbicacion}
          deshabilitado={trabajando}
        />
      </Tarjeta>

      <Tarjeta>
        <Subtitulo>Foto (opcional)</Subtitulo>
        {foto ? <Image
            source={{ uri: foto }}
            style={{ width: "100%", aspectRatio: 4 / 3, maxHeight: 280, borderRadius: 12 }}
            resizeMode="cover"
            accessibilityLabel="Foto adjunta"
          /> : null}
        <Boton
          titulo={foto ? "Cambiar foto" : "Tomar foto"}
          variante="secundario"
          onPress={async () => {
            // Si se cancela la cámara, la foto anterior se conserva.
            const nueva = await tomarFotoComprimida();
            if (nueva) setFoto(nueva);
          }}
        />
        {foto ? (
          <Texto suave>
            La foto se envía después del pedido, comprimida. Si no hay conexión, espera en el teléfono
            hasta que vuelva.
          </Texto>
        ) : null}
      </Tarjeta>

      {error ? <ErrorCaja mensaje={error} /> : null}

      {resultado === "enviada" ? (
        <Tarjeta>
          <Text style={{ color: COLOR.ok, fontWeight: "700" }}>Solicitud enviada</Text>
          <Insignia categoria="SIMULADO" />
          <Texto suave>Podés seguir su estado en la pestaña Solicitudes.</Texto>
        </Tarjeta>
      ) : null}
      {resultado === "foto_pendiente" ? (
        <Tarjeta>
          <Text style={{ color: COLOR.avisoTexto, fontWeight: "700" }}>Solicitud enviada</Text>
          <Texto suave>La foto todavía no se pudo subir; se reintentará sola cuando haya conexión.</Texto>
        </Tarjeta>
      ) : null}
      {resultado === "encolada" ? (
        <Tarjeta>
          <Text style={{ color: COLOR.avisoTexto, fontWeight: "700" }}>Guardada en el teléfono</Text>
          <Texto suave>
            {sinRed
              ? "No hay conexión. Se enviará sola cuando vuelva la red."
              : "No se pudo enviar ahora. Se reintentará automáticamente."}{" "}
            Pendientes: {pendientes}.
          </Texto>
        </Tarjeta>
      ) : null}

      <Boton
        titulo="Enviar solicitud"
        onPress={pedir}
        cargando={trabajando}
        deshabilitado={!ubicacion || !hayContenido}
      />
      {!ubicacion || !hayContenido ? (
        <Texto suave>
          Para enviar hace falta la ubicación y al menos personas, animales o un detalle.
        </Texto>
      ) : null}

      <Tarjeta>
        <Subtitulo>Si no tenés internet</Subtitulo>
        <Texto suave>
          Si no tenés internet, el pedido se puede mandar como mensaje de texto: usa tu ubicación y lo
          que cargaste arriba. Se abre la app de mensajes con el texto listo; vos lo revisás y lo
          enviás.
        </Texto>
        <Texto suave>{textoDestinoSMS()}</Texto>
        <Boton titulo="¿Sin datos? Enviar por SMS" variante="secundario" onPress={porSMS} />
      </Tarjeta>
      <EnlaceQueHacer />
    </Pantalla>
  );
}
