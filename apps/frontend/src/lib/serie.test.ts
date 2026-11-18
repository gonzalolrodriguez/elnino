import { describe, expect, it } from "vitest";

import { serieDesdeApi } from "./serie";

describe("serieDesdeApi", () => {
  it("rellena con null los días sin dato (no interpola)", () => {
    const s = serieDesdeApi({
      puntos: [
        { fecha: "2018-01-01", altura_max_m: 1.5 },
        { fecha: "2018-01-04", altura_max_m: 2.0 },
      ],
    });
    expect(s).toEqual({ desde: "2018-01-01", hasta: "2018-01-04", valores: [1.5, null, null, 2.0] });
  });

  it("rechaza respuestas vacías o con forma inesperada", () => {
    expect(serieDesdeApi(null)).toBeNull();
    expect(serieDesdeApi({ puntos: [] })).toBeNull();
    expect(serieDesdeApi({ puntos: [{ fecha: "x", altura_max_m: "1" }] })).toBeNull();
  });
});
