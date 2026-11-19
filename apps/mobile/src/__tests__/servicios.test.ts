import { Image } from "react-native";

import { ErrorApi } from "@/lib/api";
import { subirFotoSolicitud } from "@/lib/servicios";

const original = Image.getSize;
let getSize: jest.Mock;

describe("subirFotoSolicitud", () => {
  beforeEach(() => {
    getSize = jest.fn();
    (Image as unknown as { getSize: unknown }).getSize = getSize;
  });
  afterEach(() => {
    (Image as unknown as { getSize: unknown }).getSize = original;
  });

  it("si el envío falla por red y el archivo ya no existe, es un rechazo (no se reintenta eternamente)", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError("Network request failed")) as unknown as typeof fetch;
    getSize.mockImplementation((_u: string, _ok: unknown, error: () => void) => error());
    const r = await subirFotoSolicitud(5, "file:///perdida.jpg");
    expect(r).toMatchObject({ ok: false, tipo: "rechazo" });
  });

  it("si el archivo existe y falla la red, sigue siendo un fallo reintentable", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError("Network request failed")) as unknown as typeof fetch;
    getSize.mockImplementation((_u: string, ok: () => void) => ok());
    const r = await subirFotoSolicitud(5, "file:///ok.jpg");
    expect(r).toMatchObject({ ok: false, tipo: "red" });
    expect(new ErrorApi(0, "x", "x").esRed).toBe(true);
  });
});
