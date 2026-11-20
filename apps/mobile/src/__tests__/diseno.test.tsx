import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Icono, type NombreIcono } from "@/components/Icono";
import { Banda, Chip, Cifra, Contador, Paso } from "@/components/Piezas";
import { gravedadAviso } from "@/lib/etiquetas";

const metricas = { frame: { x: 0, y: 0, width: 320, height: 568 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const conSafe = (h: React.JSX.Element) => <SafeAreaProvider initialMetrics={metricas}>{h}</SafeAreaProvider>;

const NOMBRES: NombreIcono[] = [
  "tilde", "reloj", "alerta", "advertencia", "info", "punto", "persona", "personas", "casa", "camion",
  "campana", "bandeja", "escudo", "mas", "menos", "gota", "flecha", "cruz", "mascota", "tarea",
];

describe("íconos propios", () => {
  it("dibujan todos los nombres sin romper y quedan ocultos para el lector de pantalla", async () => {
    await render(
      <>
        {NOMBRES.map((n) => (
          <Icono key={n} nombre={n} tam={24} />
        ))}
      </>,
    );
    // Decorativos: no exponen nada accesible por su cuenta.
    expect(screen.queryAllByRole("image")).toHaveLength(0);
  });
});

describe("contador −/+", () => {
  it("sube y baja con los botones y respeta mínimo y máximo", async () => {
    const alCambiar = jest.fn();
    await render(conSafe(<Contador etiqueta="Menores" icono="persona" valor={0} max={2} alCambiar={alCambiar} />));
    // En el mínimo no se puede bajar.
    expect(screen.getByLabelText("Menos menores").props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByLabelText("Más menores"));
    expect(alCambiar).toHaveBeenCalledWith(1);
  });

  it("se anuncia como control ajustable con su valor", async () => {
    await render(conSafe(<Contador etiqueta="Integrantes" icono="personas" valor={3} min={1} alCambiar={jest.fn()} />));
    const c = screen.getByLabelText("Integrantes");
    expect(c.props.accessibilityRole).toBe("adjustable");
    expect(c.props.accessibilityValue).toMatchObject({ min: 1, now: 3 });
  });
});

describe("línea de tiempo y cifras", () => {
  it("cada paso dice con texto si está listo, es el actual o falta", async () => {
    await render(
      conSafe(
        <>
          <Paso estado="hecho" icono="bandeja" etiqueta="Recibido" hora="14:05" siguienteHecho />
          <Paso estado="actual" icono="camion" etiqueta="En camino" />
          <Paso estado="pendiente" icono="tilde" etiqueta="Asistido" ultimo />
        </>,
      ),
    );
    expect(screen.getByLabelText("Recibido: listo, 14:05")).toBeTruthy();
    expect(screen.getByLabelText("En camino: paso actual")).toBeTruthy();
    expect(screen.getByLabelText("Asistido: pendiente")).toBeTruthy();
  });

  it("la cifra lleva su categoría y una lectura completa", async () => {
    await render(conSafe(<Cifra rotulo="Río en Puerto Formosa" valor="5,60" unidad="m" categoria="DATO OBSERVADO" />));
    expect(screen.getByLabelText("Río en Puerto Formosa: 5,60 m")).toBeTruthy();
    expect(screen.getByText("DATO OBSERVADO")).toBeTruthy();
  });

  it("la banda de estado muestra título, frase y categoría", async () => {
    await render(
      conSafe(
        <Banda tono="error" icono="alerta" titulo="S4 · Sector Rural Este: Comprometido" frase="Tu sector está comprometido." categoria="SIMULADO">
          <Chip tono="error" icono="alerta" texto="Aislado" />
        </Banda>,
      ),
    );
    expect(screen.getByText("S4 · Sector Rural Este: Comprometido")).toBeTruthy();
    expect(screen.getByText("Tu sector está comprometido.")).toBeTruthy();
    expect(screen.getByText("SIMULADO")).toBeTruthy();
    expect(screen.getByText("Aislado")).toBeTruthy();
  });
});

describe("gravedad de los avisos", () => {
  it("lee el rótulo con el que el backend arma el mensaje de la orden", () => {
    expect(gravedadAviso("Evacuación preventiva para S4 (Sector Rural Este). Fundamento: …").nivel).toBe("preventiva");
    expect(gravedadAviso("Evacuación para S2. Fundamento: …").nivel).toBe("evacuacion");
    expect(gravedadAviso("Alerta para S1. Fundamento: …").nivel).toBe("alerta");
    expect(gravedadAviso("Otra cosa").nivel).toBe("aviso");
    expect(gravedadAviso("x", "discrepancia").nivel).toBe("discrepancia");
  });
});
