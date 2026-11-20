import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icono, type NombreIcono } from "@/components/Icono";
import { CIFRAS, COLOR, ESPACIO, RADIO, TIPO } from "@/components/tema";
import { Insignia } from "@/components/ui";
import { TOQUE_MIN } from "@/lib/responsive";
import type { Categoria } from "@/lib/servicios";

/**
 * Piezas visuales compartidas por las pantallas (contraparte de los componentes del panel del
 * ciudadano de la web): chips de estado, cifras grandes, banda de estado, línea de tiempo vertical,
 * contador −/+ y escala del río. El estado nunca se comunica solo con color: siempre hay ícono y texto.
 */

export type Tono = "ok" | "aviso" | "error" | "info" | "neutro";

export const TONOS: Record<Tono, { fondo: string; linea: string; texto: string; disco: string }> = {
  ok: { fondo: COLOR.okFondo, linea: COLOR.okLinea, texto: COLOR.okTexto, disco: COLOR.ok },
  aviso: { fondo: COLOR.avisoFondo, linea: COLOR.avisoLinea, texto: COLOR.avisoTexto, disco: COLOR.aviso },
  error: { fondo: COLOR.errorFondo, linea: COLOR.errorLinea, texto: COLOR.errorTexto, disco: COLOR.error },
  info: { fondo: COLOR.cielo, linea: COLOR.infoLinea, texto: COLOR.infoTexto, disco: COLOR.primario },
  neutro: { fondo: COLOR.neutroFondo, linea: COLOR.borde, texto: COLOR.suave, disco: COLOR.neutroDisco },
};

/** Etiqueta corta con ícono: estado, rol, vehículo. Se acomoda en varias líneas si no entra. */
export function Chip({ texto, tono = "neutro", icono }: { texto: string; tono?: Tono; icono?: NombreIcono }) {
  const t = TONOS[tono];
  return (
    <View style={[estilos.chip, { backgroundColor: t.fondo, borderColor: t.linea }]}>
      {icono ? <Icono nombre={icono} tam={16} color={t.texto} /> : null}
      <Text maxFontSizeMultiplier={1.6} style={[estilos.chipTexto, { color: t.texto }]}>
        {texto}
      </Text>
    </View>
  );
}

/** Fila de chips que salta de línea. */
export function Chips({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: ESPACIO.s }}>{children}</View>;
}

/** Disco de color con ícono blanco: el "semáforo" de la banda de estado y de los pasos hechos. */
export function Disco({ tono, icono, tam = 48 }: { tono: Tono; icono: NombreIcono; tam?: number }) {
  return (
    <View
      style={{
        width: tam,
        height: tam,
        borderRadius: tam / 2,
        backgroundColor: TONOS[tono].disco,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icono nombre={icono} tam={Math.round(tam * 0.55)} color={COLOR.papel} />
    </View>
  );
}

/** Encabezado de sección con un ícono suave a la izquierda. */
export function Encabezado({ icono, children }: { icono: NombreIcono; children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: ESPACIO.s }}>
      <View style={estilos.iconoSuave}>
        <Icono nombre={icono} tam={18} color={COLOR.primario} />
      </View>
      <Text style={estilos.encabezado} accessibilityRole="header" maxFontSizeMultiplier={1.6}>
        {children}
      </Text>
    </View>
  );
}

/**
 * Cifra con rótulo y categoría: el dato protagonista de una tarjeta. El valor se achica solo si no
 * entra en una línea (fuente grande, pantalla de 320 dp) en vez de partirse.
 */
export function Cifra({
  rotulo,
  valor,
  unidad,
  categoria,
  nota,
  grande = true,
  color = COLOR.texto,
  etiquetaAccesible,
}: {
  rotulo: string;
  valor: string;
  unidad?: string;
  categoria?: Categoria;
  nota?: string;
  grande?: boolean;
  color?: string;
  /** Lectura completa para lectores de pantalla (por defecto «rótulo: valor unidad»). */
  etiquetaAccesible?: string;
}) {
  return (
    <View
      style={{ gap: 2, minWidth: 0 }}
      accessible
      accessibilityLabel={etiquetaAccesible ?? `${rotulo}: ${valor}${unidad ? ` ${unidad}` : ""}${nota ? `, ${nota}` : ""}`}
    >
      <Text maxFontSizeMultiplier={1.5} style={estilos.rotulo}>
        {rotulo}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
        <Text
          maxFontSizeMultiplier={1.3}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[grande ? TIPO.cifraGrande : TIPO.cifraMedia, CIFRAS, { color, flexShrink: 1 }]}
        >
          {valor}
        </Text>
        {unidad ? (
          <Text maxFontSizeMultiplier={1.3} style={[grande ? estilos.unidadGrande : estilos.unidad]}>
            {unidad}
          </Text>
        ) : null}
      </View>
      {nota ? (
        <Text maxFontSizeMultiplier={1.5} style={estilos.nota}>
          {nota}
        </Text>
      ) : null}
      {categoria ? <Insignia categoria={categoria} /> : null}
    </View>
  );
}

/** Baldosa de indicador (KPI) para el monitor: cifra mediana con rótulo. */
export function Kpi({ rotulo, valor, tono = "neutro", icono }: { rotulo: string; valor: string; tono?: Tono; icono?: NombreIcono }) {
  const t = TONOS[tono];
  return (
    <View
      accessible
      accessibilityLabel={`${rotulo}: ${valor}`}
      style={[estilos.kpi, { backgroundColor: t.fondo, borderColor: t.linea }]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {icono ? <Icono nombre={icono} tam={16} color={t.texto} /> : null}
        <Text maxFontSizeMultiplier={1.5} style={[estilos.rotulo, { color: t.texto, flexShrink: 1 }]}>
          {rotulo}
        </Text>
      </View>
      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit style={[TIPO.cifraMedia, CIFRAS, { color: COLOR.texto }]}>
        {valor}
      </Text>
    </View>
  );
}

/** Fila de baldosas que se reparte el ancho y salta de línea. */
export function FilaKpi({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: ESPACIO.s }}>{children}</View>;
}

/**
 * Banda de estado (como la del panel web): disco con ícono, título corto y una frase en lenguaje
 * común. Los hijos (cifra del río, escala, orden vigente) van debajo.
 */
export function Banda({
  tono,
  icono,
  titulo,
  frase,
  categoria,
  children,
}: {
  tono: Tono;
  icono: NombreIcono;
  titulo: string;
  frase: string;
  categoria?: Categoria;
  children?: ReactNode;
}) {
  const t = TONOS[tono];
  return (
    <View style={[estilos.banda, { backgroundColor: t.fondo, borderColor: t.linea }]}>
      <View style={{ flexDirection: "row", gap: ESPACIO.m, alignItems: "flex-start" }}>
        <Disco tono={tono} icono={icono} />
        <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
          <Text maxFontSizeMultiplier={1.6} style={[estilos.bandaTitulo, { color: t.texto }]} accessibilityRole="header">
            {titulo}
          </Text>
          {categoria ? <Insignia categoria={categoria} /> : null}
          <Text maxFontSizeMultiplier={1.5} style={estilos.bandaFrase}>
            {frase}
          </Text>
        </View>
      </View>
      {children}
    </View>
  );
}

const pct = (n: number): `${number}%` => `${Math.round(Math.min(1, Math.max(0, n)) * 100)}%`;

/**
 * Escala del río frente a la altura de compromiso del sector. Decorativa: el dato completo va en el
 * texto de al lado, así que no se anuncia a los lectores de pantalla.
 */
export function EscalaRio({ rio, compromiso, color, texto }: { rio: number; compromiso: number; color: string; texto: string }) {
  const tope = Math.max(compromiso, rio) * 1.15 || 1;
  const alDerecha = compromiso / tope > 0.6;
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ gap: 6, paddingTop: 6 }}>
      <View style={estilos.escala}>
        <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: pct(rio / tope), backgroundColor: COLOR.primario, borderRadius: 6 }} />
        <View style={{ position: "absolute", top: -5, bottom: -5, left: pct(compromiso / tope), width: 4, marginLeft: -2, borderRadius: 2, backgroundColor: color }} />
      </View>
      <View style={{ width: alDerecha ? pct(compromiso / tope) : undefined, marginLeft: alDerecha ? 0 : pct(compromiso / tope), alignItems: alDerecha ? "flex-end" : "flex-start" }}>
        <Text maxFontSizeMultiplier={1.4} style={[estilos.nota, { color, fontWeight: "700" }, CIFRAS]}>
          {texto}
        </Text>
      </View>
    </View>
  );
}

export type EstadoPaso = "hecho" | "actual" | "pendiente";

/**
 * Un paso de la línea de tiempo vertical (como el seguimiento de un envío): disco lleno si está hecho,
 * disco con aro si es el actual y disco vacío si falta, unidos por una línea que se pinta hasta el paso
 * siguiente ya alcanzado. La hora va a la derecha con numerales tabulares.
 */
export function Paso({
  estado,
  icono,
  etiqueta,
  hora,
  ultimo,
  siguienteHecho,
}: {
  estado: EstadoPaso;
  icono: NombreIcono;
  etiqueta: string;
  hora?: string | null;
  ultimo?: boolean;
  siguienteHecho?: boolean;
}) {
  const hecho = estado !== "pendiente";
  const lleno = estado === "hecho";
  const resumen = `${etiqueta}: ${estado === "actual" ? "paso actual" : lleno ? "listo" : "pendiente"}${hora ? `, ${hora}` : ""}`;
  return (
    <View accessible accessibilityLabel={resumen} style={{ flexDirection: "row", gap: ESPACIO.m }}>
      <View style={{ alignItems: "center", width: 36 }}>
        <View
          style={[
            estilos.discoPaso,
            hecho ? { backgroundColor: COLOR.primario, borderColor: COLOR.primario } : { backgroundColor: COLOR.superficie, borderColor: COLOR.trazo },
            estado === "actual" && estilos.discoActual,
          ]}
        >
          <Icono nombre={icono} tam={18} color={hecho ? COLOR.papel : COLOR.placeholder} />
        </View>
        {!ultimo ? (
          <View style={{ width: 3, flex: 1, minHeight: 18, marginVertical: 3, borderRadius: 2, backgroundColor: lleno && siguienteHecho ? COLOR.primario : COLOR.borde }} />
        ) : null}
      </View>
      <View style={{ flex: 1, paddingTop: 5, paddingBottom: ultimo ? 0 : ESPACIO.m, minWidth: 0 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: ESPACIO.s, flexWrap: "wrap" }}>
          <Text
            maxFontSizeMultiplier={1.6}
            style={[estado === "actual" ? TIPO.subtitulo : lleno ? TIPO.cuerpoFuerte : TIPO.cuerpo, { flexShrink: 1, color: hecho ? COLOR.texto : COLOR.suave }]}
          >
            {etiqueta}
          </Text>
          {hora ? (
            <Text maxFontSizeMultiplier={1.5} style={[estilos.nota, CIFRAS]}>
              {hora}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/**
 * Contador con −/+ (≥ 48 dp de toque) para cantidades chicas: integrantes, menores, mascotas.
 * Es un control "ajustable": con lector de pantalla se sube y baja deslizando.
 */
export function Contador({
  etiqueta,
  icono,
  valor,
  alCambiar,
  min = 0,
  max = 99,
}: {
  etiqueta: string;
  icono: NombreIcono;
  valor: number;
  alCambiar: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const poner = (n: number) => alCambiar(Math.min(max, Math.max(min, n)));
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={etiqueta}
      accessibilityValue={{ min, max, now: valor, text: String(valor) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => poner(valor + (e.nativeEvent.actionName === "increment" ? 1 : -1))}
      style={estilos.contador}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: ESPACIO.s, flex: 1, minWidth: 0 }}>
        <Icono nombre={icono} tam={22} color={COLOR.primario} />
        <Text maxFontSizeMultiplier={1.6} style={estilos.contadorEtiqueta}>
          {etiqueta}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <BotonRedondo icono="menos" etiqueta={`Menos ${etiqueta.toLowerCase()}`} deshabilitado={valor <= min} onPress={() => poner(valor - 1)} />
        <Text maxFontSizeMultiplier={1.4} style={[estilos.contadorValor, CIFRAS]}>
          {valor}
        </Text>
        <BotonRedondo icono="mas" etiqueta={`Más ${etiqueta.toLowerCase()}`} deshabilitado={valor >= max} onPress={() => poner(valor + 1)} />
      </View>
    </View>
  );
}

function BotonRedondo({ icono, etiqueta, onPress, deshabilitado }: { icono: NombreIcono; etiqueta: string; onPress: () => void; deshabilitado: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: deshabilitado }}
      disabled={deshabilitado}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [estilos.redondo, pressed && { transform: [{ scale: 0.94 }], backgroundColor: COLOR.secundarioPresionado }, deshabilitado && { opacity: 0.4 }]}
    >
      <Icono nombre={icono} tam={22} color={COLOR.primario} />
    </Pressable>
  );
}

/** Franja de aviso (novedad, advertencia) con ícono y texto. */
export function Aviso({ tono, icono, children }: { tono: Tono; icono: NombreIcono; children: ReactNode }) {
  const t = TONOS[tono];
  return (
    <View accessibilityRole={tono === "error" || tono === "aviso" ? "alert" : undefined} style={[estilos.aviso, { backgroundColor: t.fondo, borderColor: t.linea }]}>
      <View style={{ marginTop: 2 }}>
        <Icono nombre={icono} tam={20} color={t.texto} />
      </View>
      <Text maxFontSizeMultiplier={1.6} style={{ flex: 1, ...TIPO.cuerpoFuerte, color: t.texto }}>
        {children}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    borderWidth: 1,
    borderRadius: RADIO.pastilla,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: "100%",
  },
  chipTexto: { ...TIPO.pequeno, fontWeight: "700", flexShrink: 1 },
  iconoSuave: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLOR.cielo,
    alignItems: "center",
    justifyContent: "center",
  },
  encabezado: { ...TIPO.subtitulo, color: COLOR.texto, flex: 1 },
  rotulo: { ...TIPO.rotulo, color: COLOR.suave },
  nota: { ...TIPO.pequeno, color: COLOR.suave },
  unidad: { ...TIPO.cuerpo, fontWeight: "700", color: COLOR.suave },
  unidadGrande: { ...TIPO.destacado, color: COLOR.suave },
  kpi: {
    flexGrow: 1,
    flexBasis: 140,
    minWidth: 120,
    gap: 4,
    borderWidth: 1,
    borderRadius: RADIO.tarjeta,
    padding: ESPACIO.m,
  },
  banda: { borderWidth: 1, borderRadius: RADIO.tarjeta, padding: ESPACIO.l, gap: ESPACIO.m },
  bandaTitulo: { ...TIPO.cuerpoFuerte, fontWeight: "700" },
  bandaFrase: { ...TIPO.subtitulo, color: COLOR.texto },
  escala: { height: 12, borderRadius: 6, backgroundColor: COLOR.superficie, borderWidth: 1, borderColor: COLOR.contornoEscala },
  discoPaso: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  discoActual: { borderColor: COLOR.aroActual, borderWidth: 4 },
  contador: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: ESPACIO.s,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.borde,
    paddingVertical: 4,
  },
  contadorEtiqueta: { ...TIPO.cuerpo, fontWeight: "600", color: COLOR.texto, flexShrink: 1 },
  contadorValor: { ...TIPO.destacado, minWidth: 36, textAlign: "center", color: COLOR.texto },
  redondo: {
    width: TOQUE_MIN,
    height: TOQUE_MIN,
    borderRadius: TOQUE_MIN / 2,
    backgroundColor: COLOR.cielo,
    alignItems: "center",
    justifyContent: "center",
  },
  aviso: { flexDirection: "row", gap: ESPACIO.s, borderWidth: 1, borderRadius: RADIO.boton, padding: ESPACIO.m },
});
