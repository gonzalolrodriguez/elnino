import {
  ColaOffline,
  RepositorioMemoria,
  esperaBackoffMs,
  type DatosSolicitud,
  type ResultadoEnvio,
  type ResultadoFoto,
} from "@/lib/cola";

const datos = (texto: string): DatosSolicitud => ({
  tipo: "asistencia",
  personas: 2,
  animales: 0,
  lon: -58.139,
  lat: -26.18,
  texto,
  origen: "app",
});

function armar(opciones: {
  red: boolean;
  respuestas?: ResultadoEnvio[];
  fotos?: ResultadoFoto[];
}) {
  const estado = { red: opciones.red, ahora: 1_000_000 };
  const enviados: string[] = [];
  const claves: string[] = [];
  const fotos: { servidorId: number; uri: string }[] = [];
  const respuestas = [...(opciones.respuestas ?? [])];
  const respFotos = [...(opciones.fotos ?? [])];
  let n = 0;
  const repo = new RepositorioMemoria();
  const cola = new ColaOffline({
    repo,
    hayRed: async () => estado.red,
    enviar: async (d, clave) => {
      enviados.push(d.texto ?? "");
      claves.push(clave);
      return respuestas.shift() ?? { ok: true, servidorId: 100 + enviados.length };
    },
    subirFoto: async (servidorId, uri) => {
      fotos.push({ servidorId, uri });
      return respFotos.shift() ?? { ok: true };
    },
    ahora: () => estado.ahora,
    generarClave: () => `clave-${++n}`,
  });
  return { cola, estado, enviados, claves, fotos, repo };
}

describe("ColaOffline", () => {
  it("encola sin red y no envía nada", async () => {
    const { cola, enviados } = armar({ red: false });
    await cola.encolar(1, datos("uno"), null);
    await cola.encolar(1, datos("dos"), "file:///foto.jpg");
    const r = await cola.vaciar(1);
    expect(r).toMatchObject({ sinRed: true, enviadas: 0, pendientes: 2 });
    expect(enviados).toEqual([]);
    expect((await cola.pendientes(1))[1].fotoUri).toBe("file:///foto.jpg");
  });

  it("al volver la red envía en orden de creación", async () => {
    const { cola, estado, enviados } = armar({ red: false });
    await cola.encolar(1, datos("uno"), null);
    await cola.encolar(1, datos("dos"), null);
    await cola.encolar(1, datos("tres"), null);
    await cola.vaciar(1);
    estado.red = true;
    const r = await cola.vaciar(1);
    expect(enviados).toEqual(["uno", "dos", "tres"]);
    expect(r).toMatchObject({ enviadas: 3, pendientes: 0, sinRed: false });
    expect((await cola.listar(1)).every((i) => i.estado === "enviada" && i.servidorId !== null)).toBe(true);
  });

  it("ante un error de red se detiene, conserva el orden y aplica backoff", async () => {
    const { cola, estado, enviados } = armar({
      red: true,
      respuestas: [{ ok: false, tipo: "red", mensaje: "timeout" }],
    });
    await cola.encolar(1, datos("uno"), null);
    await cola.encolar(1, datos("dos"), null);
    const r1 = await cola.vaciar(1);
    expect(r1).toMatchObject({ enviadas: 0, pendientes: 2 });
    expect(enviados).toEqual(["uno"]);

    // Dentro de la espera no reintenta; al cumplirse, sí, y en el mismo orden.
    await cola.vaciar(1);
    expect(enviados).toEqual(["uno"]);
    estado.ahora += esperaBackoffMs(1) + 1;
    await cola.vaciar(1);
    expect(enviados).toEqual(["uno", "uno", "dos"]);
  });

  it("un rechazo de validación no bloquea al resto", async () => {
    const { cola, enviados } = armar({
      red: true,
      respuestas: [{ ok: false, tipo: "rechazo", mensaje: "422" }],
    });
    await cola.encolar(1, datos("mala"), null);
    await cola.encolar(1, datos("buena"), null);
    const r = await cola.vaciar(1);
    expect(r).toMatchObject({ rechazadas: 1, enviadas: 1, pendientes: 0 });
    expect(enviados).toEqual(["mala", "buena"]);
    expect((await cola.listar(1))[0]).toMatchObject({ estado: "rechazada", ultimoError: "422" });
  });

  it("el backoff crece y tiene tope", () => {
    expect(esperaBackoffMs(1)).toBe(5_000);
    expect(esperaBackoffMs(2)).toBe(10_000);
    expect(esperaBackoffMs(20)).toBe(5 * 60_000);
  });

  it("no mezcla las colas de usuarios distintos y no envía dos vaciados a la vez", async () => {
    const { cola, enviados } = armar({ red: true });
    await cola.encolar(1, datos("a"), null);
    await cola.encolar(2, datos("b"), null);
    await Promise.all([cola.vaciar(1), cola.vaciar(1)]);
    expect(enviados).toEqual(["a"]);
  });

  describe("clave de idempotencia", () => {
    it("se genera al encolar y se reutiliza igual en cada reintento", async () => {
      const { cola, estado, claves } = armar({
        red: true,
        respuestas: [{ ok: false, tipo: "red", mensaje: "timeout" }],
      });
      const item = await cola.encolar(1, datos("uno"), null);
      expect(item.claveIdempotencia).toBe("clave-1");
      await cola.vaciar(1);
      estado.ahora += esperaBackoffMs(1) + 1;
      await cola.vaciar(1);
      expect(claves).toEqual(["clave-1", "clave-1"]);
      expect((await cola.listar(1))[0].claveIdempotencia).toBe("clave-1");
    });

    it("cada solicitud tiene su propia clave", async () => {
      const { cola, claves } = armar({ red: true });
      await cola.encolar(1, datos("a"), null);
      await cola.encolar(1, datos("b"), null);
      await cola.vaciar(1);
      expect(new Set(claves).size).toBe(2);
    });

    it("un ítem previo sin clave recibe una y la conserva", async () => {
      const { cola, repo, claves } = armar({ red: true });
      const item = await cola.encolar(1, datos("viejo"), null);
      await repo.actualizar(item.id, { claveIdempotencia: "" });
      await cola.vaciar(1);
      expect(claves).toEqual(["clave-2"]);
      expect((await cola.listar(1))[0].claveIdempotencia).toBe("clave-2");
    });
  });

  describe("foto como segundo tiempo", () => {
    it("sube la foto a la solicitud creada y recién entonces marca enviada", async () => {
      const { cola, enviados, fotos } = armar({ red: true });
      await cola.encolar(1, datos("con foto"), "file:///foto.jpg");
      const r = await cola.vaciar(1);
      expect(enviados).toEqual(["con foto"]);
      expect(fotos).toEqual([{ servidorId: 101, uri: "file:///foto.jpg" }]);
      expect(r).toMatchObject({ enviadas: 1, pendientes: 0 });
      expect((await cola.listar(1))[0]).toMatchObject({ estado: "enviada", fotoSubida: true });
    });

    it("sin foto no hay segundo tiempo", async () => {
      const { cola, fotos } = armar({ red: true });
      await cola.encolar(1, datos("sin foto"), null);
      await cola.vaciar(1);
      expect(fotos).toEqual([]);
    });

    it("si falla la foto reintenta solo la foto: no vuelve a crear la solicitud", async () => {
      const { cola, estado, enviados, fotos } = armar({
        red: true,
        fotos: [{ ok: false, tipo: "red", mensaje: "sin señal" }],
      });
      await cola.encolar(1, datos("con foto"), "file:///foto.jpg");
      const r1 = await cola.vaciar(1);
      expect(r1).toMatchObject({ enviadas: 0, pendientes: 1 });
      expect((await cola.listar(1))[0]).toMatchObject({
        estado: "pendiente",
        servidorId: 101,
        fotoSubida: false,
        intentos: 1,
      });

      await cola.vaciar(1); // dentro de la espera: nada
      expect(fotos).toHaveLength(1);

      estado.ahora += esperaBackoffMs(1) + 1;
      const r2 = await cola.vaciar(1);
      expect(enviados).toEqual(["con foto"]); // la solicitud se creó una sola vez
      expect(fotos).toHaveLength(2);
      expect(r2).toMatchObject({ enviadas: 1, pendientes: 0 });
      expect((await cola.listar(1))[0]).toMatchObject({ estado: "enviada", fotoSubida: true });
    });

    it("una foto rechazada no bloquea: la solicitud queda enviada y la foto se descarta", async () => {
      const { cola, fotos } = armar({
        red: true,
        fotos: [{ ok: false, tipo: "rechazo", mensaje: "415" }],
      });
      await cola.encolar(1, datos("a"), "file:///a.jpg");
      await cola.encolar(1, datos("b"), null);
      const r = await cola.vaciar(1);
      expect(r).toMatchObject({ enviadas: 2, rechazadas: 0, pendientes: 0 });
      expect(fotos).toHaveLength(1);
      const [a] = await cola.listar(1);
      expect(a).toMatchObject({ estado: "enviada", fotoUri: null, fotoSubida: false });
      expect(a.ultimoError).toContain("415");
    });
  });
});
