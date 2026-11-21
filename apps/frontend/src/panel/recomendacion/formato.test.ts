import { describe, expect, it } from "vitest";

import { lineasDeValor, mejoresDeFila } from "./formato";

describe("mejoresDeFila", () => {
  it("destaca el menor en métricas donde menos es mejor y el mayor donde más es mejor", () => {
    expect([...mejoresDeFila("personas_sin_lugar", [50, 10, 30])]).toEqual([1]);
    expect([...mejoresDeFila("personas_evacuadas", [100, 90, 100])]).toEqual([0, 2]);
  });
  it("no destaca empates totales, valores sin orden ni diccionarios", () => {
    expect(mejoresDeFila("tiempo_total_min", [60, 60]).size).toBe(0);
    expect(mejoresDeFila("viajes_por_vehiculo", [{ a: 1 }, { a: 2 }]).size).toBe(0);
    expect(mejoresDeFila("personas_sin_lugar", [null, 5]).size).toBe(0);
  });
});

describe("lineasDeValor", () => {
  it("separa un diccionario en una línea por clave y omite ceros y listas vacías", () => {
    expect(lineasDeValor({ colectivo: 50, "4x4": 12, lancha: 0 })).toEqual(["colectivo: 50", "4x4: 12"]);
    expect(lineasDeValor({})).toEqual(["ninguno"]);
    expect(lineasDeValor(7)).toEqual(["7"]);
  });
});
