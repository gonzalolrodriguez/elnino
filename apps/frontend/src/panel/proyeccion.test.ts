import { describe, expect, it } from "vitest";

import {
  horasAislamiento,
  horasCorteAcceso,
  horasHastaAltura,
  horasHastaLluvia,
  mensajeExpuesto,
  proyectarSector,
  sectorMasExpuesto,
  textoHoras,
  textoRangoHoras,
  type AccesoProy,
  type SectorProy,
} from "./proyeccion";

// Sectores y accesos de K10 / data/simulado/accesos.geojson.
const SECTORES: SectorProy[] = [
  { id: "S1", nombre: "Sector Norte", compromiso_m: 8.1 },
  { id: "S2", nombre: "Sector Centro", compromiso_m: 8.6 },
  { id: "S3", nombre: "Sector Sur", compromiso_m: 7.9 },
  { id: "S4", nombre: "Sector Rural Este", compromiso_m: 7.5 },
];
const ACCESOS: AccesoProy[] = [
  { id: 1, sector_id: "S1", superficie: "ripio", cerrado: false },
  { id: 2, sector_id: "S2", superficie: "pavimento", cerrado: false },
  { id: 3, sector_id: "S2", superficie: "pavimento", cerrado: false },
  { id: 4, sector_id: "S3", superficie: "pavimento", cerrado: false },
  { id: 5, sector_id: "S3", superficie: "ripio", cerrado: false },
  { id: 6, sector_id: "S4", superficie: "tierra", cerrado: false },
];
const todos = (altura: number, lluvia: number, ritmo = 5, accesos = ACCESOS) => SECTORES.map((s) => proyectarSector(s, accesos, altura, lluvia, ritmo));

describe("reloj del río", () => {
  it("del corte (5,60 m) a la alerta (7,80 m): igual que el rango de 6,1 a 20,4 días del backend, en horas", () => {
    const r = horasHastaAltura(5.6, 7.8);
    expect(r.minimo).toBeCloseTo(2.2 / 0.36 * 24, 0); // ~146,7 h
    expect(r.maximo).toBeCloseTo(2.2 / 0.1077 * 24, 0); // ~490 h
    expect(r.minimo / 24).toBeCloseTo(6.1, 1);
    expect(r.maximo / 24).toBeCloseTo(20.4, 1);
  });

  it("ya alcanzado: cero, aun con errores de punto flotante (8,10 - 0,50)", () => {
    expect(horasHastaAltura(7.8, 7.8)).toEqual({ minimo: 0, maximo: 0 });
    expect(horasHastaAltura(8.1 - 0.5, 7.6)).toEqual({ minimo: 0, maximo: 0 });
  });
});

describe("reloj del barro", () => {
  it("horas hasta el umbral de tierra al ritmo supuesto", () => {
    expect(horasHastaLluvia(0, 30, 5)).toBe(6);
    expect(horasHastaLluvia(20, 30, 5)).toBe(2);
    expect(horasHastaLluvia(40, 30, 5)).toBe(0);
  });

  it("sin lluvia (ritmo 0) no se corta; lluvia negativa o inválida cuenta como 0", () => {
    expect(horasHastaLluvia(0, 30, 0)).toBe(Infinity);
    expect(horasHastaLluvia(-10, 30, 5)).toBe(6);
    expect(horasHastaLluvia(Number.NaN, 30, 5)).toBe(6);
  });
});

describe("accesos y aislamiento", () => {
  it("tierra: el menor entre barro y anegamiento del sector; ripio solo barro; pavimento nunca; cerrado ya", () => {
    const tierra = horasCorteAcceso(ACCESOS[5], 7.5, 7.4, 0, 5);
    // A 7,40 m el río anegaría el camino en ~6,7 h, pero el barro lo corta antes (30 mm a 5 mm/h = 6 h).
    expect(tierra).toEqual({ minimo: 6, maximo: 6 });
    expect(horasCorteAcceso(ACCESOS[0], 8.1, 5.6, 0, 5)).toEqual({ minimo: 16, maximo: 16 });
    expect(horasCorteAcceso(ACCESOS[1], 8.6, 5.6, 0, 5)).toEqual({ minimo: Infinity, maximo: Infinity });
    expect(horasCorteAcceso({ ...ACCESOS[1], cerrado: true }, 8.6, 5.6, 0, 5)).toEqual({ minimo: 0, maximo: 0 });
  });

  it("el sector queda aislado cuando se corta el último acceso; sin accesos, null", () => {
    expect(horasAislamiento([], 7.5, 5.6, 0)).toBeNull();
    // S3: un pavimentado nunca se corta por lluvia, así que no queda aislado.
    expect(horasAislamiento(ACCESOS.filter((a) => a.sector_id === "S3"), 7.9, 5.6, 0)).toEqual({ minimo: Infinity, maximo: Infinity });
  });
});

describe("escenario de la demo (CLAUDE.md §8.1)", () => {
  it("7,60 m + 40 mm: S4 ya está aislado y comprometido; es el más expuesto", () => {
    const p = todos(7.6, 40);
    const s4 = p.find((x) => x.id === "S4")!;
    expect(s4.compromiso).toEqual({ minimo: 0, maximo: 0 });
    expect(s4.aislamiento).toEqual({ minimo: 0, maximo: 0 });
    expect(s4.evento).toBe("aislado");
    const e = sectorMasExpuesto(p)!;
    expect(e.id).toBe("S4");
    expect(mensajeExpuesto(e)).toBe("S4 ya está aislado");
  });

  it("al bajar la lluvia a 0 el reloj del barro se relaja: S1 (ripio) pasa de cortado a 16 h", () => {
    const con = todos(7.6, 80).find((x) => x.id === "S1")!;
    const sin = todos(7.6, 0).find((x) => x.id === "S1")!;
    expect(con.aislamiento).toEqual({ minimo: 0, maximo: 0 });
    expect(sin.aislamiento).toEqual({ minimo: 16, maximo: 16 });
  });

  it("al corte sin lluvia: S4 queda aislado en ~6 h por el barro (antes que el río)", () => {
    const e = sectorMasExpuesto(todos(5.6, 0))!;
    expect(e.id).toBe("S4");
    expect(e.evento).toBe("aislado");
    expect(mensajeExpuesto(e)).toBe("S4 queda aislado en ~6 h");
  });

  it("sin lluvia ni sectores con tierra: el primero en comprometerse es S4 por el río, con rango", () => {
    const soloPavimento = ACCESOS.map((a) => ({ ...a, superficie: "pavimento" }));
    const e = sectorMasExpuesto(todos(5.6, 0, 0, soloPavimento))!;
    expect(e.id).toBe("S4");
    expect(e.evento).toBe("comprometido");
    expect(mensajeExpuesto(e)).toMatch(/^S4 queda comprometido entre 5,3 días y 17,6 días$/);
  });
});

describe("textos", () => {
  it("formatea horas, días y horizonte", () => {
    expect(textoHoras(0.4)).toBe("<1 h");
    expect(textoHoras(14.2)).toBe("14 h");
    expect(textoHoras(146.7)).toBe("6,1 días");
    expect(textoHoras(Infinity)).toBe("más de 60 días");
    expect(textoRangoHoras({ minimo: 0, maximo: 0 })).toBe("ya");
    expect(textoRangoHoras({ minimo: 6, maximo: 6 })).toBe("~6 h");
    expect(textoRangoHoras({ minimo: 2000, maximo: 3000 })).toBe("más de 60 días");
  });
});
