import {
  ColaOffline,
  RepositorioMemoria,
  esperaBackoffMs,
  hostDeUrl,
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
      enviados.push((d as DatosSolicitud).texto ?? "");
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

describe("ColaOffline: servidor del ítem", () => {
  function armarServidores() {
    const estado = { servidor: "http://a.invalid:8000" };
    const enviados: string[] = [];
    const cola = new ColaOffline({
      repo: new RepositorioMemoria(),
      hayRed: async () => true,
      enviar: async (d) => {
        enviados.push(`${estado.servidor}|${(d as DatosSolicitud).texto}`);
        return { ok: true, servidorId: 1 };
      },
      subirFoto: async () => ({ ok: true }),
      servidorActual: () => estado.servidor,
      ahora: () => 1_000_000,
    });
    return { cola, estado, enviados };
  }

  it("un ítem creado en el servidor A no se envía al B (mismo usuario) y se envía al volver a A", async () => {
    const { cola, estado, enviados } = armarServidores();
    const item = await cola.encolar(7, datos("uno"), null);
    expect(item.servidorUrl).toBe("http://a.invalid:8000");

    estado.servidor = "http://b.invalid:8000";
    const enB = await cola.vaciar(7, true);
    expect(enB).toMatchObject({ enviadas: 0, pendientes: 0 });
    expect(enviados).toEqual([]);
    expect(await cola.pendientesOtroServidor(7)).toHaveLength(1);
    expect((await cola.listar(7))[0].estado).toBe("pendiente");

    estado.servidor = "http://a.invalid:8000";
    const enA = await cola.vaciar(7, true);
    expect(enA.enviadas).toBe(1);
    expect(enviados).toEqual(["http://a.invalid:8000|uno"]);
  });

  it("los ítems de otro servidor se pueden descartar y los del vigente siguen enviándose", async () => {
    const { cola, estado, enviados } = armarServidores();
    const viejo = await cola.encolar(7, datos("viejo"), null);
    estado.servidor = "http://b.invalid:8000";
    await cola.encolar(7, datos("nuevo"), null);
    await cola.vaciar(7, true);
    expect(enviados).toEqual(["http://b.invalid:8000|nuevo"]);
    await cola.descartar(viejo.id);
    expect(await cola.pendientesOtroServidor(7)).toHaveLength(0);
  });

  it("otro usuario nunca ve ni envía ítems ajenos aunque el servidor coincida", async () => {
    const { cola, enviados } = armarServidores();
    await cola.encolar(7, datos("de siete"), null);
    const r = await cola.vaciar(8, true);
    expect(r.enviadas).toBe(0);
    expect(enviados).toEqual([]);
  });

  it("hostDeUrl muestra el host con puerto", () => {
    expect(hostDeUrl("http://192.168.1.50:8000")).toBe("192.168.1.50:8000");
    expect(hostDeUrl("https://api.invalid/prefijo")).toBe("api.invalid");
  });
});

describe("ColaOffline: máximo de intentos, fotos perdidas y segunda pasada", () => {
  function armarCon(opciones: {
    enviar: (d: DatosSolicitud) => Promise<ResultadoEnvio>;
    subirFoto?: (id: number, uri: string) => Promise<ResultadoFoto>;
    maxIntentos?: number;
  }) {
    const estado = { ahora: 1_000_000 };
    const repo = new RepositorioMemoria();
    const cola = new ColaOffline({
      repo,
      hayRed: async () => true,
      enviar: opciones.enviar,
      subirFoto: opciones.subirFoto ?? (async () => ({ ok: true })),
      ahora: () => estado.ahora,
      generarClave: () => "k",
      maxIntentos: opciones.maxIntentos ?? 3,
    });
    return { cola, estado, repo };
  }

  it("tras el máximo de intentos el ítem pasa a rechazada y el siguiente se envía", async () => {
    const enviados: string[] = [];
    const { cola, estado } = armarCon({
      enviar: async (d) => {
        enviados.push((d as DatosSolicitud).texto ?? "");
        return d.texto === "malo"
          ? { ok: false, tipo: "red", mensaje: "500" }
          : { ok: true, servidorId: 9 };
      },
    });
    await cola.encolar(1, datos("malo"), null);
    await cola.encolar(1, datos("bueno"), null);

    // Intentos 1 y 2: el ítem malo se reprograma y bloquea el resto (la red puede haberse caído).
    let r = await cola.vaciar(1, true);
    expect(r).toMatchObject({ enviadas: 0, rechazadas: 0, pendientes: 2 });
    estado.ahora += 10 * 60_000;
    await cola.vaciar(1, true);
    expect(enviados).toEqual(["malo", "malo"]);

    // Tercer intento: se agota, se rechaza y la cola sigue con "bueno".
    r = await cola.vaciar(1, true);
    expect(r).toMatchObject({ enviadas: 1, rechazadas: 1, pendientes: 0 });
    const items = await cola.listar(1);
    expect(items.map((i) => i.estado)).toEqual(["rechazada", "enviada"]);
    expect(items[0].ultimoError).toContain("3 intentos");
  });

  it("un fallo de sesión (401) nunca agota los intentos", async () => {
    const { cola } = armarCon({
      maxIntentos: 1,
      enviar: async () => ({ ok: false, tipo: "sesion", mensaje: "401" }),
    });
    await cola.encolar(1, datos("a"), null);
    await cola.vaciar(1, true);
    expect((await cola.listar(1))[0].estado).toBe("pendiente");
  });

  it("una foto que ya no existe (rechazo) no bloquea: la solicitud queda enviada y la cola sigue", async () => {
    const { cola } = armarCon({
      enviar: async () => ({ ok: true, servidorId: 5 }),
      subirFoto: async () => ({ ok: false, tipo: "rechazo", mensaje: "la foto ya no está en el teléfono" }),
    });
    await cola.encolar(1, datos("con foto"), "file:///perdida.jpg");
    await cola.encolar(1, datos("siguiente"), null);
    const r = await cola.vaciar(1, true);
    expect(r).toMatchObject({ enviadas: 2, pendientes: 0 });
    const [primero] = await cola.listar(1);
    expect(primero.fotoUri).toBeNull();
    expect(primero.estado).toBe("enviada");
  });

  it("una foto que falla por red muchas veces se abandona sin perder la solicitud", async () => {
    const { cola, estado } = armarCon({
      maxIntentos: 2,
      enviar: async () => ({ ok: true, servidorId: 5 }),
      subirFoto: async () => ({ ok: false, tipo: "red", mensaje: "sin red" }),
    });
    await cola.encolar(1, datos("foto"), "file:///x.jpg");
    await cola.vaciar(1, true);
    expect((await cola.listar(1))[0].estado).toBe("pendiente");
    estado.ahora += 10 * 60_000;
    await cola.vaciar(1, true);
    const [item] = await cola.listar(1);
    expect(item).toMatchObject({ estado: "enviada", fotoUri: null });
  });

  it("si se inserta algo durante un vaciado en curso, se encadena una segunda pasada", async () => {
    let liberar: () => void = () => undefined;
    const compuerta = new Promise<void>((res) => (liberar = res));
    const enviados: string[] = [];
    const { cola } = armarCon({
      enviar: async (d) => {
        enviados.push((d as DatosSolicitud).texto ?? "");
        if (d.texto === "primero") await compuerta;
        return { ok: true, servidorId: 1 };
      },
    });
    await cola.encolar(1, datos("primero"), null);
    const en_curso = cola.vaciar(1, true);
    await Promise.resolve();
    await cola.encolar(1, datos("segundo"), null);
    const segunda = cola.vaciar(1, true);
    liberar();
    const r = await Promise.all([en_curso, segunda]);
    expect(enviados).toEqual(["primero", "segundo"]);
    expect(r[1].enviadas).toBe(2);
  });

  it("purga las enviadas de más de un día y quita los ítems de otras cuentas", async () => {
    const { cola, estado } = armarCon({ enviar: async () => ({ ok: true, servidorId: 1 }) });
    await cola.encolar(1, datos("vieja"), null);
    await cola.vaciar(1, true);
    expect(await cola.listar(1)).toHaveLength(1);
    estado.ahora += 2 * 24 * 60 * 60_000;
    await cola.vaciar(1, true);
    expect(await cola.listar(1)).toHaveLength(0);

    await cola.encolar(2, datos("de otra cuenta"), null);
    await cola.limpiarAjenos(1);
    expect(await cola.listar(2)).toHaveLength(0);
  });
});
