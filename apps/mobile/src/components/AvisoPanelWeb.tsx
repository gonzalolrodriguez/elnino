import { Subtitulo, Tarjeta, Texto } from "@/components/ui";
import { hostDeUrl, obtenerUrlServidor } from "@/lib/servidor";

/**
 * Aviso para los roles institucionales: la app muestra sus alertas, pero el trabajo (monitor,
 * simulador, órdenes, bitácora) se hace en el panel web. El puerto 5173 es el de la web en la red de
 * la demostración (README, «Puertos»); no se inventa ninguna dirección fija.
 */
export function AvisoPanelWeb() {
  const host = hostDeUrl(obtenerUrlServidor());
  return (
    <Tarjeta>
      <Subtitulo>Tu panel completo está en la web</Subtitulo>
      <Texto>
        Desde esta aplicación ves tus alertas y un resumen de solo lectura. El simulador, las órdenes y
        la bitácora están en el panel web: abrilo desde una computadora e ingresá con la misma cuenta.
      </Texto>
      <Texto suave>
        {host
          ? `En la red de la demostración, la web se abre en la misma computadora del servidor (${host}), en el puerto 5173: http://${host}:5173`
          : "Pedile a quien administra el servidor la dirección de la web."}
      </Texto>
    </Tarjeta>
  );
}
