import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";

import { Boton, Campo, ErrorCaja, FilaBotones, Insignia, Opcion, Opciones, Subtitulo, Tarjeta, Texto } from "@/components/ui";
import { guardarCache, leerCache } from "@/lib/cacheLocal";
import { armarCierre, ETIQUETA_ESPECIE, MAX_FOTOS } from "@/lib/cierre";
import { esCierre } from "@/lib/cola";
import { useCola } from "@/lib/ColaContext";
import { obtenerUbicacion, tomarFotoComprimida, type Coordenadas } from "@/lib/dispositivo";
import { etiquetaEstadoEvacuacion } from "@/lib/etiquetas";
import { obtenerUrlServidor } from "@/lib/servidor";
import { api, type Centro } from "@/lib/servicios";
import { useUsuario } from "@/lib/SesionContext";
import { ESPECIES_SOS } from "@/lib/sos";

/** Centros de recepción para elegir el destino; sin conexión se usa la última lista guardada. */
function useCentros() {
  const usuario = useUsuario();
  const clave = `centros:${usuario.id}:${obtenerUrlServidor()}`;
  const [centros, setCentros] = useState<Centro[] | null>(null);
  const [desdeCache, setDesdeCache] = useState(false);
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const lista = (await api.centros()).centros;
        if (!vivo) return;
        setCentros(lista);
        await guardarCache(clave, lista);
      } catch {
        const guardado = await leerCache<Centro[]>(clave);
        if (!vivo) return;
        setCentros(Array.isArray(guardado?.valor) ? guardado.valor : []);
        setDesdeCache(Boolean(guardado));
      }
    })();
    return () => {
      vivo = false;
    };
  }, [clave]);
  return { centros, desdeCache };
}

/** «Cerrar con constancia»: destino GPS, centro, personas y animales trasladados, nota y fotos. */
export function FormCierre({ tareaId, alEnviado, alCerrar }: { tareaId: number; alEnviado: () => void; alCerrar: () => void }) {
  const { enviar } = useCola();
  const { centros, desdeCache } = useCentros();
  const [ubicacion, setUbicacion] = useState<Coordenadas | null>(null);
  const [centroId, setCentroId] = useState<number | null>(null);
  const [personas, setPersonas] = useState("");
  const [animales, setAnimales] = useState<Record<string, string>>({});
  const [nota, setNota] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [final, setFinal] = useState<{ enviada: boolean; texto: string[] } | null>(null);

  const tomarUbicacion = async () => {
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

  const cerrar = async () => {
    const r = armarCierre({ tareaId, ubicacion, centroId, personas, animales, nota, fotos });
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    setError(null);
    setTrabajando(true);
    try {
      const envio = await enviar(r.datos, null);
      if (envio.rechazada) {
        setError(`El servidor no aceptó el cierre: ${envio.rechazada}`);
        return;
      }
      const resultado = envio.resultado && esCierre(envio.resultado) ? envio.resultado.resultado : undefined;
      const texto: string[] = [];
      if (envio.enviadaYa && resultado) {
        texto.push(etiquetaEstadoEvacuacion(resultado.estado));
        if (resultado.repetida) texto.push("Este cierre ya estaba registrado; no se duplicó.");
        if (resultado.confirmacion_solicitada) {
          texto.push("Le pedimos a la persona evacuada que confirme la llegada.");
        }
      } else if (envio.fotoPendiente) {
        texto.push("La constancia se envió. Las fotos esperan su turno y se suben solas cuando haya conexión.");
      } else {
        texto.push("Guardado en el teléfono. Se envía solo cuando haya conexión; no hace falta cargarlo de nuevo.");
      }
      setFinal({ enviada: envio.enviadaYa, texto });
      alEnviado();
    } catch {
      setError("No se pudo guardar el cierre en el teléfono.");
    } finally {
      setTrabajando(false);
    }
  };

  if (final) {
    return (
      <Tarjeta>
        <Text style={{ fontWeight: "700" }}>{final.enviada ? "Constancia registrada" : "Constancia guardada"}</Text>
        {final.texto.map((t) => (
          <Texto key={t}>{t}</Texto>
        ))}
        <Insignia categoria="SIMULADO" />
        <Boton titulo="Listo" variante="secundario" onPress={alCerrar} />
      </Tarjeta>
    );
  }

  return (
    <Tarjeta>
      <Subtitulo>Cerrar con constancia</Subtitulo>
      <Texto suave>
        Dejá registrado a dónde llegaron. El destino se toma con el GPS, que funciona sin datos móviles.
      </Texto>

      <Text style={{ fontWeight: "600" }}>Destino (GPS)</Text>
      <Texto suave={!ubicacion}>
        {ubicacion ? `${ubicacion.lat.toFixed(5)}, ${ubicacion.lon.toFixed(5)}` : "Todavía no se tomó la ubicación."}
      </Texto>
      <Boton
        titulo={ubicacion ? "Actualizar ubicación" : "Tomar ubicación del destino"}
        variante="secundario"
        onPress={() => void tomarUbicacion()}
        deshabilitado={trabajando}
      />

      <Text style={{ fontWeight: "600" }}>Centro de recepción</Text>
      {centros === null ? <Texto suave>Cargando centros…</Texto> : null}
      {centros && centros.length === 0 ? <Texto suave>No hay centros para elegir. Podés cerrar igual.</Texto> : null}
      {desdeCache ? <Texto suave pequeno>Sin conexión: lista de centros guardada en el teléfono.</Texto> : null}
      {centros && centros.length > 0 ? (
        <Opciones>
          <Opcion titulo="Ninguno" elegida={centroId === null} onPress={() => setCentroId(null)} />
          {centros.map((c) => (
            <Opcion key={c.id} titulo={c.nombre} elegida={centroId === c.id} onPress={() => setCentroId(c.id)} />
          ))}
        </Opciones>
      ) : null}

      <Campo etiqueta="Personas trasladadas" value={personas} onChangeText={setPersonas} keyboardType="number-pad" />
      <Text style={{ fontWeight: "600" }}>Animales trasladados, por especie</Text>
      {ESPECIES_SOS.map((e) => (
        <Campo
          key={e}
          etiqueta={ETIQUETA_ESPECIE[e] ?? e}
          value={animales[e] ?? ""}
          onChangeText={(t) => setAnimales((a) => ({ ...a, [e]: t }))}
          keyboardType="number-pad"
        />
      ))}
      <Campo
        etiqueta="Nota (obligatoria si no se trasladó a nadie)"
        value={nota}
        onChangeText={setNota}
        multiline
        maxLength={1000}
        style={{ minHeight: 80, textAlignVertical: "top" }}
      />

      <Text style={{ fontWeight: "600" }}>
        Fotos ({fotos.length} de {MAX_FOTOS})
      </Text>
      <Texto suave pequeno>
        Fotos del lugar o del transporte. No saques fotos de caras ni de menores.
      </Texto>
      {fotos.map((uri, i) => (
        <View key={uri} style={{ gap: 6 }}>
          <Image
            source={{ uri }}
            style={{ width: "100%", aspectRatio: 4 / 3, maxHeight: 200, borderRadius: 12 }}
            resizeMode="cover"
            accessibilityLabel={`Foto ${i + 1}`}
          />
          <Boton titulo={`Quitar foto ${i + 1}`} variante="secundario" onPress={() => setFotos((f) => f.filter((x) => x !== uri))} />
        </View>
      ))}
      {fotos.length < MAX_FOTOS ? (
        <Boton
          titulo="Agregar foto"
          variante="secundario"
          onPress={async () => {
            const nueva = await tomarFotoComprimida();
            if (nueva) setFotos((f) => (f.length < MAX_FOTOS ? [...f, nueva] : f));
          }}
        />
      ) : null}

      {error ? <ErrorCaja mensaje={error} /> : null}
      <FilaBotones>
        <Boton titulo="Guardar constancia" onPress={() => void cerrar()} cargando={trabajando} />
        <Boton titulo="Cancelar" variante="secundario" onPress={alCerrar} deshabilitado={trabajando} />
      </FilaBotones>
      <Insignia categoria="SIMULADO" />
    </Tarjeta>
  );
}
