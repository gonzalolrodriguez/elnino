import { Children, createContext, useContext, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { CIFRAS, COLOR, RADIO, TIPO } from "@/components/tema";
import { ANCHO_MAX, TOQUE_MIN, useDiseno } from "@/lib/responsive";
import type { Categoria } from "@/lib/servicios";

export { COLOR, RADIO, TIPO } from "@/components/tema";

/**
 * `true` dentro de la barra de pestañas: ella ya reserva la zona segura inferior (gestos / botones
 * del sistema), así que las pantallas no deben sumarla otra vez.
 */
export const EnPestanasContext = createContext(false);

/** Cada categoría tiene su tono propio (texto sobre fondo suave) para distinguirse sin gritar. */
const ESTILO_CATEGORIA: Record<Categoria, { color: string; fondo: string }> = {
  "DATO OBSERVADO": { color: "#174A86", fondo: COLOR.cielo },
  "DOCUMENTO DE REFERENCIA": { color: "#0B5D55", fondo: "#E3F3F0" },
  SIMULADO: { color: COLOR.avisoTexto, fondo: COLOR.avisoFondo },
};

/** Categoría visible en cada cifra o capa (regla 2 de la mesa). */
export function Insignia({ categoria }: { categoria: Categoria }) {
  const e = ESTILO_CATEGORIA[categoria];
  return (
    <View style={[estilos.insignia, { backgroundColor: e.fondo }]}>
      <Text maxFontSizeMultiplier={1.5} style={[estilos.insigniaTexto, { color: e.color }]}>
        {categoria}
      </Text>
    </View>
  );
}

/**
 * Contenedor de pantalla adaptable: márgenes según la clase de dispositivo, zonas seguras laterales
 * e inferior, ancho máximo centrado en tablets y teclado que no tapa el campo enfocado.
 * `dosColumnas` permite que en tablets anchas (>= 840 dp) el contenido use hasta 960 dp para
 * disponer tarjetas con `Rejilla`.
 */
export function Pantalla({
  children,
  scroll = true,
  dosColumnas = false,
}: {
  children: ReactNode;
  scroll?: boolean;
  dosColumnas?: boolean;
}) {
  const d = useDiseno();
  const enPestanas = useContext(EnPestanasContext);
  const maximo = dosColumnas && d.columnas === 2 ? ANCHO_MAX.dos : ANCHO_MAX.una;
  const estiloContenido = {
    paddingHorizontal: d.margen,
    paddingTop: d.margen,
    paddingBottom: d.margen + (enPestanas ? 0 : d.insets.bottom),
    paddingLeft: d.margen + d.insets.left,
    paddingRight: d.margen + d.insets.right,
    gap: d.paso,
  };
  const columna = { width: "100%" as const, maxWidth: maximo + d.margen * 2, alignSelf: "center" as const };

  if (!scroll) {
    return <View style={[{ flex: 1 }, columna, estiloContenido]}>{children}</View>;
  }
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[columna, estiloContenido, { flexGrow: 1 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Reparte tarjetas en una o dos columnas según el ancho (dentro de `Pantalla dosColumnas`). */
export function Rejilla({ children }: { children: ReactNode }) {
  const d = useDiseno();
  const hijos = Children.toArray(children);
  const separacion = d.paso;
  const ancho = d.columnas === 2 ? Math.floor((d.anchoContenido - separacion) / 2) : undefined;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: separacion }}>
      {hijos.map((h, i) => (
        <View key={i} style={{ gap: separacion, ...(ancho ? { width: ancho } : { width: "100%" }) }}>
          {h}
        </View>
      ))}
    </View>
  );
}

/** Fila de botones que se acomoda en varias líneas cuando no entran (fuente grande, pantallas chicas). */
export function FilaBotones({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {Children.toArray(children).map((h, i) => (
        <View key={i} style={{ flexGrow: 1, flexBasis: 140 }}>
          {h}
        </View>
      ))}
    </View>
  );
}

export function Titulo({ children }: { children: ReactNode }) {
  return (
    <Text style={estilos.titulo} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Texto({
  children,
  suave,
  pequeno,
}: {
  children: ReactNode;
  suave?: boolean;
  pequeno?: boolean;
}) {
  return (
    <Text style={[estilos.texto, suave && { color: COLOR.suave }, pequeno && estilos.pequeno]}>
      {children}
    </Text>
  );
}

/** Encabezado de sección dentro de una pantalla o tarjeta. */
export function Subtitulo({ children }: { children: ReactNode }) {
  return <Text style={estilos.subtitulo}>{children}</Text>;
}

/** Superficie blanca con línea de 1 px; sin sombra. Agrupa un tema, no cada dato. */
export function Tarjeta({ children }: { children: ReactNode }) {
  return <View style={estilos.tarjeta}>{children}</View>;
}

/** Retroalimentación de pulsación: leve reducción de escala (160 ms) y tono más oscuro. */
const PULSADO = { transform: [{ scale: 0.97 }] };

export function Boton({
  titulo,
  onPress,
  deshabilitado,
  variante = "primario",
  cargando,
}: {
  titulo: string;
  onPress: () => void;
  deshabilitado?: boolean;
  variante?: "primario" | "secundario" | "peligro";
  cargando?: boolean;
}) {
  const apagado = deshabilitado || cargando;
  const secundario = variante === "secundario";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: !!apagado }}
      disabled={apagado}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.boton,
        secundario && estilos.botonSecundario,
        variante === "peligro" && { backgroundColor: COLOR.error },
        pressed && !apagado && PULSADO,
        pressed && !apagado && !secundario && variante === "primario" && { backgroundColor: COLOR.primarioPresionado },
        pressed && !apagado && secundario && { backgroundColor: "#D5E5F6" },
        apagado && { opacity: 0.5 },
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={secundario ? COLOR.primario : "#fff"} />
      ) : (
        <Text style={[estilos.botonTexto, secundario && { color: COLOR.primario }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

/** Acción de baja jerarquía: texto en color primario, sin relleno ni borde (≥ 48 dp de toque). */
export function Enlace({
  titulo,
  onPress,
  deshabilitado,
}: {
  titulo: string;
  onPress: () => void;
  deshabilitado?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: !!deshabilitado }}
      disabled={deshabilitado}
      onPress={onPress}
      style={({ pressed }) => [estilos.enlace, pressed && { opacity: 0.6 }, deshabilitado && { opacity: 0.5 }]}
    >
      <Text style={estilos.enlaceTexto}>{titulo}</Text>
    </Pressable>
  );
}

/** Grupo de opciones excluyentes (tipo de pedido, tipo de cuenta). */
export function Opciones({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{children}</View>;
}

/** Una opción del grupo: pastilla rellena en río si está elegida, en cielo si no. */
export function Opcion({
  titulo,
  elegida,
  onPress,
}: {
  titulo: string;
  elegida: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ selected: elegida }}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.opcion,
        elegida && { backgroundColor: COLOR.primario },
        pressed && PULSADO,
      ]}
    >
      <Text style={[estilos.opcionTexto, elegida && { color: "#fff" }]}>{titulo}</Text>
    </Pressable>
  );
}

export function Campo({
  etiqueta,
  error,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & { etiqueta: string; error?: string | null }) {
  const [enfocado, setEnfocado] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput
        accessibilityLabel={etiqueta}
        placeholderTextColor={COLOR.placeholder}
        {...props}
        onFocus={(e) => {
          setEnfocado(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setEnfocado(false);
          onBlur?.(e);
        }}
        style={[
          estilos.campo,
          enfocado && { borderColor: COLOR.primario },
          error ? { borderColor: COLOR.error } : null,
          props.style,
        ]}
      />
      {error ? <Text style={estilos.error}>{error}</Text> : null}
    </View>
  );
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <View style={estilos.centro} accessibilityLabel={texto}>
      <ActivityIndicator color={COLOR.primario} />
      <Text style={[estilos.texto, { color: COLOR.suave }]}>{texto}</Text>
    </View>
  );
}

export function Vacio({ texto }: { texto: string }) {
  return (
    <View style={estilos.centro}>
      <Text style={[estilos.texto, { color: COLOR.suave, textAlign: "center" }]}>{texto}</Text>
    </View>
  );
}

export function ErrorCaja({
  mensaje,
  onReintentar,
  children,
}: {
  mensaje: string;
  onReintentar?: () => void;
  children?: ReactNode;
}) {
  return (
    <View style={estilos.errorCaja} accessibilityRole="alert">
      <Text style={estilos.errorTexto}>{mensaje}</Text>
      {onReintentar ? <Boton titulo="Reintentar" variante="secundario" onPress={onReintentar} /> : null}
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  titulo: { ...TIPO.titulo, color: COLOR.texto },
  texto: { ...TIPO.cuerpo, ...CIFRAS, color: COLOR.texto },
  pequeno: { ...TIPO.pequeno },
  subtitulo: { ...TIPO.subtitulo, color: COLOR.texto },
  tarjeta: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.borde,
    borderRadius: RADIO.tarjeta,
    padding: 16,
    gap: 8,
    backgroundColor: COLOR.superficie,
  },
  boton: {
    backgroundColor: COLOR.primario,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: RADIO.boton,
    alignItems: "center",
    minHeight: TOQUE_MIN,
    justifyContent: "center",
  },
  botonSecundario: { backgroundColor: COLOR.cielo },
  botonTexto: { color: "#fff", fontWeight: "600", fontSize: 16, textAlign: "center" },
  enlace: { minHeight: TOQUE_MIN, justifyContent: "center", alignItems: "center", paddingHorizontal: 12 },
  enlaceTexto: { color: COLOR.primario, fontSize: 15, fontWeight: "600", textAlign: "center" },
  opcion: {
    backgroundColor: COLOR.cielo,
    borderRadius: RADIO.pastilla,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minHeight: TOQUE_MIN,
    justifyContent: "center",
  },
  opcionTexto: { color: COLOR.primario, fontSize: 15, fontWeight: "600" },
  etiqueta: { ...TIPO.etiqueta, color: COLOR.suave },
  campo: {
    borderWidth: 1,
    borderColor: COLOR.bordeCampo,
    borderRadius: RADIO.campo,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: TOQUE_MIN,
    fontSize: 16,
    color: COLOR.texto,
    backgroundColor: COLOR.superficie,
  },
  error: { color: COLOR.error, fontSize: 14 },
  errorCaja: {
    backgroundColor: COLOR.errorFondo,
    borderRadius: RADIO.boton,
    padding: 14,
    gap: 10,
  },
  errorTexto: { color: COLOR.error, fontSize: 15, fontWeight: "600", lineHeight: 21 },
  centro: { padding: 24, alignItems: "center", gap: 8 },
  insignia: {
    alignSelf: "flex-start",
    borderRadius: RADIO.pastilla,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  insigniaTexto: { fontSize: 12, fontWeight: "700" },
});
