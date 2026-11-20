import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";

import { EnlaceBrujula } from "@/components/EnlaceBrujula";
import { TarjetaConfirmacion, useConsultas } from "@/components/TarjetaConfirmacion";
import { TarjetaCuadrillaEnCamino } from "@/components/TarjetaCuadrillaEnCamino";
import { Icono, type NombreIcono } from "@/components/Icono";
import { Aviso, Banda, Cifra, EscalaRio, TONOS, type Tono } from "@/components/Piezas";
import { CIFRAS, TIPO } from "@/components/tema";
import { COLOR, Cargando, Texto } from "@/components/ui";
import { guardarCache, leerCache } from "@/lib/cacheLocal";
import { etiquetaEstadoSector, etiquetaTipoOrden, formatearFechaHora } from "@/lib/etiquetas";
import { obtenerUrlServidor } from "@/lib/servidor";
import { api, type MiSector } from "@/lib/servicios";
import { useUsuario } from "@/lib/SesionContext";

type Vista =
  | { tipo: "cargando" }
  | { tipo: "ok"; sector: MiSector; actualizado: number; desdeCache: boolean }
  | { tipo: "sin_datos" };

/**
 * Forma + texto + color: el estado del sector nunca se comunica solo con el color. Las frases son las
 * mismas que muestra el panel web del ciudadano.
 */
const ESTADOS: Record<MiSector["sectores"][number]["estado"], { tono: Tono; icono: NombreIcono; frase: string }> = {
  normal: { tono: "ok", icono: "tilde", frase: "Tu sector está normal: por ahora no hace falta evacuar." },
  en_riesgo: {
    tono: "aviso",
    icono: "advertencia",
    frase: "Tu sector está en riesgo: el río se acerca a la altura en que se compromete. Preparate y seguí los avisos.",
  },
  comprometido: {
    tono: "error",
    icono: "alerta",
    frase:
      "Tu sector está comprometido: el río ya superó la altura en que se compromete. Seguí las indicaciones oficiales y llamá al 103 si necesitás ayuda.",
  },
};
const GRAVEDAD = { normal: 0, en_riesgo: 1, comprometido: 2 } as const;
const GRAVEDAD_ORDEN: Record<string, number> = { evacuacion: 2, evacuacion_preventiva: 1, alerta: 0 };
const metros = (n: number) => `${n.toFixed(2).replace(".", ",")} m`;

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
      <Banda
        tono="neutro"
        icono="punto"
        titulo="Estado de tu sector"
        frase="Todavía no pudimos consultar tu sector y no hay nada guardado en el teléfono. Se va a mostrar apenas haya conexión."
      />
    );
  }

  const { sector, actualizado, desdeCache } = vista;
  const centro = sector.centro_asignado?.personas ?? sector.centro_asignado?.animales ?? null;
  const ref = sector.altura_referencia;
  const ordenes = sector.sectores.flatMap((s) => s.alertas.map((a) => ({ ...a, sector: s.id })));
  const ultima =
    [...ordenes].sort(
      (a, b) => (GRAVEDAD_ORDEN[b.tipo] ?? 0) - (GRAVEDAD_ORDEN[a.tipo] ?? 0) || b.orden_id - a.orden_id,
    )[0] ?? null;
  const principal = [...sector.sectores].sort((a, b) => (GRAVEDAD[b.estado] ?? 0) - (GRAVEDAD[a.estado] ?? 0))[0] ?? null;
  const estado = principal ? (ESTADOS[principal.estado] ?? ESTADOS.normal) : null;
  const tono = estado ? TONOS[estado.tono] : TONOS.info;
  const actualizacion = desdeCache
    ? `Sin conexión: se muestra lo último guardado, actualizado el ${formatearFechaHora(actualizado)}.`
    : `Actualizado el ${formatearFechaHora(actualizado)}.`;

  // Sin sector conocido: se pide marcar el domicilio y se muestra igual la lectura del río.
  if (!principal || !estado) {
    return (
      <Banda
        tono="info"
        icono="punto"
        titulo="Todavía no sabemos en qué sector estás"
        frase="Sin tu domicilio no podemos avisarte si tu zona corre riesgo. Cargá tu domicilio o tu establecimiento en Perfil."
      >
        <Cifra rotulo="Río en Puerto Formosa" valor={metros(ref.altura_m).replace(" m", "")} unidad="m" categoria={ref.categoria} nota={`Lectura del ${ref.fecha}`} />
        <Texto suave pequeno>
          {actualizacion}
        </Texto>
      </Banda>
    );
  }

  const margen = principal.margen_a_compromiso_m;
  return (
    <Banda
      tono={estado.tono}
      icono={estado.icono}
      titulo={`${principal.id} · ${principal.nombre}: ${etiquetaEstadoSector(principal.estado)}${principal.aislado ? " · aislado (sin accesos transitables)" : ""}`}
      categoria={principal.categoria ?? "SIMULADO"}
      frase={`${estado.frase}${principal.aislado ? " Los accesos están cortados: no salgas por tu cuenta, llamá al 103." : ""}`}
    >
      <Cifra
        rotulo="Río en Puerto Formosa"
        valor={ref.altura_m.toFixed(2).replace(".", ",")}
        unidad="m"
        categoria={ref.categoria}
        nota={`Lectura del ${ref.fecha}`}
        color={COLOR.texto}
      />
      <EscalaRio rio={ref.altura_m} compromiso={principal.altura_compromiso_m} color={tono.disco} texto={`Compromiso ${metros(principal.altura_compromiso_m)}`} />
      <Text maxFontSizeMultiplier={1.5} style={[TIPO.cuerpo, CIFRAS, { color: COLOR.texto }]}>
        Tu sector se compromete a <Text style={{ fontWeight: "700" }}>{metros(principal.altura_compromiso_m)}</Text>:{" "}
        {margen >= 0 ? `faltan ${metros(margen)}` : `ya la superó por ${metros(-margen)}`}.
      </Text>
      {sector.sectores.length > 1 ? (
        <View style={{ gap: 4 }}>
          {sector.sectores
            .filter((s) => s.id !== principal.id)
            .map((s) => (
              <Text key={s.id} maxFontSizeMultiplier={1.5} style={[TIPO.etiqueta, { color: TONOS[(ESTADOS[s.estado] ?? ESTADOS.normal).tono].texto }]}>
                {s.nombre}: {etiquetaEstadoSector(s.estado)}
                {s.aislado ? " · aislado (sin accesos transitables)" : ""}
              </Text>
            ))}
        </View>
      ) : null}
      {ultima ? (
        <Aviso tono={estado.tono === "ok" ? "info" : estado.tono} icono="campana">
          Última orden: {etiquetaTipoOrden(ultima.tipo)}. {ultima.fundamento}
        </Aviso>
      ) : (
        <Texto suave>No hay órdenes ni alertas para tu sector.</Texto>
      )}
      {centro ? (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
          <View style={{ marginTop: 2 }}>
            <Icono nombre="casa" tam={20} color={COLOR.primario} />
          </View>
          <Texto>Centro de recepción sugerido: {centro.nombre}</Texto>
        </View>
      ) : null}
      <Texto suave pequeno>
        {actualizacion}
      </Texto>
    </Banda>
  );
}
