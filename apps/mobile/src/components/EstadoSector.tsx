import { useCallback, useEffect, useState } from "react";
import { Text } from "react-native";

import { EnlaceBrujula } from "@/components/EnlaceBrujula";
import { TarjetaConfirmacion, useConsultas } from "@/components/TarjetaConfirmacion";
import { TarjetaCuadrillaEnCamino } from "@/components/TarjetaCuadrillaEnCamino";
import { COLOR, Cargando, Insignia, Subtitulo, Tarjeta, Texto } from "@/components/ui";
import { guardarCache, leerCache } from "@/lib/cacheLocal";
import { etiquetaEstadoSector, etiquetaTipoOrden, formatearFechaHora } from "@/lib/etiquetas";
import { obtenerUrlServidor } from "@/lib/servidor";
import { api, type MiSector } from "@/lib/servicios";
import { useUsuario } from "@/lib/SesionContext";

type Vista =
  | { tipo: "cargando" }
  | { tipo: "ok"; sector: MiSector; actualizado: number; desdeCache: boolean }
  | { tipo: "sin_datos" };

const COLOR_ESTADO = { normal: COLOR.ok, en_riesgo: COLOR.avisoTexto, comprometido: COLOR.error } as const;

/**
 * «Estado de tu sector»: lo primero que ve la ciudadanía y los productores. Se actualiza con
 * `GET /mi/sector`; la última respuesta se guarda en el teléfono y, sin conexión, se muestra con su
 * fecha («actualizado el …») para que nadie tome por vigente un dato viejo.
 */
export function EstadoSector() {
  return (
    <>
      <ConsultasPendientes />
      <EnlaceBrujula />
      <TarjetaCuadrillaEnCamino />
      <TarjetaSector />
    </>
  );
}

/** Consultas de traslado sin responder: van arriba de todo, porque piden una respuesta de la persona. */
function ConsultasPendientes() {
  const { consultas, recargar } = useConsultas();
  return (
    <>
      {consultas
        .filter((c) => !c.respondida)
        .map((c) => (
          <TarjetaConfirmacion
            key={`${c.id}-${c.codigo}`}
            solicitudId={c.solicitud_id}
            codigo={c.codigo}
            centroNombre={c.centro_nombre}
            alResponder={() => void recargar()}
          />
        ))}
    </>
  );
}

function TarjetaSector() {
  const usuario = useUsuario();
  const [vista, setVista] = useState<Vista>({ tipo: "cargando" });
  const clave = `mi_sector:${usuario.id}:${obtenerUrlServidor()}`;

  const cargar = useCallback(async () => {
    try {
      const sector = await api.miSector();
      const ahora = Date.now();
      setVista({ tipo: "ok", sector, actualizado: ahora, desdeCache: false });
      await guardarCache(clave, sector, ahora);
    } catch {
      const guardado = await leerCache<MiSector>(clave);
      setVista(
        guardado
          ? { tipo: "ok", sector: guardado.valor, actualizado: guardado.guardadoEn, desdeCache: true }
          : { tipo: "sin_datos" },
      );
    }
  }, [clave]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (vista.tipo === "cargando") return <Cargando texto="Cargando el estado de tu sector…" />;
  if (vista.tipo === "sin_datos") {
    return (
      <Tarjeta>
        <Subtitulo>Estado de tu sector</Subtitulo>
        <Texto suave>
          Todavía no pudimos consultar tu sector y no hay nada guardado en el teléfono. Se va a mostrar
          apenas haya conexión.
        </Texto>
      </Tarjeta>
    );
  }

  const { sector, actualizado, desdeCache } = vista;
  const centro = sector.centro_asignado?.personas ?? sector.centro_asignado?.animales ?? null;
  const ordenes = sector.sectores.flatMap((s) => s.alertas.map((a) => ({ ...a, sector: s.id })));
  const ultima = ordenes.sort((a, b) => b.orden_id - a.orden_id)[0] ?? null;

  return (
    <Tarjeta>
      <Subtitulo>Estado de tu sector</Subtitulo>
      {sector.sectores.length === 0 ? (
        <Texto suave>Todavía no tenés un sector asignado. Cargá tu domicilio o tu establecimiento en Perfil.</Texto>
      ) : (
        sector.sectores.map((s) => (
          <Text key={s.id} style={{ fontWeight: "700", fontSize: 16, color: COLOR_ESTADO[s.estado] ?? COLOR.texto }}>
            {s.nombre}: {etiquetaEstadoSector(s.estado)}
            {s.aislado ? " · aislado (sin accesos transitables)" : ""}
          </Text>
        ))
      )}
      {centro ? <Texto>Centro de recepción sugerido: {centro.nombre}</Texto> : null}
      {ultima ? (
        <Texto>
          Última orden: {etiquetaTipoOrden(ultima.tipo)}. {ultima.fundamento}
        </Texto>
      ) : (
        <Texto suave>No hay órdenes ni alertas para tu sector.</Texto>
      )}
      <Insignia categoria={sector.sectores[0]?.categoria ?? "SIMULADO"} />
      <Texto suave pequeno>
        {desdeCache
          ? `Sin conexión: se muestra lo último guardado, actualizado el ${formatearFechaHora(actualizado)}.`
          : `Actualizado el ${formatearFechaHora(actualizado)}.`}
      </Texto>
    </Tarjeta>
  );
}
