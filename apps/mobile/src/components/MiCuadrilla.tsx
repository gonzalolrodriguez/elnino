import { Text, View } from "react-native";

import { Chip, Chips, Encabezado } from "@/components/Piezas";
import { COLOR, Insignia, Tarjeta, Texto } from "@/components/ui";
import { datosDeMiCuadrilla, type CuadrillaDetalle, etiquetaProfesion, etiquetaTipoOperativo, etiquetaVehiculo } from "@/lib/cuadrillas";
import { etiquetaRolOperativo, formatearFechaHora } from "@/lib/etiquetas";
import { useUsuario } from "@/lib/SesionContext";

const funcion = (rol: string | null | undefined, profesion: string | null | undefined): string =>
  [rol ? etiquetaRolOperativo(rol) : "", etiquetaProfesion(profesion)].filter(Boolean).join(" · ");

/**
 * «Mi cuadrilla»: nombre, tipo de operativo, vehículo, tu función (rol y profesión), el encargado y el
 * equipamiento. Las personas van por rol y profesión, nunca por nombre.
 */
export function MiCuadrilla({ cuadrilla, copia }: { cuadrilla: CuadrillaDetalle; copia: number | null }) {
  const usuario = useUsuario();
  const { yo, encargado, soyEncargado } = datosDeMiCuadrilla(cuadrilla, usuario.id);
  return (
    <Tarjeta>
      <Encabezado icono="personas">Mi cuadrilla</Encabezado>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.6} style={{ fontWeight: "700", fontSize: 20, lineHeight: 26, letterSpacing: -0.2, color: COLOR.texto }}>
        {cuadrilla.nombre}
      </Text>
      <Chips>
        {cuadrilla.tipo_operativo ? <Chip icono="tarea" texto={etiquetaTipoOperativo(cuadrilla.tipo_operativo)} /> : null}
        <Chip icono="camion" texto={etiquetaVehiculo(cuadrilla.vehiculo)} />
        <Chip icono="personas" texto={`${cuadrilla.cantidad_integrantes ?? cuadrilla.integrantes.length} integrantes`} />
      </Chips>
      {yo ? <Texto>Tu función: {funcion(yo.rol_operativo, yo.profesion)}.</Texto> : null}
      {encargado ? (
        <Texto>{soyEncargado ? "Sos el encargado de la cuadrilla." : `Encargado: ${funcion(encargado.rol_operativo, encargado.profesion)}.`}</Texto>
      ) : null}
      {cuadrilla.integrantes.length > 0 ? (
        <View style={{ gap: 2 }}>
          <Text style={{ fontWeight: "600", color: COLOR.texto }}>Equipo</Text>
          {cuadrilla.integrantes.map((i) => (
            <Texto key={i.id} suave>
              {funcion(i.rol_operativo, i.profesion)}
              {i.es_encargado ? " (encargado)" : ""}
            </Texto>
          ))}
        </View>
      ) : null}
      {cuadrilla.equipamiento && cuadrilla.equipamiento.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Text style={{ fontWeight: "600", color: COLOR.texto }}>Equipamiento</Text>
          <Chips>
            {cuadrilla.equipamiento.map((e) => (
              <Chip key={e} texto={e} />
            ))}
          </Chips>
        </View>
      ) : null}
      {copia !== null ? (
        <Texto suave pequeno>
          Sin conexión: se muestra lo último guardado, actualizado el {formatearFechaHora(new Date(copia).toISOString())}.
        </Texto>
      ) : null}
      <Insignia categoria="SIMULADO" />
    </Tarjeta>
  );
}
