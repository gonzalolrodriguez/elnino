import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Text } from "react-native";

import { FlechaBrujula } from "@/components/FlechaBrujula";
import { Aviso, Encabezado } from "@/components/Piezas";
import { Boton, Cargando, COLOR, Enlace, Insignia, Pantalla, Tarjeta, Texto, Titulo } from "@/components/ui";
import {
  descripcionDireccion,
  distanciaM,
  elegirMasCercano,
  formatearDistanciaBrujula,
  formatearGuardado,
  normalizar360,
  rumboDelTelefono,
  rumboEnTexto,
  rumboInicial,
  type Destino,
} from "@/lib/brujula";
import { cargarDestinos, type DestinosCargados } from "@/lib/destinosBrujula";
import { useSesion } from "@/lib/SesionContext";
import { useSensoresBrujula } from "@/lib/useSensoresBrujula";

export const AVISO_SEGURIDAD =
  "La flecha apunta en línea recta: no es un camino. Seguí las indicaciones de Defensa Civil y evitá cruzar agua.";

type Carga = { tipo: "cargando" } | { tipo: "sin_datos" } | { tipo: "ok"; datos: DestinosCargados };

/**
 * «¿Hacia dónde voy?»: flecha hacia el centro de recepción asignado (o el más cercano de los guardados)
 * con la distancia en línea recta. Funciona sin datos ni mapa: usa los centros guardados en el teléfono
 * la última vez que hubo conexión, el GPS y el sensor de rumbo. No reemplaza las indicaciones de las
 * autoridades.
 */
export default function Brujula() {
  const router = useRouter();
  const { estado } = useSesion();
  const usuarioId = estado.tipo === "autenticado" ? estado.usuario.id : null;
  const [carga, setCarga] = useState<Carga>({ tipo: "cargando" });
  const sensores = useSensoresBrujula();

  const cargar = useCallback(async () => {
    const datos = await cargarDestinos(usuarioId);
    setCarga(datos ? { tipo: "ok", datos } : { tipo: "sin_datos" });
  }, [usuarioId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const datos = carga.tipo === "ok" ? carga.datos : null;
  const destino: { punto: Destino; asignado: boolean } | null = useMemo(() => {
    if (!datos) return null;
    if (datos.asignado) return { punto: datos.asignado, asignado: true };
    const cercano = sensores.posicion ? elegirMasCercano(sensores.posicion, datos.centros) : datos.centros[0] ?? null;
    return cercano ? { punto: cercano, asignado: false } : null;
  }, [datos, sensores.posicion]);

  const volver = () => (router.canGoBack() ? router.back() : router.replace("/"));

  if (carga.tipo === "cargando") {
    return (
      <Pantalla>
        <Titulo>¿Hacia dónde voy?</Titulo>
        <Cargando texto="Buscando tu centro de recepción…" />
      </Pantalla>
    );
  }

  if (!datos || !destino) {
    return (
      <Pantalla>
        <Titulo>¿Hacia dónde voy?</Titulo>
        <Tarjeta>
          <Encabezado icono="info">Todavía no hay un destino guardado</Encabezado>
          <Texto suave>
            Esta brújula usa el centro de recepción que la aplicación guarda en el teléfono cuando tenés conexión. Abrila una vez con
            datos para que quede disponible sin señal.
          </Texto>
          <Texto>Mientras tanto, llamá al 103 (Defensa Civil) y seguí sus indicaciones.</Texto>
        </Tarjeta>
        <Enlace titulo="Reintentar" onPress={() => void cargar()} />
        <Boton titulo="Volver" variante="secundario" onPress={volver} />
      </Pantalla>
    );
  }

  const { punto, asignado } = destino;
  const pos = sensores.posicion;
  const rumbo = pos ? rumboInicial(pos, punto) : null;
  const distancia = pos ? distanciaM(pos, punto) : null;
  const tel = rumboDelTelefono(sensores.rumbo);
  const flecha = rumbo !== null && distancia !== null && tel?.confiable ? normalizar360(rumbo - tel.grados) : null;

  return (
    <Pantalla>
      <Titulo>¿Hacia dónde voy?</Titulo>

      <Tarjeta>
        <Encabezado icono="casa">{punto.nombre}</Encabezado>
        <Texto suave pequeno>
          {asignado ? "Tu centro de recepción asignado" : "El centro más cercano entre los guardados (no tenés uno asignado)"}
        </Texto>
        <Insignia categoria={punto.categoria} />

        {sensores.permiso === "denegado" ? (
          <Texto>
            Sin el permiso de ubicación no podemos calcular la dirección. Activalo en los ajustes del teléfono (solo se usa mientras esta
            pantalla está abierta).
          </Texto>
        ) : rumbo === null || distancia === null ? (
          <Cargando texto="Buscando tu posición…" />
        ) : (
          <>
            {flecha !== null ? (
              <FlechaBrujula grados={flecha} etiqueta={descripcionDireccion(rumbo, distancia, punto.nombre)} />
            ) : null}
            <Text maxFontSizeMultiplier={1.5} style={{ fontSize: 22, lineHeight: 28, fontWeight: "700", letterSpacing: -0.3, color: COLOR.texto, textAlign: "center" }}>
              {flecha !== null ? `Distancia en línea recta: ${formatearDistanciaBrujula(distancia)}` : `Está ${rumboEnTexto(rumbo, distancia)}`}
            </Text>
            {flecha !== null ? (
              <Texto suave pequeno>
                Está {rumboEnTexto(rumbo, distancia)}.
              </Texto>
            ) : (
              <Texto suave>
                {tel
                  ? "El sensor de rumbo de tu teléfono no es preciso ahora. Calibralo moviéndolo en el aire dibujando un ocho."
                  : "Tu teléfono no entrega el rumbo (brújula). Usá el texto de arriba; si la flecha aparece, calibrá el sensor moviendo el teléfono en forma de ocho."}
              </Texto>
            )}
            {sensores.precisionM !== null ? (
              <Texto suave pequeno>
                Precisión del GPS: unos {Math.round(sensores.precisionM)} m.
              </Texto>
            ) : null}
          </>
        )}
      </Tarjeta>

      <Tarjeta>
        <Aviso tono="aviso" icono="advertencia">
          {AVISO_SEGURIDAD}
        </Aviso>
        <Texto suave pequeno>
          {datos.desdeCache
            ? `Sin conexión: datos guardados el ${formatearGuardado(datos.guardadoEn)}.`
            : `Datos guardados el ${formatearGuardado(datos.guardadoEn)}.`}{" "}
          La capacidad de los centros es SIMULADA; qué edificio funciona como centro lo define la autoridad.
        </Texto>
      </Tarjeta>

      <Enlace titulo="Actualizar datos" onPress={() => void cargar()} />
      <Boton titulo="Volver" variante="secundario" onPress={volver} />
    </Pantalla>
  );
}
