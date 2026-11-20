import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";

import { Icono } from "@/components/Icono";
import { MarcarEnMapa } from "@/components/mapa/MarcarEnMapa";
import { Contador, Encabezado } from "@/components/Piezas";
import { Boton, Campo, Cargando, COLOR, ErrorCaja, Tarjeta, Texto } from "@/components/ui";
import { ErrorApi } from "@/lib/api";
import { obtenerUbicacion } from "@/lib/dispositivo";
import { mensajeError } from "@/lib/errores";
import { validarGrupo } from "@/lib/grupoFamiliar";
import { api, type GrupoFamiliar } from "@/lib/servicios";

/** Cantidad entera ≥ 0 de un campo de texto; lo que no se puede leer cuenta como 0. */
const entero = (v: string): number => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function FormGrupoFamiliar() {
  const [cargando, setCargando] = useState(true);
  const [previo, setPrevio] = useState<GrupoFamiliar | null>(null);
  const [integrantes, setIntegrantes] = useState("1");
  const [menores, setMenores] = useState("0");
  const [mayores, setMayores] = useState("0");
  const [mascotas, setMascotas] = useState("0");
  const [telefono, setTelefono] = useState("");
  const [ubicacion, setUbicacion] = useState<{ lat: number; lon: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Falla de carga distinta de 404: no se muestra el formulario para no pisar datos con valores vacios. */
  const [falloCarga, setFalloCarga] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const aplicar = (g: GrupoFamiliar) => {
    setPrevio(g);
    setIntegrantes(String(g.integrantes));
    setMenores(String(g.menores));
    setMayores(String(g.mayores));
    setMascotas(String(g.mascotas));
    setTelefono(g.telefono ?? "");
    setUbicacion(g.lat !== null && g.lon !== null ? { lat: g.lat, lon: g.lon } : null);
  };

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    setFalloCarga(null);
    try {
      aplicar(await api.grupo());
    } catch (e) {
      // 404 = todavía no cargó su grupo familiar: formulario vacío, no es un error. Cualquier otra
      // falla (red, 5xx) NO habilita el formulario: guardar con valores por defecto borraría los
      // datos que ya existen en el servidor (salud, vulnerabilidad, teléfono cifrado).
      if (!(e instanceof ErrorApi && e.estado === 404)) setFalloCarga(mensajeError(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const guardar = async () => {
    setError(null);
    setGuardado(null);
    const v = validarGrupo({ integrantes, menores, mayores, mascotas });
    if ("error" in v) {
      setError(v.error);
      return;
    }
    setGuardando(true);
    try {
      const g = await api.guardarGrupo({
        ...v.ok,
        telefono: telefono.trim() || null,
        salud: previo?.salud ?? null,
        vulnerabilidad: previo?.vulnerabilidad ?? null,
        ...(ubicacion ? { lon: ubicacion.lon, lat: ubicacion.lat } : {}),
      });
      aplicar(g);
      setGuardado("Grupo familiar guardado.");
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <Cargando texto="Cargando grupo familiar…" />;
  if (falloCarga) {
    return (
      <Tarjeta>
        <Encabezado icono="casa">Grupo familiar y domicilio</Encabezado>
        <ErrorCaja mensaje={`No pudimos cargar tus datos. ${falloCarga}`} onReintentar={() => void cargar()} />
      </Tarjeta>
    );
  }

  return (
    <Tarjeta>
      <Encabezado icono="casa">Grupo familiar y domicilio</Encabezado>
      <View>
        <Contador etiqueta="Integrantes" icono="personas" valor={entero(integrantes)} min={1} alCambiar={(n) => setIntegrantes(String(n))} />
        <Contador etiqueta="Menores" icono="persona" valor={entero(menores)} alCambiar={(n) => setMenores(String(n))} />
        <Contador etiqueta="Mayores" icono="persona" valor={entero(mayores)} alCambiar={(n) => setMayores(String(n))} />
        <Contador etiqueta="Mascotas" icono="mascota" valor={entero(mascotas)} alCambiar={(n) => setMascotas(String(n))} />
      </View>
      <Campo etiqueta="Teléfono (se guarda cifrado)" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
        <View style={{ marginTop: 2 }}>
          <Icono nombre="punto" tam={20} color={COLOR.primario} />
        </View>
        <Texto suave>
          Domicilio:{" "}
          {ubicacion ? `${ubicacion.lat.toFixed(5)}, ${ubicacion.lon.toFixed(5)}` : "sin cargar"}
          {previo?.sector_id ? ` · sector ${previo.sector_id}` : ""}
        </Texto>
      </View>
      <Boton
        titulo="Usar mi ubicación como domicilio"
        variante="secundario"
        icono="punto"
        onPress={async () => {
          const r = await obtenerUbicacion();
          if (r.ok) setUbicacion(r.coordenadas);
          else setError("No se pudo obtener la ubicación.");
        }}
      />
      <MarcarEnMapa punto={ubicacion} alCambiar={(p) => setUbicacion({ lat: p.lat, lon: p.lon })} titulo="Marcar mi domicilio en el mapa" />
      {error ? <ErrorCaja mensaje={error} /> : null}
      {guardado ? <Text style={{ color: COLOR.okTexto, fontWeight: "600" }}>{guardado}</Text> : null}
      <Boton titulo="Guardar" onPress={guardar} cargando={guardando} />
    </Tarjeta>
  );
}
