/**
 * Codificador del mensaje SOS-FSA (CLAUDE.md §5.5 y §8.10). Debe coincidir con el parser del backend
 * (`apps/backend/app/domain/parser_mensajes.py::parsear_sos`):
 *
 *   SOS-FSA|lat,lon|PERFIL|FAM:n|BOV:n(detalle)|ACC:texto|texto libre
 *
 * Reglas del parser que se respetan aquí:
 * - lat,lon con punto decimal; `|` separa campos, por lo que ningún texto puede contener `|`.
 * - PERFIL: CIUDADANO o PRODUCTOR.
 * - FAM: 1 a 3 dígitos. BOV: hasta 5 dígitos; el detalle admite hasta 80 caracteres sin paréntesis.
 * - ACC se recorta a 60 caracteres; el texto libre a 500 y se le quitan los caracteres de control.
 * - Un texto libre que empiece con FAM:, BOV: o ACC: se interpretaría como campo, por eso se escapa.
 * - El mensaje debe informar personas, animales o un texto; si no, el backend responde 422.
 *
 * El parser solo conoce BOV como "animales": la especie viaja en el detalle (`BOV:20(ovinos)`) y el
 * tipo de pedido como prefijo del texto libre (`Pedido: evacuación.`), porque el formato no tiene
 * campos propios para ellos. Los límites de FAM (500 personas) y BOV (100000) siguen los de
 * `SolicitudIn` del backend.
 *
 * Esta función nunca envía nada: solo arma el texto que se pasa a la app de SMS del teléfono.
 */

import { Platform } from "react-native";

export type PerfilSOS = "ciudadano" | "productor";

export const ESPECIES_SOS = ["bovinos", "ovinos", "caprinos", "porcinos", "equinos", "colmenas"] as const;
export type EspecieSOS = (typeof ESPECIES_SOS)[number];

export const MAX_PERSONAS = 500;
export const MAX_ANIMALES = 100000;

export type EntradaSOS = {
  lat: number;
  lon: number;
  perfil: PerfilSOS;
  familiares?: number;
  /** Cantidad de animales (campo BOV del parser, sea cual sea la especie). */
  bovinos?: number;
  /** Especie: se agrega al detalle de BOV. */
  especie?: EspecieSOS | null;
  detalleBovinos?: string | null;
  /** Tipo de pedido en palabras; se antepone al texto libre. */
  tipoPedido?: string | null;
  acceso?: string | null;
  texto?: string | null;
};

export const MAX_TEXTO_SOS = 500;
export const MAX_ACCESO_SOS = 60;
export const MAX_DETALLE_BOV = 80;

const CONTROL = /[\x00-\x1f\x7f]/g;

function limpiar(valor: string | null | undefined, maximo: number, quitarParentesis = false): string {
  let t = (valor ?? "").replace(CONTROL, " ").replace(/\|/g, "/");
  if (quitarParentesis) t = t.replace(/[()]/g, "");
  return t.replace(/\s+/g, " ").trim().slice(0, maximo).trim();
}

function entero(n: number | undefined, maximo: number): number {
  if (n === undefined || !Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.trunc(n), maximo);
}

/** 5 decimales (~1 m) sin ceros sobrantes, con punto decimal: lo que espera el parser del backend. */
function coord(n: number): string {
  return String(Number(n.toFixed(5)));
}

export class ErrorSOS extends Error {}

export function codificarSOS(e: EntradaSOS): string {
  if (!Number.isFinite(e.lat) || !Number.isFinite(e.lon)) {
    throw new ErrorSOS("Coordenadas inválidas");
  }
  if (Math.abs(e.lat) > 90 || Math.abs(e.lon) > 180) {
    throw new ErrorSOS("Coordenadas fuera de rango");
  }
  const familiares = entero(e.familiares, MAX_PERSONAS);
  const bovinos = entero(e.bovinos, MAX_ANIMALES);
  let texto = limpiar(e.texto, MAX_TEXTO_SOS);
  if (familiares === 0 && bovinos === 0 && texto === "") {
    throw new ErrorSOS("Indicar personas, animales o un texto");
  }
  const tipo = limpiar(e.tipoPedido, 40);
  if (tipo) texto = limpiar(`Pedido: ${tipo}. ${texto}`, MAX_TEXTO_SOS);
  if (/^(FAM|BOV|ACC):/i.test(texto)) texto = `- ${texto}`.slice(0, MAX_TEXTO_SOS);

  const partes = [
    "SOS-FSA",
    `${coord(e.lat)},${coord(e.lon)}`,
    e.perfil === "productor" ? "PRODUCTOR" : "CIUDADANO",
  ];
  if (familiares > 0) partes.push(`FAM:${familiares}`);
  if (bovinos > 0) {
    const detalle = limpiar(
      [e.especie, e.detalleBovinos].filter((x) => x && x.trim()).join(", "),
      MAX_DETALLE_BOV,
      true,
    );
    partes.push(detalle ? `BOV:${bovinos}(${detalle})` : `BOV:${bovinos}`);
  }
  const acceso = limpiar(e.acceso, MAX_ACCESO_SOS);
  if (acceso) partes.push(`ACC:${acceso}`);
  if (texto) partes.push(texto);
  return partes.join("|");
}

/**
 * Enlace `sms:` que abre la app de mensajes con el texto cargado (el usuario decide enviarlo).
 * Android usa `sms:<número>?body=`; iOS usa `sms:<número>&body=`. Sin destinatario queda
 * `sms:?body=` / `sms:&body=`: la app de mensajes deja elegir a quién enviarlo.
 */
export function enlaceSMS(numero: string, cuerpo: string, os: string = Platform.OS): string {
  const destino = numero.replace(/[^\d+]/g, "");
  const separador = os === "ios" ? "&" : "?";
  return `sms:${destino}${separador}body=${encodeURIComponent(cuerpo)}`;
}
