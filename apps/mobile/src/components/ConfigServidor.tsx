import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { Boton, COLOR, Campo, Tarjeta, Texto } from "@/components/ui";
import {
  cargarServidor,
  escucharServidor,
  guardarServidor,
  hayServidorPersonalizado,
  normalizarUrlServidor,
  obtenerUrlServidor,
  probarConexion,
  restablecerServidor,
  urlPorDefecto,
  type ResultadoPrueba,
} from "@/lib/servidor";

/** Datos de la sesión abierta. Si se pasan, cambiar de servidor cierra la sesión (el token es de otro servidor). */
export type SesionServidor = {
  pendientes: number;
  descartarPendientes: () => Promise<void>;
  cerrarSesionLocal: () => Promise<void>;
};

type Prueba = { tipo: "inactiva" } | { tipo: "probando" } | { tipo: "resultado"; r: ResultadoPrueba };
/** `destino: null` significa restablecer el valor por defecto. */
type Cambio = { destino: string | null };

/**
 * Configuración del servidor (URL base del backend). Se usa en la bienvenida (sin sesión) y en el
 * Perfil (con `sesion`).
 */
export function ConfigServidor({ sesion }: { sesion?: SesionServidor }) {
  const [actual, setActual] = useState(obtenerUrlServidor());
  const [texto, setTexto] = useState(obtenerUrlServidor());
  const [error, setError] = useState<string | null>(null);
  const [prueba, setPrueba] = useState<Prueba>({ tipo: "inactiva" });
  const [pendienteCambio, setPendienteCambio] = useState<Cambio | null>(null);
  const [aplicando, setAplicando] = useState(false);

  useEffect(() => {
    let activo = true;
    void cargarServidor().then(() => {
      if (activo) {
        setActual(obtenerUrlServidor());
        setTexto(obtenerUrlServidor());
      }
    });
    const quitar = escucharServidor(() => {
      if (activo) setActual(obtenerUrlServidor());
    });
    return () => {
      activo = false;
      quitar();
    };
  }, []);

  const probar = async () => {
    const r = normalizarUrlServidor(texto);
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    setError(null);
    setPrueba({ tipo: "probando" });
    setPrueba({ tipo: "resultado", r: await probarConexion(r.url) });
  };

  const aplicar = async (cambio: Cambio, descartar: boolean) => {
    setAplicando(true);
    try {
      if (sesion) {
        if (descartar) await sesion.descartarPendientes();
        await sesion.cerrarSesionLocal();
      }
      if (cambio.destino === null) await restablecerServidor();
      else await guardarServidor(cambio.destino);
      setTexto(obtenerUrlServidor());
      setActual(obtenerUrlServidor());
      setPrueba({ tipo: "inactiva" });
      setPendienteCambio(null);
    } finally {
      setAplicando(false);
    }
  };

  const solicitar = (cambio: Cambio) => {
    const destino = cambio.destino ?? urlPorDefecto();
    const sinCambio =
      destino === obtenerUrlServidor() && (cambio.destino !== null || !hayServidorPersonalizado());
    if (sinCambio) return;
    if (sesion) setPendienteCambio(cambio);
    else void aplicar(cambio, false);
  };

  const guardar = () => {
    const r = normalizarUrlServidor(texto);
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    setError(null);
    solicitar({ destino: r.url });
  };

  const restablecer = () => {
    setError(null);
    solicitar({ destino: null });
  };

  return (
    <Tarjeta>
      <Text style={{ fontSize: 16, fontWeight: "700", color: COLOR.texto }}>Servidor</Text>
      <Texto suave>
        Actual: {actual || "sin configurar"}
        {hayServidorPersonalizado() ? " (personalizado)" : actual ? " (valor por defecto)" : ""}
      </Texto>
      <Campo
        etiqueta="Dirección del servidor"
        value={texto}
        onChangeText={(t) => {
          setTexto(t);
          setError(null);
          setPrueba({ tipo: "inactiva" });
        }}
        error={error}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="http://192.168.1.50:8000"
      />
      <Text style={{ fontSize: 12, color: COLOR.suave }}>
        Ej.: http://192.168.1.50:8000 — la IP de la computadora que corre el backend, en la misma red Wi-Fi.
      </Text>

      {prueba.tipo === "probando" ? <Texto suave>Probando conexión…</Texto> : null}
      {prueba.tipo !== "resultado" ? null : prueba.r.ok ? (
        <Text style={{ color: prueba.r.baseDeDatos === "ok" ? COLOR.ok : COLOR.aviso, fontWeight: "700" }}>
          {prueba.r.baseDeDatos === "ok"
            ? "Conexión correcta · base de datos: ok"
            : "El servidor responde, pero la base de datos no está disponible"}
        </Text>
      ) : (
        <Text style={{ color: COLOR.error }} accessibilityRole="alert">
          {prueba.r.mensaje}
        </Text>
      )}

      {pendienteCambio ? (
        <View style={{ gap: 8, borderWidth: 1, borderColor: COLOR.aviso, borderRadius: 8, padding: 10 }}>
          <Text style={{ fontWeight: "700", color: COLOR.aviso }}>Se cerrará tu sesión</Text>
          <Texto>
            La sesión actual pertenece al servidor anterior. Al cambiar de servidor se cierra aquí y vas a
            tener que ingresar de nuevo.
          </Texto>
          {sesion && sesion.pendientes > 0 ? (
            <>
              <Texto>
                Tenés {sesion.pendientes} solicitud(es) sin enviar. Si las conservás, quedan en este teléfono
                esperando a este servidor: nunca se envían a otro servidor y se reanudan solo si volvés a
                este con la misma cuenta. Podés descartarlas desde «Mis solicitudes».
              </Texto>
              <Boton
                titulo="Conservar pendientes"
                cargando={aplicando}
                onPress={() => void aplicar(pendienteCambio, false)}
              />
              <Boton
                titulo="Descartar pendientes"
                variante="peligro"
                deshabilitado={aplicando}
                onPress={() => void aplicar(pendienteCambio, true)}
              />
            </>
          ) : (
            <Boton
              titulo="Cambiar servidor y cerrar sesión"
              cargando={aplicando}
              onPress={() => void aplicar(pendienteCambio, false)}
            />
          )}
          <Boton
            titulo="Cancelar"
            variante="secundario"
            deshabilitado={aplicando}
            onPress={() => setPendienteCambio(null)}
          />
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Boton
            titulo="Probar conexión"
            variante="secundario"
            cargando={prueba.tipo === "probando"}
            onPress={() => void probar()}
          />
          <Boton titulo="Guardar" onPress={guardar} />
          <Boton titulo="Restablecer valor por defecto" variante="secundario" onPress={restablecer} />
        </View>
      )}
    </Tarjeta>
  );
}
