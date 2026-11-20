import { rutaInterna } from "./rutaInterna";

describe("rutaInterna (destino tras el login)", () => {
  it.each(["/comando", "/mi-cuenta", "/comando/ordenes?x=1"])("acepta la ruta interna %s", (r) => {
    expect(rutaInterna(r)).toBe(r);
  });

  it.each(["//evil.example", "/\\evil.example", "/comando\\..\\evil", "https://evil.example", "evil", "", null, 42, undefined])("descarta %p", (r) => {
    expect(rutaInterna(r)).toBeUndefined();
  });
});
