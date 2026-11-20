import { useRouter } from "expo-router";
import { Linking, Text } from "react-native";

import { Encabezado } from "@/components/Piezas";
import { Boton, COLOR, Insignia, Pantalla, Tarjeta, Texto, Titulo } from "@/components/ui";

/** Teléfonos de emergencia. Fuente: argentina.gob.ar, consultada el 19/11/2026. */
export const TELEFONOS = [
  { numero: "103", nombre: "Defensa Civil" },
  { numero: "106", nombre: "Prefectura Naval" },
  { numero: "911", nombre: "Policía y emergencias" },
  { numero: "105", nombre: "Emergencias ambientales" },
] as const;

export const FUENTE_TELEFONOS = "https://www.argentina.gob.ar/tema/emergencias";
export const FECHA_CONSULTA = "19/11/2026";

const SI_SUBE_EL_RIO = [
  "Mantenete informado: mirá las Alertas de la aplicación y escuchá la radio local.",
  "La decisión de evacuar la toman las autoridades. Si te avisan, salí con tiempo, de día y por caminos secos.",
  "No cruces caminos anegados ni cauces con agua, ni a pie ni en vehículo.",
  "Si tenés animales, llevalos a un lugar alto antes de que se corten los caminos.",
  "Avisale a tu familia y a tus vecinos adónde vas a ir.",
];

const QUE_LLEVAR = [
  "Documentos y los remedios que tomes.",
  "Agua potable y comida que no necesite heladera.",
  "Ropa de abrigo y calzado cerrado.",
  "Linterna, teléfono cargado y batería externa.",
  "Lo necesario para bebés, personas mayores y mascotas.",
];

const POR_SMS = [
  "Tocá «Pedir ayuda por SMS» en la pantalla de inicio.",
  "Tomá tu ubicación (el GPS funciona sin datos), indicá cuántas personas y animales son y escribí qué necesitás.",
  "Se abre la app de mensajes con el texto ya armado: revisalo y tocá enviar. La aplicación nunca envía nada sola.",
];

function Lista({ items }: { items: string[] }) {
  return (
    <>
      {items.map((t) => (
        <Text key={t} style={{ fontSize: 16, lineHeight: 23, color: COLOR.texto }}>
          {"•"} {t}
        </Text>
      ))}
    </>
  );
}

/**
 * Guía fija de «Qué hacer». Son textos escritos de antemano (sin IA ni conexión). Los teléfonos son
 * DOCUMENTO DE REFERENCIA; el resto son recomendaciones generales, sin cifras.
 */
export default function QueHacer() {
  const router = useRouter();
  return (
    <Pantalla>
      <Titulo>Qué hacer</Titulo>
      <Texto suave>
        Una guía corta para cuando el río sube o llueve fuerte. Funciona sin internet. No reemplaza las
        indicaciones de Defensa Civil ni de las autoridades.
      </Texto>

      <Tarjeta>
        <Encabezado icono="alerta">A quién llamar</Encabezado>
        {TELEFONOS.map((t) => (
          <Boton
            key={t.numero}
            titulo={`Llamar al ${t.numero} · ${t.nombre}`}
            variante={t.numero === "103" ? "primario" : "secundario"}
            onPress={() => void Linking.openURL(`tel:${t.numero}`)}
          />
        ))}
        <Insignia categoria="DOCUMENTO DE REFERENCIA" />
        <Texto suave pequeno>
          Fuente: {FUENTE_TELEFONOS} · consultado el {FECHA_CONSULTA}.
        </Texto>
      </Tarjeta>

      <Tarjeta>
        <Encabezado icono="gota">Si el río sube o llueve mucho</Encabezado>
        <Lista items={SI_SUBE_EL_RIO} />
      </Tarjeta>

      <Tarjeta>
        <Encabezado icono="tarea">Qué llevar</Encabezado>
        <Lista items={QUE_LLEVAR} />
      </Tarjeta>

      <Tarjeta>
        <Encabezado icono="bandeja">Si no tenés internet: avisar por SMS</Encabezado>
        <Lista items={POR_SMS} />
        <Texto suave pequeno>
          El canal de mensajes de esta demostración es SIMULADO: no llega a ninguna autoridad real. En una
          emergencia de verdad, llamá.
        </Texto>
        <Insignia categoria="SIMULADO" />
      </Tarjeta>

      <Boton titulo="Volver" variante="secundario" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
    </Pantalla>
  );
}
