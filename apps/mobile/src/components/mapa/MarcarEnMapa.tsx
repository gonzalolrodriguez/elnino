import { useMemo, useState } from "react";

import { MapaAbierto, type PuntoElegido } from "@/components/mapa/MapaAbierto";
import { Boton, COLOR, Insignia, Texto } from "@/components/ui";
import type { Par, SectorMapa } from "@/lib/mapaProtocolo";
import { K10_FECHA, SECTORES_K10, textoPuntoEnSector } from "@/lib/puntoEnSector";

/** Sectores K10 (SIMULADO) listos para dibujar; salen del kit y funcionan sin conexión. */
export const SECTORES_PARA_MAPA: SectorMapa[] = SECTORES_K10.map((s) => ({
  id: s.id,
  etiqueta: s.id,
  anillo: s.anillo.map(([lon, lat]) => [lon, lat] as Par),
  color: COLOR.aviso,
}));

const TODOS_LOS_SECTORES: Par[] = SECTORES_PARA_MAPA.flatMap((s) => s.anillo);

/**
 * «Marcar en el mapa»: alternativa al GPS y a la referencia escrita. Muestra los sectores K10
 * (SIMULADO) sobre OpenStreetMap; tocar el mapa o arrastrar el marcador fija el punto, y debajo
 * (como texto, fuera del mapa) se lee en qué sector cae. Si el mapa no carga, el resto del formulario
 * sigue sirviendo: GPS o referencia.
 */
export function MarcarEnMapa({
  punto,
  alCambiar,
  titulo = "Marcar en el mapa",
}: {
  punto: PuntoElegido | null;
  alCambiar: (p: PuntoElegido) => void;
  titulo?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [sinMapa, setSinMapa] = useState(false);
  // El encuadre se fija al abrir: marcar un punto no debe mover la cámara de debajo del dedo.
  const encuadre = useMemo<Par[]>(() => (punto ? [[punto.lon, punto.lat]] : TODOS_LOS_SECTORES), [abierto]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Boton
        titulo={abierto ? "Cerrar el mapa" : titulo}
        variante="secundario"
        onPress={() => {
          setSinMapa(false);
          setAbierto((v) => !v);
        }}
      />
      {abierto ? (
        <>
          <Texto suave pequeno>
            Tocá el mapa o arrastrá el marcador rojo hasta tu casa o el lugar del pedido.
          </Texto>
          <MapaAbierto
            etiqueta="Mapa para marcar tu ubicación. Si no podés usarlo, tomá tu ubicación con el GPS o escribí una referencia."
            sectores={SECTORES_PARA_MAPA}
            encuadre={encuadre}
            zoomMax={punto ? 15 : 13}
            seleccion={punto}
            alElegir={alCambiar}
            alFallar={() => setSinMapa(true)}
          />
          <Insignia categoria="SIMULADO" />
          <Texto suave pequeno>
            Sectores K10 (SIMULADO, v1.0, {K10_FECHA}).
          </Texto>
          {sinMapa ? <Texto suave pequeno>Podés usar el GPS o escribir una referencia en su lugar.</Texto> : null}
        </>
      ) : null}
      <Texto>{textoPuntoEnSector(punto?.lon, punto?.lat)}</Texto>
    </>
  );
}
