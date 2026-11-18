import { useCallback, useEffect, useState } from "react";
import { Text } from "react-native";

import { Boton, Campo, Cargando, COLOR, ErrorCaja, Tarjeta, Texto } from "@/components/ui";
import { ErrorApi } from "@/lib/api";
import { obtenerUbicacion } from "@/lib/dispositivo";
import { mensajeError } from "@/lib/errores";
import { api, type GrupoFamiliar } from "@/lib/servicios";

const entero = (v: string, por: number): number => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : por;
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
    try {
      aplicar(await api.grupo());
    } catch (e) {
      // 404 = todavía no cargó su grupo familiar: formulario vacío, no es un error.
      if (!(e instanceof ErrorApi && e.estado === 404)) setError(mensajeError(e));
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
    setGuardando(true);
    try {
      const g = await api.guardarGrupo({
        integrantes: Math.max(entero(integrantes, 1), 1),
        menores: entero(menores, 0),
        mayores: entero(mayores, 0),
        mascotas: entero(mascotas, 0),
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

  return (
    <Tarjeta>
      <Text style={{ fontWeight: "700", fontSize: 16 }}>Grupo familiar y domicilio</Text>
      <Campo etiqueta="Integrantes" value={integrantes} onChangeText={setIntegrantes} keyboardType="number-pad" />
      <Campo etiqueta="Menores" value={menores} onChangeText={setMenores} keyboardType="number-pad" />
      <Campo etiqueta="Mayores" value={mayores} onChangeText={setMayores} keyboardType="number-pad" />
      <Campo etiqueta="Mascotas" value={mascotas} onChangeText={setMascotas} keyboardType="number-pad" />
      <Campo etiqueta="Teléfono (se guarda cifrado)" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />
      <Texto suave>
        Domicilio:{" "}
        {ubicacion ? `${ubicacion.lat.toFixed(5)}, ${ubicacion.lon.toFixed(5)}` : "sin cargar"}
        {previo?.sector_id ? ` · sector ${previo.sector_id}` : ""}
      </Texto>
      <Boton
        titulo="Usar mi ubicación como domicilio"
        variante="secundario"
        onPress={async () => {
          const r = await obtenerUbicacion();
          if (r.ok) setUbicacion(r.coordenadas);
          else setError("No se pudo obtener la ubicación.");
        }}
      />
      {error ? <ErrorCaja mensaje={error} /> : null}
      {guardado ? <Text style={{ color: COLOR.ok }}>{guardado}</Text> : null}
      <Boton titulo="Guardar" onPress={guardar} cargando={guardando} />
    </Tarjeta>
  );
}
