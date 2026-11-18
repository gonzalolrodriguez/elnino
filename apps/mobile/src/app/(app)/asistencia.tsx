import { useState } from "react";
import { Image, Linking, Text, View } from "react-native";

import { Boton, Campo, COLOR, ErrorCaja, Insignia, Pantalla, Tarjeta, Texto, Titulo } from "@/components/ui";
import { useCola } from "@/lib/ColaContext";
import type { DatosSolicitud } from "@/lib/cola";
import { obtenerUbicacion, tomarFotoComprimida, type Coordenadas } from "@/lib/dispositivo";
import { codificarSOS, enlaceSMS, ErrorSOS } from "@/lib/sos";
import { useUsuario } from "@/lib/SesionContext";

const TIPOS: { valor: DatosSolicitud["tipo"]; etiqueta: string }[] = [
  { valor: "asistencia", etiqueta: "Asistencia" },
  { valor: "evacuacion", etiqueta: "Evacuación" },
  { valor: "ganado", etiqueta: "Ganado" },
  { valor: "logistica", etiqueta: "Logística" },
  { valor: "otro", etiqueta: "Otro" },
];

/** Número al que se dirige el SMS de respaldo; si no está configurado, el usuario elige el destinatario. */
const SMS_DESTINO = process.env.EXPO_PUBLIC_SMS_DESTINO ?? "";

const entero = (v: string): number => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export default function Asistencia() {
  const usuario = useUsuario();
  const { enviar, sinRed, pendientes } = useCola();
  const [tipo, setTipo] = useState<DatosSolicitud["tipo"]>("asistencia");
  const [personas, setPersonas] = useState("");
  const [animales, setAnimales] = useState("");
  const [texto, setTexto] = useState("");
  const [ubicacion, setUbicacion] = useState<Coordenadas | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<"enviada" | "encolada" | null>(null);

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

  const hayContenido = entero(personas) > 0 || entero(animales) > 0 || texto.trim().length > 0;

  const datos = (): DatosSolicitud | null =>
    ubicacion
      ? {
          tipo,
          personas: entero(personas),
          animales: entero(animales),
          lon: ubicacion.lon,
          lat: ubicacion.lat,
          texto: texto.trim() || null,
          origen: "app",
        }
      : null;

  const pedir = async () => {
    const d = datos();
    if (!d) return;
    setError(null);
    setTrabajando(true);
    try {
      const r = await enviar(d, foto);
      setResultado(r.enviadaYa ? "enviada" : "encolada");
      if (r.enviadaYa) {
        setPersonas("");
        setAnimales("");
        setTexto("");
        setFoto(null);
      }
    } catch {
      setError("No se pudo guardar la solicitud en el teléfono.");
    } finally {
      setTrabajando(false);
    }
  };

  const porSMS = async () => {
    if (!ubicacion) return;
    try {
      const cuerpo = codificarSOS({
        lat: ubicacion.lat,
        lon: ubicacion.lon,
        perfil: usuario.rol === "productor" ? "productor" : "ciudadano",
        familiares: entero(personas),
        bovinos: entero(animales),
        texto,
      });
      // Solo abre la app de mensajes: el usuario revisa y envía. Nunca se envía solo.
      await Linking.openURL(enlaceSMS(SMS_DESTINO, cuerpo));
    } catch (e) {
      setError(e instanceof ErrorSOS ? e.message : "No se pudo abrir la app de mensajes.");
    }
  };

  return (
    <Pantalla>
      <Titulo>Pedir asistencia</Titulo>
      <Texto suave>
        Tu pedido llega al panel operativo. No es una orden de evacuación ni reemplaza una llamada de
        emergencia.
      </Texto>

      <Text style={{ fontWeight: "600" }}>Tipo de pedido</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {TIPOS.map((t) => (
          <Boton
            key={t.valor}
            titulo={t.etiqueta}
            variante={tipo === t.valor ? "primario" : "secundario"}
            onPress={() => setTipo(t.valor)}
          />
        ))}
      </View>

      <Campo etiqueta="Personas a asistir" value={personas} onChangeText={setPersonas} keyboardType="number-pad" />
      <Campo etiqueta="Animales" value={animales} onChangeText={setAnimales} keyboardType="number-pad" />
      <Campo
        etiqueta="Detalle (máx. 500 caracteres)"
        value={texto}
        onChangeText={setTexto}
        multiline
        maxLength={500}
        style={{ minHeight: 70, textAlignVertical: "top" }}
      />

      <Tarjeta>
        <Text style={{ fontWeight: "600" }}>Ubicación</Text>
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
        <Text style={{ fontWeight: "600" }}>Foto (opcional)</Text>
        {foto ? <Image source={{ uri: foto }} style={{ height: 140, borderRadius: 6 }} /> : null}
        <Boton
          titulo={foto ? "Cambiar foto" : "Tomar foto"}
          variante="secundario"
          onPress={async () => setFoto(await tomarFotoComprimida())}
        />
        {foto ? (
          <Texto suave>
            La foto queda guardada en este teléfono. El servidor todavía no recibe adjuntos, por lo
            que no se envía con el pedido.
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
      {resultado === "encolada" ? (
        <Tarjeta>
          <Text style={{ color: COLOR.aviso, fontWeight: "700" }}>Guardada en el teléfono</Text>
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

      {(sinRed || resultado === "encolada") && ubicacion && hayContenido ? (
        <Boton titulo="Enviar por SMS (abre la app de mensajes)" variante="secundario" onPress={porSMS} />
      ) : null}
    </Pantalla>
  );
}
