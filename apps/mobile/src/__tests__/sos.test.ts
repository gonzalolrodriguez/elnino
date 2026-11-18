import { codificarSOS, enlaceSMS, ErrorSOS } from "@/lib/sos";

/** Réplica mínima del parser del backend (parser_mensajes.py::parsear_sos) para validar el formato. */
function parsearComoBackend(mensaje: string) {
  const partes = mensaje.trim().split("|").map((p) => p.trim());
  if (partes.length < 3 || partes[0].toUpperCase() !== "SOS-FSA") throw new Error("formato");
  const [latTxt, lonTxt, sobra] = partes[1].split(",");
  if (sobra !== undefined) throw new Error("coordenadas");
  const lat = Number(latTxt);
  const lon = Number(lonTxt);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("coordenadas");
  const perfiles: Record<string, string> = { CIUDADANO: "ciudadano", PRODUCTOR: "productor" };
  const perfil = perfiles[partes[2].toUpperCase()];
  if (!perfil) throw new Error("perfil");
  let familiares = 0;
  let bovinos = 0;
  let detalle: string | null = null;
  let acceso: string | null = null;
  const libres: string[] = [];
  for (const t of partes.slice(3)) {
    if (!t) continue;
    let m: RegExpMatchArray | null;
    if ((m = t.match(/^FAM:(\d{1,3})$/i))) familiares = Number(m[1]);
    else if (t.toUpperCase().startsWith("BOV:")) {
      m = t.match(/^BOV:(\d{1,5})(?:\(([^()]{0,80})\))?$/i);
      if (!m) throw new Error("BOV");
      bovinos = Number(m[1]);
      detalle = m[2] ?? null;
    } else if (t.toUpperCase().startsWith("FAM:")) throw new Error("FAM");
    else if (t.toUpperCase().startsWith("ACC:")) acceso = t.slice(4).trim().slice(0, 60) || null;
    else libres.push(t);
  }
  const texto = libres.join(" ").replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, 500) || null;
  if (familiares === 0 && bovinos === 0 && texto === null) throw new Error("vacío");
  return { lat, lon, perfil, familiares, bovinos, detalle, acceso, texto };
}

describe("codificarSOS", () => {
  it("reproduce el ejemplo documentado del backend (productor con ganado)", () => {
    const msg = codificarSOS({
      lat: -26.18,
      lon: -58.139,
      perfil: "productor",
      familiares: 4,
      bovinos: 30,
      detalleBovinos: "8P,10C,10T,1V,1TO",
      acceso: "TIERRA",
      texto: "Necesito camión",
    });
    expect(msg).toBe("SOS-FSA|-26.18,-58.139|PRODUCTOR|FAM:4|BOV:30(8P,10C,10T,1V,1TO)|ACC:TIERRA|Necesito camión");
    expect(parsearComoBackend(msg)).toMatchObject({
      perfil: "productor",
      familiares: 4,
      bovinos: 30,
      detalle: "8P,10C,10T,1V,1TO",
      acceso: "TIERRA",
      texto: "Necesito camión",
    });
  });

  it("reproduce el caso mínimo del backend (ciudadano con FAM)", () => {
    expect(codificarSOS({ lat: -26.18, lon: -58.139, perfil: "ciudadano", familiares: 2 })).toBe(
      "SOS-FSA|-26.18,-58.139|CIUDADANO|FAM:2",
    );
  });

  it("omite BOV sin detalle y usa punto decimal con 5 decimales como máximo", () => {
    const msg = codificarSOS({ lat: -26.1834567891, lon: -58.1391, perfil: "productor", bovinos: 5 });
    expect(msg).toBe("SOS-FSA|-26.18346,-58.1391|PRODUCTOR|BOV:5");
    expect(parsearComoBackend(msg).bovinos).toBe(5);
  });

  it("neutraliza separadores, paréntesis y caracteres de control", () => {
    const msg = codificarSOS({
      lat: -26.18,
      lon: -58.139,
      perfil: "ciudadano",
      bovinos: 3,
      detalleBovinos: "vacas (3) | toros",
      acceso: "camino|ripio\n",
      texto: "agua|subiendo\t rápido",
    });
    expect(msg.split("|")).toHaveLength(6);
    const p = parsearComoBackend(msg);
    expect(p.detalle).toBe("vacas 3 / toros");
    expect(p.acceso).toBe("camino/ripio");
    expect(p.texto).toBe("agua/subiendo rápido");
  });

  it("escapa un texto libre que se confundiría con un campo", () => {
    const msg = codificarSOS({ lat: -26.18, lon: -58.139, perfil: "ciudadano", texto: "FAM:99 necesito ayuda" });
    const p = parsearComoBackend(msg);
    expect(p.familiares).toBe(0);
    expect(p.texto).toBe("- FAM:99 necesito ayuda");
  });

  it("recorta a los máximos del backend (ACC 60, texto 500, detalle 80)", () => {
    const msg = codificarSOS({
      lat: -26.18,
      lon: -58.139,
      perfil: "productor",
      bovinos: 1,
      detalleBovinos: "x".repeat(200),
      acceso: "a".repeat(100),
      texto: "t".repeat(900),
    });
    const p = parsearComoBackend(msg);
    expect(p.detalle).toHaveLength(80);
    expect(p.acceso).toHaveLength(60);
    expect(p.texto).toHaveLength(500);
  });

  it("rechaza lo mismo que rechazaría el backend", () => {
    expect(() => codificarSOS({ lat: -26.18, lon: -58.139, perfil: "ciudadano" })).toThrow(ErrorSOS);
    expect(() => codificarSOS({ lat: -126.18, lon: -58.139, perfil: "ciudadano", familiares: 1 })).toThrow(ErrorSOS);
    expect(() => codificarSOS({ lat: Number.NaN, lon: -58.139, perfil: "ciudadano", familiares: 1 })).toThrow(ErrorSOS);
  });
});

describe("enlaceSMS", () => {
  it("codifica el cuerpo y no envía nada por sí mismo", () => {
    const url = enlaceSMS("", "SOS-FSA|-26.18,-58.139|CIUDADANO|FAM:2");
    expect(url.startsWith("sms:?body=")).toBe(true);
    expect(decodeURIComponent(url.split("body=")[1])).toBe("SOS-FSA|-26.18,-58.139|CIUDADANO|FAM:2");
  });
});
