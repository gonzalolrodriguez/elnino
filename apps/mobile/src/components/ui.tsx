import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import type { Categoria } from "@/lib/servicios";

export const COLOR = {
  primario: "#7c2d12",
  texto: "#18181b",
  suave: "#52525b",
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
      <Text style={[estilos.insigniaTexto, { color: COLOR_CATEGORIA[categoria] }]}>{categoria}</Text>
    </View>
  );
}

export function Pantalla({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  if (!scroll) return <View style={estilos.pantalla}>{children}</View>;
  return (
    <ScrollView contentContainerStyle={estilos.pantalla} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Titulo({ children }: { children: ReactNode }) {
  return (
    <Text style={estilos.titulo} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Texto({ children, suave }: { children: ReactNode; suave?: boolean }) {
  return <Text style={[estilos.texto, suave && { color: COLOR.suave }]}>{children}</Text>;
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
      style={[
        estilos.boton,
        variante === "secundario" && estilos.botonSecundario,
        variante === "peligro" && { backgroundColor: COLOR.error },
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
        placeholderTextColor="#a1a1aa"
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
  pantalla: { padding: 16, gap: 14 },
  titulo: { fontSize: 20, fontWeight: "700", color: COLOR.texto },
  texto: { fontSize: 15, color: COLOR.texto },
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
    minHeight: 44,
    justifyContent: "center",
  },
  botonSecundario: { backgroundColor: "#fff", borderWidth: 1, borderColor: COLOR.primario },
  botonTexto: { color: "#fff", fontWeight: "700", fontSize: 15 },
  etiqueta: { fontSize: 13, fontWeight: "600", color: COLOR.suave },
  campo: {
    borderWidth: 1,
    borderColor: COLOR.borde,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: COLOR.texto,
    backgroundColor: "#fff",
  },
  error: { color: COLOR.error, fontSize: 13 },
  centro: { padding: 24, alignItems: "center", gap: 8 },
  insignia: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  insigniaTexto: { fontSize: 10, fontWeight: "700" },
});
