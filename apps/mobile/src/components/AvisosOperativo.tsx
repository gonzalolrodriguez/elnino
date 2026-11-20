import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Icono } from "@/components/Icono";
import { MapaAbierto } from "@/components/mapa/MapaAbierto";
import { Aviso, Chip, Chips, Disco, Encabezado } from "@/components/Piezas";
import { Boton, COLOR, ErrorCaja, Insignia, Tarjeta, Texto } from "@/components/ui";
import { esAvisoLeido } from "@/lib/cola";
import { useCola } from "@/lib/ColaContext";
import { capasDeDesvio, contarSinLeer, estaLeido, estiloTipoAviso, ordenarAvisos, resumenDesvio, type AvisoCuadrilla } from "@/lib/cuadrillas";
import { guardarCache, leerCache } from "@/lib/cacheLocal";
import { formatearFechaHora } from "@/lib/etiquetas";
import { claveEquipoTildado, useAvisosCuadrilla } from "@/lib/useCuadrilla";
import { useUsuario } from "@/lib/SesionContext";

/**
 * «Qué llevar»: lista que la cuadrilla va tildando antes de salir. Lo tildado se guarda en el teléfono (caché
 * personal: se borra cuando la sesión termina) para que no se pierda al cerrar la app ni sin señal.
 */
export function ChecklistEquipo({ aviso }: { aviso: Pick<AvisoCuadrilla, "id" | "items"> }) {
  const usuario = useUsuario();
  const clave = claveEquipoTildado(usuario.id, aviso.id);
  const [hechos, setHechos] = useState<string[]>([]);
  const items = aviso.items ?? [];

  useEffect(() => {
    let vivo = true;
    (async () => {
      const g = await leerCache<string[]>(clave);
      if (vivo && Array.isArray(g?.valor)) setHechos(g.valor.filter((x) => typeof x === "string"));
    })();
    return () => {
      vivo = false;
    };
  }, [clave]);

  const alternar = (item: string) => {
    const nuevos = hechos.includes(item) ? hechos.filter((h) => h !== item) : [...hechos, item];
    setHechos(nuevos);
    void guardarCache(clave, nuevos);
  };

  if (items.length === 0) return null;
  const listos = items.filter((i) => hechos.includes(i)).length;
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontWeight: "700", color: COLOR.texto }} accessibilityLiveRegion="polite">
        Qué llevar: {listos} de {items.length} cargados
      </Text>
      {items.map((item) => {
        const hecho = hechos.includes(item);
        return (
          <Pressable
            key={item}
            accessibilityRole="checkbox"
            accessibilityLabel={item}
            accessibilityState={{ checked: hecho }}
            onPress={() => alternar(item)}
            style={({ pressed }) => ({ flexDirection: "row", gap: 12, minHeight: 48, alignItems: "center", opacity: pressed ? 0.7 : 1 })}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: hecho ? COLOR.primario : COLOR.trazo,
                backgroundColor: hecho ? COLOR.primario : COLOR.superficie,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {hecho ? <Icono nombre="tilde" tam={18} color={COLOR.papel} /> : null}
            </View>
            <Text
              maxFontSizeMultiplier={1.6}
              style={{ flex: 1, fontSize: 16, lineHeight: 22, color: hecho ? COLOR.suave : COLOR.texto, textDecorationLine: hecho ? "line-through" : "none" }}
            >
              {item}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TarjetaAviso({
  aviso,
  leido,
  mapaVisible,
  alAlternarMapa,
  alLeido,
}: {
  aviso: AvisoCuadrilla;
  leido: boolean;
  mapaVisible: boolean;
  alAlternarMapa: () => void;
  alLeido: () => Promise<string | null>;
}) {
  const { tono, icono, etiqueta } = estiloTipoAviso(aviso.tipo);
  const [error, setError] = useState<string | null>(null);
  const [marcando, setMarcando] = useState(false);
  const capas = useMemo(() => capasDeDesvio(aviso), [aviso]);
  const resumen = aviso.tipo === "desvio" ? resumenDesvio(aviso) : null;

  const marcar = async () => {
    setMarcando(true);
    setError(null);
    try {
      setError(await alLeido());
    } finally {
      setMarcando(false);
    }
  };

  return (
    <Tarjeta>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Disco tono={leido ? "neutro" : tono} icono={icono} tam={40} />
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.6} style={{ flex: 1, fontWeight: "700", fontSize: 17, lineHeight: 23, color: COLOR.texto }}>
          {etiqueta}
        </Text>
      </View>
      <Chips>
        <Chip tono={leido ? "ok" : "aviso"} icono={leido ? "tilde" : "campana"} texto={leido ? "Leído" : "Sin leer"} />
        {aviso.tarea_id ? <Chip icono="tarea" texto={`Tarea #${aviso.tarea_id}`} /> : null}
      </Chips>
      <Texto>{aviso.texto}</Texto>
      {leido && aviso.leido_en === null ? (
        <Texto suave pequeno>
          Marcado como leído en este teléfono: se le avisa al operativo cuando haya conexión.
        </Texto>
      ) : null}

      {aviso.tipo === "equipamiento" ? <ChecklistEquipo aviso={aviso} /> : null}

      {resumen ? (
        <>
          <Texto suave>{resumen}</Texto>
          <Boton titulo={mapaVisible ? "Ocultar el desvío" : "Ver el desvío en el mapa"} variante="secundario" icono="flecha" onPress={alAlternarMapa} />
          {mapaVisible ? (
            <MapaAbierto
              etiqueta="Mapa con el desvío indicado por el operativo"
              alto={280}
              lineas={capas.lineas}
              puntos={capas.puntos}
              encuadre={capas.encuadre}
              zoomMax={16}
            />
          ) : null}
        </>
      ) : null}

      <Text style={{ color: COLOR.suave, fontSize: 13 }} maxFontSizeMultiplier={1.5}>
        {formatearFechaHora(aviso.creado_en)}
      </Text>
      {error ? <ErrorCaja mensaje={error} /> : null}
      {!leido ? <Boton titulo="Marcar como leído" icono="tilde" onPress={() => void marcar()} cargando={marcando} /> : null}
      <Insignia categoria="SIMULADO" />
    </Tarjeta>
  );
}

/**
 * Avisos del operativo a la cuadrilla, arriba de todo en el modo cuadrilla: sin leer primero. «Marcar como
 * leído» pasa por la cola offline (queda en el teléfono y se envía solo cuando haya conexión). El desvío se
 * dibuja en el mapa abierto; la lista de «qué llevar» se tilda y se guarda en el teléfono.
 */
export function AvisosOperativo({ cuadrillaId }: { cuadrillaId: number }) {
  const { avisos, copia, error, recargar } = useAvisosCuadrilla(cuadrillaId);
  const { items, enviar } = useCola();
  const [mapaDe, setMapaDe] = useState<number | null>(null);

  // Marcas hechas en este teléfono que todavía esperan al servidor (o ya llegaron pero la lista no se refrescó).
  const leidosLocales = useMemo(
    () => new Set(items.filter((i) => esAvisoLeido(i.datos) && i.estado !== "rechazada").map((i) => (i.datos as { aviso_id: number }).aviso_id)),
    [items],
  );

  const marcarLeido = async (aviso: AvisoCuadrilla): Promise<string | null> => {
    try {
      const r = await enviar({ clase: "aviso_leido", aviso_id: aviso.id, cuadrilla_id: cuadrillaId }, null);
      if (r.rechazada) return `El servidor no aceptó la marca: ${r.rechazada}`;
      if (r.enviadaYa) void recargar();
      return null;
    } catch {
      return "No se pudo guardar la marca en el teléfono.";
    }
  };

  if (error) {
    return (
      <Tarjeta>
        <Encabezado icono="campana">Avisos del operativo</Encabezado>
        <ErrorCaja mensaje={error} onReintentar={recargar} />
      </Tarjeta>
    );
  }
  if (avisos === null) return null;

  const ordenados = ordenarAvisos(avisos, leidosLocales);
  const sinLeer = contarSinLeer(avisos, leidosLocales);
  return (
    <View style={{ gap: 12 }}>
      <Encabezado icono="campana">Avisos del operativo</Encabezado>
      {sinLeer > 0 ? (
        <Aviso tono="aviso" icono="campana">
          {sinLeer === 1 ? "Tenés 1 aviso sin leer del operativo." : `Tenés ${sinLeer} avisos sin leer del operativo.`}
        </Aviso>
      ) : null}
      {copia !== null ? (
        <Texto suave pequeno>
          Sin conexión: se muestra lo último guardado, actualizado el {formatearFechaHora(new Date(copia).toISOString())}.
        </Texto>
      ) : null}
      {ordenados.length === 0 ? <Texto suave>El operativo todavía no te mandó avisos.</Texto> : null}
      {ordenados.map((a) => (
        <TarjetaAviso
          key={a.id}
          aviso={a}
          leido={estaLeido(a, leidosLocales)}
          mapaVisible={mapaDe === a.id}
          alAlternarMapa={() => setMapaDe((v) => (v === a.id ? null : a.id))}
          alLeido={() => marcarLeido(a)}
        />
      ))}
    </View>
  );
}
