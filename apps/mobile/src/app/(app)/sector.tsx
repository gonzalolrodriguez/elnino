import { useCallback, useEffect, useMemo, useState } from "react";
import { Text } from "react-native";

import { MapaSector } from "@/components/MapaSector";
import { Boton, Cargando, COLOR, ErrorCaja, Insignia, Pantalla, Tarjeta, Texto, Titulo, Vacio } from "@/components/ui";
import { mensajeError } from "@/lib/errores";
import { api, type Centro, type GeoSectores, type MiSector } from "@/lib/servicios";

type Carga =
  | { tipo: "cargando" }
  | { tipo: "ok"; sector: MiSector; geo: GeoSectores | null; centros: Centro[] }
  | { tipo: "error"; mensaje: string };

const ESTADO_TEXTO = { normal: "Normal", en_riesgo: "En riesgo", comprometido: "Comprometido" } as const;

export default function Sector() {
  const [carga, setCarga] = useState<Carga>({ tipo: "cargando" });

  const cargar = useCallback(async () => {
    try {
      const sector = await api.miSector();
      // El mapa es complementario: si falla la geometría o los centros, se muestra el resto.
      const [geo, centros] = await Promise.all([
        api.sectoresGeo().catch(() => null),
        api.centros().then((r) => r.centros).catch(() => [] as Centro[]),
      ]);
      setCarga({ tipo: "ok", sector, geo, centros });
    } catch (e) {
      setCarga({ tipo: "error", mensaje: mensajeError(e) });
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const ok = carga.tipo === "ok" ? carga : null;
  const estados = useMemo(
    () => Object.fromEntries((ok?.sector.sectores ?? []).map((s) => [s.id, s.estado])),
    [ok],
  );
  const asignado = ok?.sector.centro_asignado?.personas ?? ok?.sector.centro_asignado?.animales ?? null;
  const centroMapa = ok && asignado ? (ok.centros.find((c) => c.id === asignado.id) ?? null) : null;

  return (
    <Pantalla>
      <Titulo>Mi sector</Titulo>
      {carga.tipo === "cargando" ? <Cargando texto="Cargando tu sector…" /> : null}
      {carga.tipo === "error" ? <ErrorCaja mensaje={carga.mensaje} onReintentar={cargar} /> : null}

      {ok ? (
        <>
          {ok.sector.sectores.length === 0 ? (
            <Vacio texto="Todavía no tenés un sector asignado. Cargá tu domicilio o tu establecimiento en Perfil." />
          ) : (
            <MapaSector geo={ok.geo} estados={estados} centro={centroMapa} />
          )}
          <Texto suave>{ok.sector.nota}</Texto>

          <Tarjeta>
            <Text style={{ fontWeight: "600" }}>
              Altura de referencia: {ok.sector.altura_referencia.altura_m.toFixed(2)} m
            </Text>
            <Texto suave>
              {ok.sector.altura_referencia.fecha} · {ok.sector.altura_referencia.fuente}
            </Texto>
            <Insignia categoria={ok.sector.altura_referencia.categoria} />
          </Tarjeta>

          {ok.sector.sectores.map((s) => (
            <Tarjeta key={s.id}>
              <Text style={{ fontWeight: "700", fontSize: 16 }}>
                {s.id} · {s.nombre}
              </Text>
              <Text
                style={{
                  fontWeight: "700",
                  color: s.estado === "comprometido" ? COLOR.error : s.estado === "en_riesgo" ? COLOR.aviso : COLOR.ok,
                }}
              >
                {ESTADO_TEXTO[s.estado]}
                {s.aislado ? " · aislado (sin accesos transitables)" : ""}
              </Text>
              <Texto>Altura de compromiso: {s.altura_compromiso_m.toFixed(2)} m</Texto>
              <Texto>Margen: {s.margen_a_compromiso_m.toFixed(2)} m</Texto>
              {s.accesos.map((a, i) => (
                <Texto key={`${s.id}-${i}`} suave>
                  Acceso {a.nombre} ({a.superficie}): {a.estado}
                </Texto>
              ))}
              {s.alertas.map((a) => (
                <Texto key={a.orden_id}>
                  Orden #{a.orden_id} ({a.tipo}): {a.fundamento}
                </Texto>
              ))}
              <Insignia categoria={s.categoria} />
            </Tarjeta>
          ))}

          {ok.sector.centro_asignado ? (
            <Tarjeta>
              <Text style={{ fontWeight: "700" }}>Centro de recepción sugerido</Text>
              {asignado ? (
                <>
                  <Texto>
                    {asignado.nombre} · a {Math.round(asignado.distancia_linea_recta_m)} m en línea recta
                  </Texto>
                  <Insignia categoria={asignado.categoria} />
                </>
              ) : (
                <Texto suave>No hay un centro con cupo para tu caso.</Texto>
              )}
              <Texto suave>{ok.sector.centro_asignado.nota}</Texto>
            </Tarjeta>
          ) : null}
          <Boton titulo="Actualizar" variante="secundario" onPress={cargar} />
        </>
      ) : null}
    </Pantalla>
  );
}
