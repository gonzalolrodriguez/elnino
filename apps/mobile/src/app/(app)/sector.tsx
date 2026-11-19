import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { MapaSector } from "@/components/MapaSector";
import { Cargando, COLOR, Enlace, ErrorCaja, Insignia, Pantalla, Rejilla, Tarjeta, Texto, Titulo, Vacio } from "@/components/ui";
import { useDiseno } from "@/lib/responsive";
import { mensajeError } from "@/lib/errores";
import { api, type Centro, type GeoSectores, type MiSector } from "@/lib/servicios";

type Carga =
  | { tipo: "cargando" }
  | { tipo: "ok"; sector: MiSector; geo: GeoSectores | null; centros: Centro[] }
  | { tipo: "error"; mensaje: string };

const ESTADO_TEXTO = { normal: "Normal", en_riesgo: "En riesgo", comprometido: "Comprometido" } as const;

export default function Sector() {
  const d = useDiseno();
  const [carga, setCarga] = useState<Carga>({ tipo: "cargando" });

  const cargar = useCallback(async () => {
    try {
      const sector = await api.miSector();
      // `GET /mi/sector` ya trae la geometría y las coordenadas del centro. Solo si faltan (backend
      // anterior) se consultan `/sectores` y `/centros`. El mapa es complementario: si fallan, se
      // muestra el resto.
      const faltaGeo = sector.sectores.some((s) => !s.geometria);
      const sug = sector.centro_asignado?.personas ?? sector.centro_asignado?.animales ?? null;
      const faltaCentro = sug !== null && (sug.lon == null || sug.lat == null);
      const [geo, centros] = await Promise.all([
        faltaGeo ? api.sectoresGeo().catch(() => null) : Promise.resolve(null),
        faltaCentro
          ? api.centros().then((r) => r.centros).catch(() => [] as Centro[])
          : Promise.resolve([] as Centro[]),
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
  const centroMapa = useMemo(() => {
    if (!ok || !asignado) return null;
    if (asignado.lon != null && asignado.lat != null) {
      return { nombre: asignado.nombre, lon: asignado.lon, lat: asignado.lat };
    }
    return ok.centros.find((c) => c.id === asignado.id) ?? null;
  }, [ok, asignado]);
  const geoMapa = useMemo<GeoSectores | null>(() => {
    if (!ok) return null;
    const propios = ok.sector.sectores.flatMap((s) =>
      s.geometria
        ? [{ geometry: s.geometria, properties: { id: s.id, nombre: s.nombre, categoria: s.categoria } }]
        : [],
    );
    const ids = new Set(propios.map((f) => f.properties.id));
    const respaldo = (ok.geo?.features ?? []).filter((f) => !ids.has(f.properties.id));
    return { features: [...propios, ...respaldo] };
  }, [ok]);

  const mapa =
    ok && ok.sector.sectores.length > 0 ? (
      <MapaSector geo={geoMapa} estados={estados} centro={centroMapa} alto={d.columnas === 2 ? "lleno" : undefined} />
    ) : null;

  const detalle = ok ? (
    <>
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

      <Rejilla>
        {ok.sector.sectores.map((s) => (
          <Tarjeta key={s.id}>
            <Text style={{ fontWeight: "700", fontSize: 16 }}>
              {s.id} · {s.nombre}
            </Text>
            <Text
              style={{
                fontWeight: "700",
                color: s.estado === "comprometido" ? COLOR.error : s.estado === "en_riesgo" ? COLOR.avisoTexto : COLOR.ok,
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
      </Rejilla>

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
      <Enlace titulo="Actualizar" onPress={cargar} />
    </>
  ) : null;

  const vacio =
    ok && ok.sector.sectores.length === 0 ? (
      <Vacio texto="Todavía no tenés un sector asignado. Cargá tu domicilio o tu establecimiento en Perfil." />
    ) : null;

  // Tablet ancha (>= 840 dp): el mapa ocupa la mitad izquierda a todo el alto y el detalle se
  // desplaza a la derecha, sin que el scroll de la página tape el mapa.
  if (ok && d.columnas === 2 && mapa) {
    return (
      <View style={{ flex: 1, flexDirection: "row", padding: d.margen, gap: d.margen }}>
        <View style={{ flex: 1, gap: d.paso }}>
          <Titulo>Mi sector</Titulo>
          {mapa}
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: d.paso, paddingBottom: d.insets.bottom }}>
          {detalle}
        </ScrollView>
      </View>
    );
  }

  return (
    <Pantalla dosColumnas>
      <Titulo>Mi sector</Titulo>
      {carga.tipo === "cargando" ? <Cargando texto="Cargando tu sector…" /> : null}
      {carga.tipo === "error" ? <ErrorCaja mensaje={carga.mensaje} onReintentar={cargar} /> : null}
      {vacio}
      {mapa}
      {detalle}
    </Pantalla>
  );
}
