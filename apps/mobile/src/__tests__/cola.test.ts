import {
  ColaOffline,
  RepositorioMemoria,
  esperaBackoffMs,
  type DatosSolicitud,
  type ResultadoEnvio,
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

function armar(opciones: { red: boolean; respuestas?: ResultadoEnvio[] }) {
  const estado = { red: opciones.red, ahora: 1_000_000 };
  const enviados: string[] = [];
  const respuestas = [...(opciones.respuestas ?? [])];
  const cola = new ColaOffline({
    repo: new RepositorioMemoria(),
    hayRed: async () => estado.red,
    enviar: async (d) => {
      enviados.push(d.texto ?? "");
      return respuestas.shift() ?? { ok: true, servidorId: enviados.length };
    },
    ahora: () => estado.ahora,
  });
  return { cola, estado, enviados };
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
});
