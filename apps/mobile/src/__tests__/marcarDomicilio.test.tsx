import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { FormGrupoFamiliar } from "@/components/FormGrupoFamiliar";

jest.mock("@/lib/dispositivo", () => ({ obtenerUbicacion: jest.fn() }));

const mockGrupo = jest.fn();
const mockGuardar = jest.fn();
jest.mock("@/lib/servicios", () => ({
  api: { grupo: (...a: unknown[]) => mockGrupo(...a), guardarGrupo: (...a: unknown[]) => mockGuardar(...a) },
}));

const webview = require("react-native-webview") as { __ultima: () => { props: Record<string, any> }; __reiniciar: () => void };
const metricas = { frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

const grupo = { integrantes: 3, menores: 1, mayores: 0, mascotas: 0, telefono: null, lon: null, lat: null, sector_id: null };

describe("Marcar el domicilio en el mapa", () => {
  beforeEach(() => {
    webview.__reiniciar();
    mockGrupo.mockResolvedValue(grupo);
    mockGuardar.mockImplementation(async (c: Record<string, unknown>) => ({ ...grupo, ...c, sector_id: "S4" }));
  });

  it("un toque en el mapa completa el domicilio y se guarda con esas coordenadas", async () => {
    await render(
      <SafeAreaProvider initialMetrics={metricas}>
        <FormGrupoFamiliar />
      </SafeAreaProvider>,
    );
    await waitFor(() => expect(screen.getByText("Marcar mi domicilio en el mapa")).toBeTruthy());
    expect(screen.getByText(/Domicilio: sin cargar/)).toBeTruthy();

    await fireEvent.press(screen.getByText("Marcar mi domicilio en el mapa"));
    await act(() => webview.__ultima().props.onMessage({ nativeEvent: { data: JSON.stringify({ t: "punto", lon: -58.139, lat: -26.18, origen: "clic" }) } }));

    expect(screen.getByText(/Domicilio: -26\.18000, -58\.13900/)).toBeTruthy();
    expect(screen.getByText("Marcaste un punto dentro del Sector S4 · Rural Este (SIMULADO).")).toBeTruthy();

    await fireEvent.press(screen.getByText("Guardar"));
    await waitFor(() => expect(mockGuardar).toHaveBeenCalled());
    expect(mockGuardar.mock.calls[0][0]).toMatchObject({ lon: -58.139, lat: -26.18 });
  });
});
