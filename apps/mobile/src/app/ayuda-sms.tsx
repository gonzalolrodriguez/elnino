import { useRouter } from "expo-router";
import { useState } from "react";

import { SelectorEspecie } from "@/components/SelectorEspecie";
import { Boton, Campo, ErrorCaja, Opcion, Opciones, Pantalla, Subtitulo, Tarjeta, Texto, Titulo } from "@/components/ui";
import { abrirSMS, leerEntero, textoDestinoSMS, validarCantidades } from "@/lib/ayudaSms";
import { obtenerUbicacion, type Coordenadas } from "@/lib/dispositivo";
import { ErrorSOS, type EspecieSOS, type PerfilSOS } from "@/lib/sos";

/**
 * Pedido de ayuda por SMS sin cuenta y sin datos móviles: usa solo el GPS y la app de mensajes del
 * teléfono. Arma el SOS-FSA; la persona revisa y envía (la app nunca envía nada sola).
 */
export default function AyudaSms() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<PerfilSOS>("ciudadano");
  const [personas, setPersonas] = useState("");
  const [animales, setAnimales] = useState("");
  const [especie, setEspecie] = useState<EspecieSOS>("bovinos");
  const [acceso, setAcceso] = useState("");
  const [texto, setTexto] = useState("");
  const [ubicacion, setUbicacion] = useState<Coordenadas | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const nAnimales = leerEntero(animales) ?? 0;

  const tomarUbicacion = async (): Promise<Coordenadas | null> => {
    setTrabajando(true);
    const r = await obtenerUbicacion();
    setTrabajando(false);
    if (r.ok) {
      setUbicacion(r.coordenadas);
      return r.coordenadas;
    }
    setError(
      r.motivo === "permiso"
        ? "Sin permiso de ubicación. Habilitalo en los ajustes del teléfono."
        : "No se pudo obtener la ubicación. Probá de nuevo al aire libre.",
    );
    return null;
  };

  const armar = async () => {
    setError(null);
    const invalido = validarCantidades(personas, animales);
    if (invalido) {
      setError(invalido);
      return;
    }
    const punto = ubicacion ?? (await tomarUbicacion());
    if (!punto) return;
    try {
      await abrirSMS({
        lat: punto.lat,
        lon: punto.lon,
        perfil,
        familiares: leerEntero(personas) ?? 0,
        bovinos: nAnimales,
        especie: nAnimales > 0 ? especie : null,
        acceso,
        texto,
      });
    } catch (e) {
      setError(e instanceof ErrorSOS ? e.message : "No se pudo abrir la app de mensajes.");
    }
  };

  return (
    <Pantalla>
      <Titulo>Pedir ayuda por SMS</Titulo>
      <Texto suave>
        No hace falta cuenta ni internet. Se arma un mensaje de texto con tu ubicación y lo que cargues
        acá; se abre la app de mensajes y vos lo enviás.
      </Texto>

      <Opciones>
        <Opcion titulo="Soy vecino o vecina" elegida={perfil === "ciudadano"} onPress={() => setPerfil("ciudadano")} />
        <Opcion titulo="Soy productor" elegida={perfil === "productor"} onPress={() => setPerfil("productor")} />
      </Opciones>

      <Campo etiqueta="Personas que necesitan ayuda" value={personas} onChangeText={setPersonas} keyboardType="number-pad" />
      <Campo etiqueta="Animales" value={animales} onChangeText={setAnimales} keyboardType="number-pad" />
      {nAnimales > 0 ? <SelectorEspecie valor={especie} alCambiar={setEspecie} /> : null}
      <Campo
        etiqueta="¿Cómo se llega? (ej.: camino de tierra, ruta 11)"
        value={acceso}
        onChangeText={setAcceso}
        maxLength={60}
      />
      <Campo
        etiqueta="Contanos qué pasa (breve)"
        value={texto}
        onChangeText={setTexto}
        multiline
        maxLength={500}
        style={{ minHeight: 96, textAlignVertical: "top" }}
      />

      <Tarjeta>
        <Subtitulo>Tu ubicación</Subtitulo>
        <Texto suave>
          {ubicacion
            ? `${ubicacion.lat.toFixed(5)}, ${ubicacion.lon.toFixed(5)}`
            : "Todavía no se tomó. Se toma sola al armar el mensaje, o podés tomarla ahora."}
        </Texto>
        <Boton
          titulo={ubicacion ? "Actualizar ubicación" : "Tomar mi ubicación"}
          variante="secundario"
          onPress={() => void tomarUbicacion()}
          deshabilitado={trabajando}
        />
      </Tarjeta>

      <Texto suave>{textoDestinoSMS()}</Texto>
      {error ? <ErrorCaja mensaje={error} /> : null}
      <Boton titulo="Armar el mensaje" onPress={() => void armar()} cargando={trabajando} />
      <Texto suave pequeno>
        Si es una emergencia, llamá al 103 (Defensa Civil). Esta herramienta es un prototipo y no es oficial.
      </Texto>
      <Boton titulo="Volver" variante="secundario" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
    </Pantalla>
  );
}
