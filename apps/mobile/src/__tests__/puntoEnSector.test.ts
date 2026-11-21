import { SECTORES_K10, sectorDe, textoPuntoEnSector } from "@/lib/puntoEnSector";

describe("puntoEnSector", () => {
  it("carga los cuatro sectores K10 con su anillo cerrado", () => {
    expect(SECTORES_K10.map((s) => s.id)).toEqual(["S1", "S2", "S3", "S4"]);
    for (const s of SECTORES_K10) expect(s.anillo[0]).toEqual(s.anillo[s.anillo.length - 1]);
  });

  it("ubica un punto dentro de cada sector (centro de su caja)", () => {
    const centro = (id: string) => {
      const a = SECTORES_K10.find((s) => s.id === id)!.anillo;
      const lons = a.map((p) => p[0]);
      const lats = a.map((p) => p[1]);
      return [(Math.min(...lons) + Math.max(...lons)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2] as const;
    };
    for (const id of ["S1", "S2", "S3", "S4"]) {
      const [lon, lat] = centro(id);
      expect(sectorDe(lon, lat)?.id).toBe(id);
    }
  });

  it("devuelve null fuera de los sectores", () => {
    expect(sectorDe(-58.0, -26.0)).toBeNull();
    expect(sectorDe(-58.1, -26.5)).toBeNull();
  });

  it("el texto en vivo nombra el sector con su categoría", () => {
    expect(textoPuntoEnSector(-58.139, -26.18)).toBe("Marcaste un punto dentro del Sector S4 · Rural Este (SIMULADO).");
    expect(textoPuntoEnSector(-58.0, -26.0)).toBe("Marcaste un punto fuera de los sectores simulados.");
    expect(textoPuntoEnSector(null, null)).toBe("Todavía no marcaste ningún punto.");
    expect(textoPuntoEnSector(Number.NaN, -26)).toBe("Todavía no marcaste ningún punto.");
  });
});
