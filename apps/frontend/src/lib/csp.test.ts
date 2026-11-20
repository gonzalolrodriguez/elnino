import { ORIGEN_TESELAS_OSM, origenesApi, politicaCsp } from "./csp";

const directiva = (csp: string, nombre: string) =>
  csp
    .split("; ")
    .find((d) => d.startsWith(`${nombre} `))
    ?.split(" ")
    .slice(1) ?? [];

describe("Content-Security-Policy del portal", () => {
  it("deriva el origen HTTP y WebSocket del backend", () => {
    expect(origenesApi("http://192.168.0.10:8000")).toEqual(["http://192.168.0.10:8000", "ws://192.168.0.10:8000"]);
    expect(origenesApi("https://api.ejemplo.invalid/")).toEqual(["https://api.ejemplo.invalid", "wss://api.ejemplo.invalid"]);
  });

  it("permite solo lo que usa la app", () => {
    const csp = politicaCsp("http://localhost:8000", ["abc="]);
    expect(directiva(csp, "default-src")).toEqual(["'self'"]);
    expect(directiva(csp, "script-src")).toEqual(["'self'", "'sha256-abc='"]); // sin 'unsafe-inline' ni 'unsafe-eval'
    expect(directiva(csp, "connect-src")).toEqual(expect.arrayContaining(["'self'", "http://localhost:8000", "ws://localhost:8000", ORIGEN_TESELAS_OSM]));
    expect(directiva(csp, "img-src")).toEqual(expect.arrayContaining([ORIGEN_TESELAS_OSM, "data:", "blob:"]));
    expect(directiva(csp, "worker-src")).toContain("blob:"); // workers de MapLibre
    expect(directiva(csp, "object-src")).toEqual(["'none'"]);
    expect(csp).not.toMatch(/unsafe-eval|\*/);
  });
});
