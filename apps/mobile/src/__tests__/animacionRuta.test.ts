import { acumuladas, dividir, estimarDistancia, haversine, largoTotal, minutosRestantes, proyectar, puntoEn, rumbo, rumboEn, suavizar, type Par } from "@/lib/animacionRuta";

// Un grado de latitud ≈ 111,19 km.
const GRADO_M = 111_195;
// Hacia el norte 0,01° y luego hacia el este 0,01° (en lat -26 el este mide cos(26°) ≈ 0,899 de eso).
const RUTA: Par[] = [
  [-58.2, -26.2],
  [-58.2, -26.19],
  [-58.19, -26.19],
];
const ACUM = acumuladas(RUTA);

describe("animacionRuta · geometría", () => {
  it("haversine: un grado de latitud mide ~111 km y el mismo punto, 0", () => {
    expect(haversine([-58, -26], [-58, -25])).toBeGreaterThan(GRADO_M - 200);
    expect(haversine([-58, -26], [-58, -25])).toBeLessThan(GRADO_M + 200);
    expect(haversine([-58, -26], [-58, -26])).toBe(0);
  });

  it("distancias acumuladas: parten de 0 y crecen hasta el largo total", () => {
    expect(ACUM[0]).toBe(0);
    expect(ACUM[1]).toBeCloseTo(GRADO_M * 0.01, -1);
    expect(ACUM[2] - ACUM[1]).toBeCloseTo(GRADO_M * 0.01 * Math.cos((26.19 * Math.PI) / 180), -1);
    expect(largoTotal(ACUM)).toBe(ACUM[2]);
    expect(largoTotal([])).toBe(0);
  });

  it("punto a una distancia: vértices, mitad de un tramo y acotado a los extremos", () => {
    expect(puntoEn(RUTA, ACUM, 0)).toEqual(RUTA[0]);
    expect(puntoEn(RUTA, ACUM, ACUM[1])[1]).toBeCloseTo(-26.19, 6);
    const medio = puntoEn(RUTA, ACUM, ACUM[1] / 2);
    expect(medio[0]).toBeCloseTo(-58.2, 6);
    expect(medio[1]).toBeCloseTo(-26.195, 5);
    expect(puntoEn(RUTA, ACUM, -50)).toEqual(RUTA[0]);
    expect(puntoEn(RUTA, ACUM, 1e9)).toEqual(RUTA[2]);
  });

  it("rumbo: norte en el primer tramo, este en el segundo", () => {
    expect(rumbo([-58, -26], [-58, -25])).toBeCloseTo(0, 5);
    expect(rumbo([-58, -26], [-57, -26])).toBeCloseTo(90, 0);
    expect(rumboEn(RUTA, ACUM, ACUM[1] / 2)).toBeCloseTo(0, 3);
    expect(rumboEn(RUTA, ACUM, ACUM[1] + 10)).toBeGreaterThan(85);
    expect(rumboEn(RUTA, ACUM, ACUM[1] + 10)).toBeLessThan(95);
  });

  it("dividir: lo recorrido y lo que falta comparten el punto de corte y no pierden vértices", () => {
    const d = ACUM[1] + 40;
    const { recorrida, restante } = dividir(RUTA, ACUM, d);
    const corte = puntoEn(RUTA, ACUM, d);
    expect(recorrida).toEqual([RUTA[0], RUTA[1], corte]);
    expect(restante).toEqual([corte, RUTA[2]]);
    expect(largoTotal(acumuladas(recorrida)) + largoTotal(acumuladas(restante))).toBeCloseTo(largoTotal(ACUM), 3);
    expect(dividir(RUTA, ACUM, 0).recorrida.length).toBe(2);
    const fin = dividir(RUTA, ACUM, 1e9).restante;
    expect(fin[fin.length - 1]).toEqual(RUTA[2]);
  });

  it("proyectar: un punto al costado cae sobre la distancia correcta y mide el desvío", () => {
    const p = puntoEn(RUTA, ACUM, ACUM[1] / 2);
    const exacto = proyectar(RUTA, ACUM, p);
    expect(exacto.distancia).toBeCloseTo(ACUM[1] / 2, 0);
    expect(exacto.desvio).toBeLessThan(0.5);
    const lado = proyectar(RUTA, ACUM, [p[0] - 0.001, p[1]]);
    expect(lado.distancia).toBeCloseTo(ACUM[1] / 2, 0);
    expect(lado.desvio).toBeGreaterThan(90);
    expect(proyectar(RUTA, ACUM, [-60, -30]).distancia).toBe(0);
  });
});

describe("animacionRuta · estima y suavizado", () => {
  it("navegación a estima: avanza velocidad × tiempo y se acota al final", () => {
    // 36 km/h = 10 m/s.
    expect(estimarDistancia({ base: 100, velocidadKmh: 36, transcurridoMs: 5000, largo: 1000 })).toBeCloseTo(150, 6);
    expect(estimarDistancia({ base: 900, velocidadKmh: 36, transcurridoMs: 60_000, largo: 1000 })).toBe(1000);
  });

  it("con horizonte, no extrapola más allá; sin velocidad válida o con tiempo negativo no se mueve", () => {
    expect(estimarDistancia({ base: 0, velocidadKmh: 36, transcurridoMs: 600_000, largo: 1e6, maxSegundos: 90 })).toBeCloseTo(900, 6);
    expect(estimarDistancia({ base: 50, velocidadKmh: 0, transcurridoMs: 5000, largo: 1000 })).toBe(50);
    expect(estimarDistancia({ base: 50, velocidadKmh: Number.NaN, transcurridoMs: 5000, largo: 1000 })).toBe(50);
    expect(estimarDistancia({ base: 50, velocidadKmh: 36, transcurridoMs: -5000, largo: 1000 })).toBe(50);
  });

  it("suavizar: se acerca al objetivo sin pasarse, no retrocede por poco y salta si el objetivo quedó muy atrás", () => {
    const a = suavizar(0, 100, 100);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(100);
    expect(suavizar(0, 100, 100_000)).toBe(100);
    expect(suavizar(100, 90, 16)).toBe(100);
    expect(suavizar(500, 100, 16)).toBeLessThan(500);
    expect(suavizar(10, 100, 0)).toBe(10);
  });

  it("minutos restantes: redondeo hacia arriba y nulo sin velocidad", () => {
    expect(minutosRestantes(1000, 60)).toBe(1);
    expect(minutosRestantes(1001, 60)).toBe(2);
    expect(minutosRestantes(0, 60)).toBe(0);
    expect(minutosRestantes(1000, 0)).toBeNull();
    expect(minutosRestantes(Number.NaN, 30)).toBeNull();
  });
});
