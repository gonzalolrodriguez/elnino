import type { ReactNode } from "react";
import { Text, View } from "react-native";

/**
 * Juego de íconos propio de la app, dibujado con vistas (sin dependencias): trazo redondeado de ~2 px
 * sobre una grilla de 24 unidades que escala con `tam`. Es la contraparte de `Iconos.tsx` de la web.
 * Son decorativos: están ocultos para los lectores de pantalla y el significado siempre va también
 * en el texto (estado, paso, tipo).
 */
export type NombreIcono =
  | "tilde"
  | "reloj"
  | "alerta"
  | "advertencia"
  | "info"
  | "punto"
  | "persona"
  | "personas"
  | "casa"
  | "camion"
  | "campana"
  | "bandeja"
  | "escudo"
  | "mas"
  | "menos"
  | "gota"
  | "flecha"
  | "cruz"
  | "mascota"
  | "tarea";

const ABS = { position: "absolute" } as const;

function Lienzo({ tam, children }: { tam: number; children: ReactNode }) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ width: tam, height: tam }}
      pointerEvents="none"
    >
      {children}
    </View>
  );
}

/** Dibuja el ícono `nombre` en `tam` dp con el color indicado (por defecto, el del texto). */
export function Icono({ nombre, tam = 20, color = "#0E1B2C" }: { nombre: NombreIcono; tam?: number; color?: string }) {
  const u = tam / 24;
  const t = Math.max(1.5, 2 * u);
  const c = (n: number) => n * u;
  const centrado = (ancho: number, alto: number, extra: object = {}) => ({
    ...ABS,
    left: (tam - ancho) / 2,
    top: (tam - alto) / 2,
    width: ancho,
    height: alto,
    ...extra,
  });

  switch (nombre) {
    case "tilde":
      return (
        <Lienzo tam={tam}>
          <View
            style={centrado(c(13), c(7), {
              top: c(6.5),
              borderLeftWidth: t * 1.15,
              borderBottomWidth: t * 1.15,
              borderColor: color,
              transform: [{ rotate: "-45deg" }],
            })}
          />
        </Lienzo>
      );
    case "reloj":
      return (
        <Lienzo tam={tam}>
          <View style={[centrado(c(20), c(20)), { borderWidth: t, borderColor: color, borderRadius: c(10) }]} />
          <View style={{ ...ABS, left: tam / 2 - t / 2, top: c(6.5), width: t, height: c(6), borderRadius: t, backgroundColor: color }} />
          <View style={{ ...ABS, left: tam / 2 - t / 2, top: tam / 2 - t / 2, width: c(5), height: t, borderRadius: t, backgroundColor: color }} />
        </Lienzo>
      );
    case "alerta":
    case "info":
      return (
        <Lienzo tam={tam}>
          <View style={[centrado(c(20), c(20)), { borderWidth: t, borderColor: color, borderRadius: c(10) }]} />
          <Text
            allowFontScaling={false}
            style={{ ...ABS, left: 0, width: tam, top: c(3.2), textAlign: "center", color, fontWeight: "800", fontSize: c(14), lineHeight: c(17), includeFontPadding: false }}
          >
            {nombre === "alerta" ? "!" : "i"}
          </Text>
        </Lienzo>
      );
    case "advertencia":
      return (
        <Lienzo tam={tam}>
          <View
            style={[
              centrado(c(15), c(15)),
              { borderWidth: t, borderColor: color, borderRadius: c(4), transform: [{ rotate: "45deg" }] },
            ]}
          />
          <Text
            allowFontScaling={false}
            style={{ ...ABS, left: 0, width: tam, top: c(4.5), textAlign: "center", color, fontWeight: "800", fontSize: c(13), lineHeight: c(15), includeFontPadding: false }}
          >
            !
          </Text>
        </Lienzo>
      );
    case "punto":
      return (
        <Lienzo tam={tam}>
          <View
            style={[
              centrado(c(15), c(15), { top: c(3.2) }),
              {
                borderWidth: t,
                borderColor: color,
                borderRadius: c(8),
                borderBottomLeftRadius: 0,
                transform: [{ rotate: "-45deg" }],
              },
            ]}
          />
          <View style={{ ...ABS, left: tam / 2 - c(2.5), top: c(7.6), width: c(5), height: c(5), borderRadius: c(3), backgroundColor: color }} />
        </Lienzo>
      );
    case "persona":
      return (
        <Lienzo tam={tam}>
          <View style={{ ...ABS, left: tam / 2 - c(4), top: c(3), width: c(8), height: c(8), borderRadius: c(4), borderWidth: t, borderColor: color }} />
          <View
            style={{
              ...ABS,
              left: tam / 2 - c(7),
              top: c(13.5),
              width: c(14),
              height: c(7),
              borderTopLeftRadius: c(7),
              borderTopRightRadius: c(7),
              borderWidth: t,
              borderBottomWidth: 0,
              borderColor: color,
            }}
          />
        </Lienzo>
      );
    case "personas":
      return (
        <Lienzo tam={tam}>
          <View style={{ ...ABS, left: c(2), top: c(5), width: c(7), height: c(7), borderRadius: c(4), borderWidth: t, borderColor: color }} />
          <View style={{ ...ABS, left: c(0.5), top: c(14), width: c(10), height: c(6), borderTopLeftRadius: c(6), borderTopRightRadius: c(6), borderWidth: t, borderBottomWidth: 0, borderColor: color }} />
          <View style={{ ...ABS, left: c(13), top: c(3), width: c(8), height: c(8), borderRadius: c(4), borderWidth: t, borderColor: color }} />
          <View style={{ ...ABS, left: c(11.5), top: c(13), width: c(11), height: c(7.5), borderTopLeftRadius: c(7), borderTopRightRadius: c(7), borderWidth: t, borderBottomWidth: 0, borderColor: color }} />
        </Lienzo>
      );
    case "casa":
      return (
        <Lienzo tam={tam}>
          <View
            style={{
              ...ABS,
              left: tam / 2 - c(6.5),
              top: c(4),
              width: c(13),
              height: c(13),
              borderTopWidth: t,
              borderLeftWidth: t,
              borderColor: color,
              borderTopLeftRadius: c(2),
              transform: [{ rotate: "45deg" }],
            }}
          />
          <View
            style={{
              ...ABS,
              left: c(5.5),
              top: c(11.5),
              width: c(13),
              height: c(9),
              borderWidth: t,
              borderTopWidth: 0,
              borderBottomLeftRadius: c(2),
              borderBottomRightRadius: c(2),
              borderColor: color,
            }}
          />
        </Lienzo>
      );
    case "camion":
      return (
        <Lienzo tam={tam}>
          <View style={{ ...ABS, left: c(1.5), top: c(5.5), width: c(12), height: c(10), borderWidth: t, borderColor: color, borderRadius: c(2) }} />
          <View style={{ ...ABS, left: c(13.5), top: c(9), width: c(8), height: c(6.5), borderWidth: t, borderLeftWidth: 0, borderColor: color, borderTopRightRadius: c(3), borderBottomRightRadius: c(1) }} />
          <View style={{ ...ABS, left: c(4), top: c(15), width: c(5), height: c(5), borderRadius: c(3), backgroundColor: color }} />
          <View style={{ ...ABS, left: c(14.5), top: c(15), width: c(5), height: c(5), borderRadius: c(3), backgroundColor: color }} />
        </Lienzo>
      );
    case "campana":
      return (
        <Lienzo tam={tam}>
          <View
            style={{
              ...ABS,
              left: tam / 2 - c(6.5),
              top: c(3.5),
              width: c(13),
              height: c(12),
              borderTopLeftRadius: c(6.5),
              borderTopRightRadius: c(6.5),
              borderWidth: t,
              borderBottomWidth: 0,
              borderColor: color,
            }}
          />
          <View style={{ ...ABS, left: c(3.5), top: c(15), width: c(17), height: t, borderRadius: t, backgroundColor: color }} />
          <View style={{ ...ABS, left: tam / 2 - c(2.2), top: c(18), width: c(4.4), height: c(3), borderBottomLeftRadius: c(3), borderBottomRightRadius: c(3), backgroundColor: color }} />
        </Lienzo>
      );
    case "bandeja":
      return (
        <Lienzo tam={tam}>
          <View style={[centrado(c(19), c(13), { top: c(6) }), { borderWidth: t, borderColor: color, borderRadius: c(3) }]} />
          <View style={{ ...ABS, left: c(2.5), top: c(13), width: c(19), height: t, backgroundColor: color }} />
          <View style={{ ...ABS, left: c(9), top: c(11), width: c(6), height: c(4), borderWidth: 0, backgroundColor: color, borderBottomLeftRadius: c(3), borderBottomRightRadius: c(3) }} />
        </Lienzo>
      );
    case "escudo":
      return (
        <Lienzo tam={tam}>
          <View
            style={{
              ...ABS,
              left: tam / 2 - c(7.5),
              top: c(3),
              width: c(15),
              height: c(17),
              borderWidth: t,
              borderColor: color,
              borderTopLeftRadius: c(3),
              borderTopRightRadius: c(3),
              borderBottomLeftRadius: c(8),
              borderBottomRightRadius: c(8),
            }}
          />
          <View
            style={{
              ...ABS,
              left: tam / 2 - c(3.5),
              top: c(8.5),
              width: c(7),
              height: c(4),
              borderLeftWidth: t,
              borderBottomWidth: t,
              borderColor: color,
              transform: [{ rotate: "-45deg" }],
            }}
          />
        </Lienzo>
      );
    case "mas":
    case "menos":
      return (
        <Lienzo tam={tam}>
          <View style={{ ...ABS, left: c(5), top: tam / 2 - t / 2, width: c(14), height: t, borderRadius: t, backgroundColor: color }} />
          {nombre === "mas" ? (
            <View style={{ ...ABS, top: c(5), left: tam / 2 - t / 2, height: c(14), width: t, borderRadius: t, backgroundColor: color }} />
          ) : null}
        </Lienzo>
      );
    case "cruz":
      return (
        <Lienzo tam={tam}>
          <View style={{ ...ABS, left: c(4), top: tam / 2 - t / 2, width: c(16), height: t, borderRadius: t, backgroundColor: color, transform: [{ rotate: "45deg" }] }} />
          <View style={{ ...ABS, left: c(4), top: tam / 2 - t / 2, width: c(16), height: t, borderRadius: t, backgroundColor: color, transform: [{ rotate: "-45deg" }] }} />
        </Lienzo>
      );
    case "gota":
      return (
        <Lienzo tam={tam}>
          <View
            style={[
              centrado(c(14), c(14), { top: c(7) }),
              {
                borderWidth: t,
                borderColor: color,
                borderRadius: c(8),
                borderTopLeftRadius: 0,
                transform: [{ rotate: "45deg" }],
              },
            ]}
          />
        </Lienzo>
      );
    case "flecha":
      return (
        <Lienzo tam={tam}>
          <View
            style={{
              ...ABS,
              left: tam / 2 - c(8),
              top: c(2),
              width: 0,
              height: 0,
              borderLeftWidth: c(8),
              borderRightWidth: c(8),
              borderBottomWidth: c(18),
              borderLeftColor: "transparent",
              borderRightColor: "transparent",
              borderBottomColor: color,
              transform: [{ rotate: "45deg" }],
            }}
          />
        </Lienzo>
      );
    case "mascota":
      return (
        <Lienzo tam={tam}>
          <View style={{ ...ABS, left: c(8), top: c(11), width: c(8), height: c(8), borderRadius: c(4), borderWidth: t, borderColor: color }} />
          {[
            [4, 9],
            [7.5, 4],
            [13.5, 4],
            [17, 9],
          ].map(([x, y], i) => (
            <View key={i} style={{ ...ABS, left: c(x), top: c(y), width: c(3.5), height: c(3.5), borderRadius: c(2), backgroundColor: color }} />
          ))}
        </Lienzo>
      );
    case "tarea":
      return (
        <Lienzo tam={tam}>
          <View style={[centrado(c(15), c(19)), { borderWidth: t, borderColor: color, borderRadius: c(3) }]} />
          <View style={{ ...ABS, left: c(8), top: c(9), width: c(8), height: t, backgroundColor: color, borderRadius: t }} />
          <View style={{ ...ABS, left: c(8), top: c(14), width: c(8), height: t, backgroundColor: color, borderRadius: t }} />
        </Lienzo>
      );
  }
}
