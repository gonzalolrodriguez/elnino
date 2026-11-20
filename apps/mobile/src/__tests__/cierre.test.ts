import { ErrorApi } from "@/lib/api";
import { armarCierre, MAX_FOTOS } from "@/lib/cierre";
import {
  ColaOffline,
  RepositorioMemoria,
  esCierre,
  type DatosCierre,
  type DatosCola,
  type ResultadoEnvio,
  type ResultadoFoto,
} from "@/lib/cola";
import { textoSMSConfirmacion } from "@/lib/confirmacion";

const mockPeticion = jest.fn();
jest.mock("@/lib/api", () => ({
  ...jest.requireActual("@/lib/api"),
  peticion: (...a: unknown[]) => mockPeticion(...a),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const servicios = require("@/lib/servicios") as typeof import("@/lib/servicios");

const cierre = (fotos: string[] = []): DatosCierre => ({
  clase: "cierre",
  tarea_id: 7,
  lat: -26.18,
  lon: -58.139,
  centro_id: 3,
  personas_trasladadas: 3,
  animales_trasladados: { bovinos: 12 },
  nota: "Llegaron por la ruta de ripio.",
  fotos,
});

function armar(opciones: { respuestas?: ResultadoEnvio[]; fotos?: ResultadoFoto[]; maxIntentos?: number } = {}) {
  const claves: string[] = [];
  const subidas: { id: number; uri: string }[] = [];
  const respuestas = [...(opciones.respuestas ?? [])];
  const respFotos = [...(opciones.fotos ?? [])];
  const repo = new RepositorioMemoria();
  const cola = new ColaOffline({
    repo,
    hayRed: async () => true,
    enviar: async (_d: DatosCola, clave: string) => {
      claves.push(clave);
      return respuestas.shift() ?? { ok: true, servidorId: 7 };
    },
    subirFoto: async (id: number, uri: string) => {
      subidas.push({ id, uri });
      return respFotos.shift() ?? { ok: true };
    },
    maxIntentos: opciones.maxIntentos,
  });
  return { cola, repo, claves, subidas };
}

describe("cola: cierre en dos tiempos", () => {
  it("manda primero el JSON y después las fotos, a la constancia de la tarea", async () => {
    const { cola, claves, subidas } = armar();
    await cola.encolar(1, cierre(["file:///a.jpg", "file:///b.jpg"]), null);
    const r = await cola.vaciar(1, true);
    expect(r.enviadas).toBe(1);
    expect(claves).toHaveLength(1);
    expect(subidas).toEqual([
      { id: 7, uri: "file:///a.jpg" },
      { id: 7, uri: "file:///b.jpg" },
    ]);
    const [item] = await cola.listar(1);
    expect(item.estado).toBe("enviada");
    expect(esCierre(item.datos) && item.datos.fotos).toEqual([]);
  });

  it("conserva la misma Idempotency-Key en los reintentos", async () => {
    const { cola, claves } = armar({
      respuestas: [
        { ok: false, tipo: "red", mensaje: "sin red" },
        { ok: false, tipo: "red", mensaje: "sin red" },
        { ok: true, servidorId: 7 },
      ],
    });
    await cola.encolar(1, cierre(), null);
    await cola.vaciar(1, true);
    await cola.vaciar(1, true);
    await cola.vaciar(1, true);
    expect(claves).toHaveLength(3);
    expect(new Set(claves).size).toBe(1);
    expect(claves[0]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("si la foto falla por red, el cierre ya enviado no se reenvía y la foto se reintenta", async () => {
    const { cola, claves, subidas } = armar({
      fotos: [{ ok: false, tipo: "red", mensaje: "sin red" }, { ok: true }],
    });
    await cola.encolar(1, cierre(["file:///a.jpg"]), null);
    await cola.vaciar(1, true);
    let [item] = await cola.listar(1);
    expect(item.estado).toBe("pendiente");
    expect(item.servidorId).toBe(7);
    await cola.vaciar(1, true);
    [item] = await cola.listar(1);
    expect(item.estado).toBe("enviada");
    expect(claves).toHaveLength(1);
    expect(subidas).toHaveLength(2);
  });

  it("una foto que falta o es rechazada no bloquea el cierre ni las demás fotos", async () => {
    const { cola, subidas } = armar({
      fotos: [{ ok: true }, { ok: false, tipo: "rechazo", mensaje: "la foto ya no está en el teléfono" }],
    });
    await cola.encolar(1, cierre(["file:///b.jpg", "file:///perdida.jpg"]), null);
    await cola.vaciar(1, true);
    const [item] = await cola.listar(1);
    expect(item.estado).toBe("enviada");
    expect(subidas.map((s) => s.uri)).toEqual(["file:///b.jpg", "file:///perdida.jpg"]);
    expect(item.ultimoError).toContain("La constancia se envió, pero el servidor no aceptó la foto");
  });

  it("tras el máximo de intentos se abandona la foto y la cola sigue", async () => {
    const { cola } = armar({
      maxIntentos: 1,
      fotos: [{ ok: false, tipo: "red", mensaje: "sin red" }],
    });
    await cola.encolar(1, cierre(["file:///a.jpg"]), null);
    await cola.vaciar(1, true);
    const [item] = await cola.listar(1);
    expect(item.estado).toBe("enviada");
    expect(esCierre(item.datos) && item.datos.fotos).toEqual([]);
    expect(item.ultimoError).toContain("la foto no pudo subirse");
  });

  it("un rechazo del servidor (409) marca el cierre como rechazado y no bloquea el resto", async () => {
    const { cola } = armar({ respuestas: [{ ok: false, tipo: "rechazo", mensaje: "La tarea ya está cerrada" }] });
    await cola.encolar(1, cierre(), null);
    const r = await cola.vaciar(1, true);
    expect(r.rechazadas).toBe(1);
    const [item] = await cola.listar(1);
    expect(item.estado).toBe("rechazada");
  });

  it("guarda el resultado del servidor para mostrarlo en palabras simples", async () => {
    const resultado = { estado: "cerrada_cuadrilla", motivos_discrepancia: [], confirmacion_solicitada: true, repetida: false };
    const { cola } = armar({ respuestas: [{ ok: true, servidorId: 7, resultado }] });
    await cola.encolar(1, cierre(), null);
    await cola.vaciar(1, true);
    const [item] = await cola.listar(1);
    expect(esCierre(item.datos) && item.datos.resultado).toEqual(resultado);
  });
});

describe("servicios: cierre y confirmación", () => {
  beforeEach(() => mockPeticion.mockReset());

  it("el cierre va a /tareas/{id}/cierre con Idempotency-Key y solo los campos del contrato", async () => {
    mockPeticion.mockResolvedValue({
      evacuacion: { estado: "cerrada_cuadrilla", motivos_discrepancia: [], confirmacion_solicitada: true },
      repetida: false,
    });
    const r = await servicios.enviarItem({ ...cierre(["file:///a.jpg"]), resultado: undefined }, "clave-1");
    const [ruta, op] = mockPeticion.mock.calls[0];
    expect(ruta).toBe("/tareas/7/cierre");
    expect(op.metodo).toBe("POST");
    expect(op.cabeceras).toEqual({ "Idempotency-Key": "clave-1" });
    expect(Object.keys(op.cuerpo).sort()).toEqual(
      ["animales_trasladados", "centro_id", "lat", "lon", "nota", "personas_trasladadas"],
    );
    expect(r).toMatchObject({ ok: true, servidorId: 7, resultado: { estado: "cerrada_cuadrilla", confirmacion_solicitada: true } });
  });

  it("el reintento repetido (200) se informa como repetido", async () => {
    mockPeticion.mockResolvedValue({ evacuacion: { estado: "verificada" }, repetida: true });
    const r = await servicios.enviarItem(cierre(), "clave-1");
    expect(r).toMatchObject({ ok: true, resultado: { repetida: true, estado: "verificada" } });
  });

  it("las fotos del cierre van a /tareas/{id}/cierre/adjuntos", async () => {
    mockPeticion.mockResolvedValue({});
    await servicios.subirFotoItem(7, "file:///a.jpg", cierre());
    expect(mockPeticion.mock.calls[0][0]).toBe("/tareas/7/cierre/adjuntos");
    mockPeticion.mockClear();
    await servicios.subirFotoItem(9, "file:///a.jpg", { tipo: "otro", personas: 1, animales: 0, texto: null, origen: "app" });
    expect(mockPeticion.mock.calls[0][0]).toBe("/solicitudes/9/adjuntos");
  });

  it("409 al cerrar es un rechazo; sin red es reintentable", async () => {
    mockPeticion.mockRejectedValueOnce(new ErrorApi(409, "conflicto", "La tarea ya está cerrada"));
    expect(await servicios.enviarItem(cierre(), "k")).toMatchObject({ ok: false, tipo: "rechazo" });
    mockPeticion.mockRejectedValueOnce(new ErrorApi(0, "sin_conexion", "Sin conexión"));
    expect(await servicios.enviarItem(cierre(), "k")).toMatchObject({ ok: false, tipo: "red" });
  });

  it("la confirmación va a /mi/confirmaciones y un 409 es rechazo", async () => {
    mockPeticion.mockResolvedValueOnce({ id: 4, repetida: true });
    const r = await servicios.enviarItem({ clase: "confirmacion", solicitud_id: 12, respuesta: "otro_problema", comentario: "faltó agua" }, "k");
    expect(mockPeticion.mock.calls[0][0]).toBe("/mi/confirmaciones");
    expect(mockPeticion.mock.calls[0][1].cuerpo).toEqual({ solicitud_id: 12, respuesta: "otro_problema", comentario: "faltó agua" });
    expect(r).toMatchObject({ ok: true, servidorId: 4, resultado: { repetida: true } });
    mockPeticion.mockRejectedValueOnce(new ErrorApi(409, "conflicto", "Ya respondiste"));
    expect(await servicios.enviarItem({ clase: "confirmacion", solicitud_id: 12, respuesta: "no_vinieron" }, "k")).toMatchObject({ ok: false, tipo: "rechazo" });
  });

  it.each([
    ["completa", "completa"],
    ["parcial", "parcial"],
    ["no_encontraron", "no_encontraron"],
    ["no_vinieron", "no_vinieron"],
    ["otro_problema", "otro_problema"],
    // Valores viejos que pudieron quedar en la cola del teléfono antes de esta versión.
    ["si", "completa"],
    ["no", "no_vinieron"],
    ["problema", "otro_problema"],
  ] as const)("envía %s como %s", async (guardada, enviada) => {
    mockPeticion.mockResolvedValueOnce({ id: 5 });
    await servicios.enviarItem({ clase: "confirmacion", solicitud_id: 12, respuesta: guardada }, "k");
    expect(mockPeticion.mock.calls[0][1].cuerpo).toEqual({ solicitud_id: 12, respuesta: enviada });
  });
});

describe("armarCierre", () => {
  const base = {
    tareaId: 7,
    ubicacion: { lat: -26.18, lon: -58.139 },
    centroId: 3,
    personas: "3",
    animales: { bovinos: "12", ovinos: "" },
    nota: "",
    fotos: [] as string[],
  };

  it("arma los datos con animales por especie sin ceros", () => {
    const r = armarCierre(base);
    expect(r.ok && r.datos).toMatchObject({ clase: "cierre", tarea_id: 7, personas_trasladadas: 3, animales_trasladados: { bovinos: 12 }, centro_id: 3 });
  });
  it("exige el GPS del destino", () => {
    expect(armarCierre({ ...base, ubicacion: null })).toMatchObject({ ok: false });
  });
  it("la nota es obligatoria si no se trasladó a nadie", () => {
    const vacio = { ...base, personas: "0", animales: {} };
    expect(armarCierre(vacio)).toMatchObject({ ok: false, mensaje: expect.stringContaining("nota") });
    expect(armarCierre({ ...vacio, nota: "No había nadie en el domicilio" }).ok).toBe(true);
  });
  it("rechaza números inválidos y acota las fotos", () => {
    expect(armarCierre({ ...base, personas: "tres" }).ok).toBe(false);
    expect(armarCierre({ ...base, personas: "5001" }).ok).toBe(false);
    const muchas = Array.from({ length: MAX_FOTOS + 3 }, (_, i) => `file:///${i}.jpg`);
    const r = armarCierre({ ...base, fotos: muchas });
    expect(r.ok && r.datos.fotos).toHaveLength(MAX_FOTOS);
  });
});

describe("texto del SMS de confirmación", () => {
  it("compone SI / NO / PROBLEMA con el código", () => {
    expect(textoSMSConfirmacion("si", "K7M2QX")).toBe("SI K7M2QX");
    expect(textoSMSConfirmacion("no", "K7M2QX", "ignorado")).toBe("NO K7M2QX");
    expect(textoSMSConfirmacion("problema", "K7M2QX", "  faltó\nagua ")).toBe("PROBLEMA K7M2QX faltó agua");
    expect(textoSMSConfirmacion("problema", "K7M2QX")).toBe("PROBLEMA K7M2QX");
  });

  it("las respuestas nuevas usan la palabra del canal vigente y llevan el motivo", () => {
    expect(textoSMSConfirmacion("completa", "K7M2QX")).toBe("SI K7M2QX");
    expect(textoSMSConfirmacion("no_vinieron", "K7M2QX")).toBe("NO K7M2QX");
    expect(textoSMSConfirmacion("parcial", "K7M2QX")).toBe("PROBLEMA K7M2QX Me asistieron en parte.");
    expect(textoSMSConfirmacion("no_encontraron", "K7M2QX", "estaba en el fondo")).toBe(
      "PROBLEMA K7M2QX Vinieron pero no me encontraron. estaba en el fondo",
    );
    expect(textoSMSConfirmacion("otro_problema", "K7M2QX", "faltó agua")).toBe("PROBLEMA K7M2QX faltó agua");
  });
});
