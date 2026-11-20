import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorApi } from "@/lib/api";
import { ColaOffline, RepositorioMemoria, esParte, type DatosParte } from "@/lib/cola";
import { descripcionItemCola } from "@/lib/etiquetas";
import { armarParte, cuerpoParte, exigeConstancia, textoNovedad, type ParteTarea } from "@/lib/partes";
import { PREFIJO_CACHE_PUBLICA } from "@/lib/cacheLocal";
import type { PedidoCiudadano, Tarea } from "@/lib/servicios";

jest.mock("expo-router", () => ({
  Redirect: () => null,
  useRouter: () => ({ push: jest.fn() }),
  Tabs: () => null,
  Stack: () => null,
}));

jest.mock("@/lib/SesionContext", () => ({
  ...jest.requireActual("@/lib/SesionContext"),
  useUsuario: () => ({ id: 7, email: "x", nombre_visible: "x", rol: "cuadrilla", rol_operativo: "defensa_civil", estado: "activo" }),
}));

// La cola de la pantalla se controla desde cada prueba.
const mockEnviar = jest.fn();
const mockDescartar = jest.fn(async () => undefined);
let mockItems: unknown[] = [];
jest.mock("@/lib/ColaContext", () => ({
  useCola: () => ({
    items: mockItems,
    otroServidor: [],
    enviar: (...a: unknown[]) => mockEnviar(...a),
    descartar: (...a: unknown[]) => mockDescartar(...(a as [])),
    reintentar: jest.fn(),
    sinRed: false,
  }),
}));

const mockAlmacen = new Map<string, { valor: unknown; guardadoEn: number }>();
jest.mock("@/lib/cacheLocal", () => ({
  ...jest.requireActual("@/lib/cacheLocal"),
  guardarCache: jest.fn(async (k: string, valor: unknown, ahora = Date.now()) => void mockAlmacen.set(k, { valor, guardadoEn: ahora })),
  leerCache: jest.fn(async (k: string) => mockAlmacen.get(k) ?? null),
}));

const mockPeticion = jest.fn();
jest.mock("@/lib/api", () => ({
  ...jest.requireActual("@/lib/api"),
  peticion: (...a: unknown[]) => mockPeticion(...a),
}));

const mockTareas = jest.fn();
const mockPartes = jest.fn();
const mockMisPedidos = jest.fn();
jest.mock("@/lib/servicios", () => ({
  ...jest.requireActual("@/lib/servicios"),
  api: {
    tareas: (...a: unknown[]) => mockTareas(...a),
    partesDeTarea: (...a: unknown[]) => mockPartes(...a),
    actualizarTarea: jest.fn(),
    misPedidos: (...a: unknown[]) => mockMisPedidos(...a),
    solicitudes: jest.fn(),
  },
}));

// Pantalla de cuadrilla: piezas que dependen del dispositivo o de la sesión.
jest.mock("@/components/SoloRol", () => ({ SoloRol: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("@/components/EnlaceBrujula", () => ({ EnlaceBrujula: () => null }));
jest.mock("@/lib/compartirPosicion", () => ({ useCompartirPosicion: () => ({ fase: "sin_tarea", pendiente: false }) }));
jest.mock("@/components/FormCierre", () => {
  const { Text } = require("react-native");
  return { FormCierre: () => <Text>FORMULARIO DE CONSTANCIA</Text> };
});

const metricas = { frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const conSafe = (h: React.JSX.Element) => <SafeAreaProvider initialMetrics={metricas}>{h}</SafeAreaProvider>;

const tarea = (extra: Partial<Tarea> = {}): Tarea => ({
  id: 9,
  titulo: "Evacuar familia del paraje",
  descripcion: null,
  estado: "en_curso",
  sector_id: "S4",
  checklist: null,
  actualizado_en: "2026-11-20T15:00:00Z",
  ...extra,
});

const parte = (extra: Partial<ParteTarea> = {}): ParteTarea => ({
  id: 1,
  tarea_id: 9,
  cuadrilla_id: 2,
  tipo: "avance",
  resultado: null,
  observacion: "Salimos hacia el paraje",
  autor_rol: "defensa_civil",
  creado_en: "2026-11-20T15:10:00Z",
  resuelta: null,
  ...extra,
});

const itemCola = (datos: DatosParte, estado: "pendiente" | "rechazada" = "pendiente", extra: Record<string, unknown> = {}) => ({
  id: 50,
  usuarioId: 7,
  datos,
  fotoUri: null,
  estado,
  intentos: 0,
  proximoIntento: 0,
  ultimoError: null,
  servidorId: null,
  claveIdempotencia: "k",
  fotoSubida: false,
  creadoEn: 1,
  servidorUrl: "",
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockAlmacen.clear();
  mockItems = [];
  mockEnviar.mockResolvedValue({ enviadaYa: true, fotoPendiente: false, rechazada: null, resultado: null, itemId: 50 });
  mockPartes.mockResolvedValue({ items: [] });
});

describe("armarParte", () => {
  it("avance: la observación es opcional y no lleva resultado", () => {
    expect(armarParte({ tareaId: 9, tipo: "avance", resultado: null, observacion: "  " })).toEqual({
      ok: true,
      datos: { clase: "parte", tarea_id: 9, tipo: "avance" },
    });
    const r = armarParte({ tareaId: 9, tipo: "avance", resultado: null, observacion: " Vamos bien " });
    expect(r.ok && cuerpoParte(r.datos)).toEqual({ tipo: "avance", observacion: "Vamos bien" });
  });

  it("dificultad: observación obligatoria de 3 a 1000 caracteres", () => {
    expect(armarParte({ tareaId: 9, tipo: "dificultad", resultado: null, observacion: "" }).ok).toBe(false);
    expect(armarParte({ tareaId: 9, tipo: "dificultad", resultado: null, observacion: "ab" }).ok).toBe(false);
    expect(armarParte({ tareaId: 9, tipo: "dificultad", resultado: null, observacion: "abc" }).ok).toBe(true);
    expect(armarParte({ tareaId: 9, tipo: "dificultad", resultado: null, observacion: "x".repeat(1000) }).ok).toBe(true);
    expect(armarParte({ tareaId: 9, tipo: "dificultad", resultado: null, observacion: "x".repeat(1001) }).ok).toBe(false);
  });

  it("resultado: hay que elegirlo; solo «completa» va sin observación", () => {
    expect(armarParte({ tareaId: 9, tipo: "resultado", resultado: null, observacion: "listo" })).toMatchObject({ ok: false, mensaje: "Elegí cómo terminó la tarea." });
    const completa = armarParte({ tareaId: 9, tipo: "resultado", resultado: "completa", observacion: "" });
    expect(completa.ok && cuerpoParte(completa.datos)).toEqual({ tipo: "resultado", resultado: "completa" });
    for (const r of ["parcial", "no_realizada", "reprogramada"] as const) {
      expect(armarParte({ tareaId: 9, tipo: "resultado", resultado: r, observacion: "" }).ok).toBe(false);
      const ok = armarParte({ tareaId: 9, tipo: "resultado", resultado: r, observacion: "Camino cortado" });
      expect(ok.ok && cuerpoParte(ok.datos)).toEqual({ tipo: "resultado", resultado: r, observacion: "Camino cortado" });
    }
  });

  it("reconoce el 409 de constancia y describe el parte pendiente", () => {
    expect(exigeConstancia("Cerrá la tarea con constancia")).toBe(true);
    expect(exigeConstancia("Otro error")).toBe(false);
    const d: DatosParte = { clase: "parte", tarea_id: 9, tipo: "resultado", resultado: "parcial", observacion: "x y z" };
    expect(esParte(d)).toBe(true);
    expect(descripcionItemCola(d)).toBe("Terminar la tarea: A medias · tarea #9");
  });
});

describe("envío offline de partes (cola real, servidor simulado)", () => {
  it("sin conexión queda pendiente y al volver la red hace POST /tareas/{id}/partes con la misma clave", async () => {
    const { enviarItem } = jest.requireActual<typeof import("@/lib/servicios")>("@/lib/servicios");
    mockPeticion.mockResolvedValue({ id: 31 });
    const red = { hay: false };
    const cola = new ColaOffline({
      repo: new RepositorioMemoria(),
      hayRed: async () => red.hay,
      enviar: enviarItem,
      subirFoto: async () => ({ ok: true }),
      generarClave: () => "clave-fija",
    });
    const r = armarParte({ tareaId: 9, tipo: "dificultad", resultado: null, observacion: "Camino cortado por el agua" });
    if (!r.ok) throw new Error("debería ser válido");
    await cola.encolar(7, r.datos, null);

    expect(await cola.vaciar(7)).toMatchObject({ sinRed: true, pendientes: 1 });
    expect(mockPeticion).not.toHaveBeenCalled();

    red.hay = true;
    expect(await cola.vaciar(7)).toMatchObject({ enviadas: 1, pendientes: 0 });
    expect(mockPeticion).toHaveBeenCalledWith("/tareas/9/partes", {
      metodo: "POST",
      cuerpo: { tipo: "dificultad", observacion: "Camino cortado por el agua" },
      cabeceras: { "Idempotency-Key": "clave-fija" },
    });
  });

  it("un fallo de red se reintenta; un 409 de constancia es un rechazo definitivo con su mensaje", async () => {
    const { enviarItem } = jest.requireActual<typeof import("@/lib/servicios")>("@/lib/servicios");
    const cola = new ColaOffline({
      repo: new RepositorioMemoria(),
      hayRed: async () => true,
      enviar: enviarItem,
      subirFoto: async () => ({ ok: true }),
    });
    const completa: DatosParte = { clase: "parte", tarea_id: 9, tipo: "resultado", resultado: "completa" };
    await cola.encolar(7, completa, null);

    mockPeticion.mockRejectedValueOnce(new ErrorApi(0, "sin_conexion", "Sin conexión"));
    expect(await cola.vaciar(7, true)).toMatchObject({ enviadas: 0, pendientes: 1 });

    mockPeticion.mockRejectedValueOnce(new ErrorApi(409, "conflicto", "Cerrá la tarea con constancia"));
    expect(await cola.vaciar(7, true)).toMatchObject({ rechazadas: 1, pendientes: 0 });
    const [item] = await cola.listar(7);
    expect(item).toMatchObject({ estado: "rechazada", ultimoError: "Cerrá la tarea con constancia" });
  });
});

describe("pantalla de la cuadrilla", () => {
  const abrir = async (t: Tarea) => {
    mockTareas.mockResolvedValue({ tareas: [t] });
    const Cuadrilla = require("@/app/(app)/cuadrilla").default;
    await render(conSafe(<Cuadrilla />));
    await screen.findByText("Evacuar familia del paraje");
  };

  it("«Informar avance» guarda el parte sin observación y lo envía", async () => {
    await abrir(tarea());
    await fireEvent.press(screen.getByText("Informar avance"));
    await fireEvent.press(screen.getByText("Enviar parte"));
    await waitFor(() => expect(mockEnviar).toHaveBeenCalledWith({ clase: "parte", tarea_id: 9, tipo: "avance" }, null));
    await screen.findByText("Parte enviado");
  });

  it("«Informar dificultad» exige la observación (3 a 1000) antes de enviar", async () => {
    await abrir(tarea());
    await fireEvent.press(screen.getByText("Informar dificultad"));
    await fireEvent.press(screen.getByText("Enviar parte"));
    await screen.findByText(/Contá qué pasó \(de 3 a 1000 caracteres\)/);
    expect(mockEnviar).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText("Observación (obligatoria)"), "Camino cortado por el agua");
    await fireEvent.press(screen.getByText("Enviar parte"));
    await waitFor(() =>
      expect(mockEnviar).toHaveBeenCalledWith(
        { clase: "parte", tarea_id: 9, tipo: "dificultad", observacion: "Camino cortado por el agua" },
        null,
      ),
    );
  });

  it("«Terminar tarea»: A medias pide observación; Completa no", async () => {
    await abrir(tarea());
    await fireEvent.press(screen.getByText("Terminar tarea"));
    await fireEvent.press(screen.getByText("Enviar parte"));
    await screen.findByText("Elegí cómo terminó la tarea.");

    await fireEvent.press(screen.getByText("A medias"));
    await fireEvent.press(screen.getByText("Enviar parte"));
    await screen.findByText(/Contá qué pasó/);
    expect(mockEnviar).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText("Completa"));
    expect(screen.getByLabelText("Observación (opcional)")).toBeTruthy();
    await fireEvent.press(screen.getByText("Enviar parte"));
    await waitFor(() => expect(mockEnviar).toHaveBeenCalledWith({ clase: "parte", tarea_id: 9, tipo: "resultado", resultado: "completa" }, null));
  });

  it("sin conexión el parte queda guardado y se avisa «pendiente de envío»", async () => {
    mockEnviar.mockResolvedValue({ enviadaYa: false, fotoPendiente: false, rechazada: null, resultado: null, itemId: 50 });
    await abrir(tarea());
    await fireEvent.press(screen.getByText("Informar avance"));
    await fireEvent.press(screen.getByText("Enviar parte"));
    await screen.findByText("Parte guardado");
    expect(screen.getByText(/Pendiente de envío: se manda solo cuando haya conexión/)).toBeTruthy();
  });

  it("muestra los partes pendientes de la cola de esa tarea", async () => {
    mockItems = [itemCola({ clase: "parte", tarea_id: 9, tipo: "dificultad", observacion: "agua alta" })];
    await abrir(tarea());
    expect(screen.getByText(/Pendiente de envío: Dificultad · tarea #9/)).toBeTruthy();
  });

  it("si el servidor responde 409 de constancia, «Completa» abre el cierre con constancia", async () => {
    mockEnviar.mockResolvedValue({ enviadaYa: false, fotoPendiente: false, rechazada: "Cerrá la tarea con constancia", resultado: null, itemId: 50 });
    await abrir(tarea());
    await fireEvent.press(screen.getByText("Terminar tarea"));
    await fireEvent.press(screen.getByText("Completa"));
    await fireEvent.press(screen.getByText("Enviar parte"));
    await screen.findByText("FORMULARIO DE CONSTANCIA");
    expect(mockDescartar).toHaveBeenCalledWith(50);
  });

  it("un parte rechazado más tarde por la constancia ofrece abrir el formulario", async () => {
    mockItems = [
      itemCola({ clase: "parte", tarea_id: 9, tipo: "resultado", resultado: "completa" }, "rechazada", { ultimoError: "Cerrá la tarea con constancia" }),
    ];
    await abrir(tarea());
    expect(screen.getByText(/rechazado por el servidor/)).toBeTruthy();
    // El primer botón es el del parte rechazado (el segundo es el «Cerrar con constancia» habitual).
    await fireEvent.press(screen.getAllByText("Cerrar con constancia")[0]);
    await screen.findByText("FORMULARIO DE CONSTANCIA");
    expect(mockDescartar).toHaveBeenCalledWith(50);
  });

  it("avisa «Requiere atención» cuando la tarea volvió a pendiente", async () => {
    await abrir(tarea({ estado: "pendiente", requiere_atencion: true }));
    expect(screen.getByText(/Requiere atención/)).toBeTruthy();
  });

  it("historial de partes: del servidor y, sin conexión, la última copia guardada", async () => {
    mockPartes.mockResolvedValueOnce({
      items: [parte({ id: 2, tipo: "dificultad", observacion: "Camino cortado", resuelta: false, creado_en: "2026-11-20T16:00:00Z" }), parte()],
    });
    await abrir(tarea());
    await fireEvent.press(screen.getByText("Ver partes de la tarea"));
    await screen.findByText("Dificultad · sin resolver");
    expect(screen.getByText("Camino cortado")).toBeTruthy();
    expect(screen.getByText("Avance")).toBeTruthy();
    expect(screen.getByText("Salimos hacia el paraje")).toBeTruthy();

    // Segunda apertura sin conexión: sale de la copia guardada.
    await fireEvent.press(screen.getByText("Ocultar partes"));
    mockPartes.mockRejectedValue(new ErrorApi(0, "sin_conexion", "Sin conexión"));
    await fireEvent.press(screen.getByText("Ver partes de la tarea"));
    await screen.findByText(/Sin conexión: se muestra lo último guardado/);
    expect(screen.getByText("Camino cortado")).toBeTruthy();
  });

  it("la copia del historial no usa la clave pública que sobrevive al cierre de sesión", async () => {
    mockPartes.mockResolvedValue({ items: [parte()] });
    await abrir(tarea());
    await fireEvent.press(screen.getByText("Ver partes de la tarea"));
    await screen.findByText("Salimos hacia el paraje");
    const claves = [...mockAlmacen.keys()].filter((k) => k.startsWith("partes:"));
    expect(claves).toHaveLength(1);
    expect(claves[0].startsWith(PREFIJO_CACHE_PUBLICA)).toBe(false);
  });
});

describe("novedad en Mis pedidos", () => {
  it.each([
    ["dificultad", "La cuadrilla informó una dificultad y el operador ya lo sabe"],
    ["demora", "La cuadrilla informó una demora"],
    ["parcial", "La tarea quedó a medias: el operador va a reprogramarla"],
    ["no_realizada", "La cuadrilla no pudo completar la tarea: el operador va a reprogramarla"],
    ["reprogramada", "La cuadrilla no pudo completar la tarea: el operador va a reprogramarla"],
  ])("%s", (tipo, texto) => {
    expect(textoNovedad({ tipo })).toBe(texto);
  });

  it("sin novedad o con un tipo desconocido no muestra nada", () => {
    expect(textoNovedad(null)).toBeNull();
    expect(textoNovedad(undefined)).toBeNull();
    expect(textoNovedad({ tipo: "otra" })).toBeNull();
  });

  it("la tarjeta del pedido muestra una sola línea, sin el texto de la observación", async () => {
    const pedido = {
      id: 12,
      tipo: "evacuacion",
      personas: 4,
      estado: "en_curso",
      origen: "app",
      creada_en: "2026-11-20T15:00:00Z",
      lat: null,
      lon: null,
      sector_id: "S4",
      linea_tiempo: [{ estado: "recibida", en: "2026-11-20T15:00:00Z" }],
      tarea: null,
      seguimiento: null,
      confirmacion: null,
      centro: null,
      novedad: { tipo: "dificultad", en: "2026-11-20T16:00:00Z" },
    } as unknown as PedidoCiudadano;
    mockMisPedidos.mockResolvedValue({ categoria: "SIMULADO", items: [pedido] });
    const Solicitudes = require("@/app/(app)/solicitudes").default;
    await render(conSafe(<Solicitudes />));
    await screen.findByText("La cuadrilla informó una dificultad y el operador ya lo sabe");
    expect(screen.getAllByText(/La cuadrilla informó/)).toHaveLength(1);
  });
});
