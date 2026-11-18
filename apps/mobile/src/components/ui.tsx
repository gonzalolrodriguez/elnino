import { Children, createContext, useContext, type ReactNode } from "react";
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

import { ANCHO_MAX, TOQUE_MIN, useDiseno } from "@/lib/responsive";
import type { Categoria } from "@/lib/servicios";

/**
 * `true` dentro de la barra de pestañas: ella ya reserva la zona segura inferior (gestos / botones
 * del sistema), así que las pantallas no deben sumarla otra vez.
 */
export const EnPestanasContext = createContext(false);

export const COLOR = {
  primario: "#7c2d12",
  texto: "#18181b",
  suave: "#52525b",
  placeholder: "#71717a",
  borde: "#d4d4d8",
  fondo: "#ffffff",
  error: "#b91c1c",
  ok: "#15803d",
  aviso: "#a16207",
};

const COLOR_CATEGORIA: Record<Categoria, string> = {
  "DATO OBSERVADO": "#1d4ed8",
  "DOCUMENTO DE REFERENCIA": "#0f766e",
  SIMULADO: "#a16207",
};

/** Categoría visible en cada cifra o capa (regla 2 de la mesa). */
export function Insignia({ categoria }: { categoria: Categoria }) {
  return (
    <View style={[estilos.insignia, { borderColor: COLOR_CATEGORIA[categoria] }]}>
      <Text
        maxFontSizeMultiplier={1.5}
        style={[estilos.insigniaTexto, { color: COLOR_CATEGORIA[categoria] }]}
      >
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

export function Tarjeta({ children }: { children: ReactNode }) {
  return <View style={estilos.tarjeta}>{children}</View>;
}

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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: !!apagado }}
      disabled={apagado}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.boton,
        variante === "secundario" && estilos.botonSecundario,
        variante === "peligro" && { backgroundColor: COLOR.error },
        pressed && !apagado && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        apagado && { opacity: 0.5 },
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={variante === "secundario" ? COLOR.primario : "#fff"} />
      ) : (
        <Text style={[estilos.botonTexto, variante === "secundario" && { color: COLOR.primario }]}>
          {titulo}
        </Text>
      )}
    </Pressable>
  );
}

export function Campo({
  etiqueta,
  error,
  ...props
}: TextInputProps & { etiqueta: string; error?: string | null }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput
        accessibilityLabel={etiqueta}
        placeholderTextColor={COLOR.placeholder}
        {...props}
        style={[estilos.campo, error ? { borderColor: COLOR.error } : null, props.style]}
      />
      {error ? <Text style={estilos.error}>{error}</Text> : null}
    </View>
  );
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <View style={estilos.centro} accessibilityLabel={texto}>
      <ActivityIndicator />
      <Text style={estilos.texto}>{texto}</Text>
    </View>
  );
}

export function Vacio({ texto }: { texto: string }) {
  return (
    <View style={estilos.centro}>
      <Text style={[estilos.texto, { color: COLOR.suave }]}>{texto}</Text>
    </View>
  );
}

export function ErrorCaja({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) {
  return (
    <View style={[estilos.centro, { gap: 12 }]} accessibilityRole="alert">
      <Text style={estilos.error}>{mensaje}</Text>
      {onReintentar ? <Boton titulo="Reintentar" variante="secundario" onPress={onReintentar} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
    titulo: { fontSize: 22, fontWeight: "700", color: COLOR.texto },
  texto: { fontSize: 16, color: COLOR.texto },
  pequeno: { fontSize: 13 },
  subtitulo: { fontSize: 16, fontWeight: "700", color: COLOR.texto },
  tarjeta: {
    borderWidth: 1,
    borderColor: COLOR.borde,
    borderRadius: 8,
    padding: 12,
    gap: 6,
    backgroundColor: COLOR.fondo,
  },
  boton: {
    backgroundColor: COLOR.primario,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    minHeight: TOQUE_MIN,
    justifyContent: "center",
  },
  botonSecundario: { backgroundColor: "#fff", borderWidth: 1, borderColor: COLOR.primario },
  botonTexto: { color: "#fff", fontWeight: "700", fontSize: 16, textAlign: "center" },
  etiqueta: { fontSize: 14, fontWeight: "600", color: COLOR.suave },
  campo: {
    borderWidth: 1,
    borderColor: COLOR.borde,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: TOQUE_MIN,
    fontSize: 16,
    color: COLOR.texto,
    backgroundColor: "#fff",
  },
  error: { color: COLOR.error, fontSize: 14 },
  centro: { padding: 24, alignItems: "center", gap: 8 },
  insignia: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  insigniaTexto: { fontSize: 11, fontWeight: "700" },
});
