import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Image } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorApi } from "@/lib/api";
import { MAX_ADJUNTOS_PARTE, MAX_IMAGEN_BYTES, MAX_VIDEO_BYTES, validarAdjunto, type AdjuntoLocal } from "@/lib/adjuntos";
import { ColaOffline, RepositorioMemoria, esAvisoLeido, type DatosAvisoLeido, type DatosParte } from "@/lib/cola";
import { avisosNuevos, capasDeDesvio, contarSinLeer, ordenarAvisos, type AvisoCuadrilla } from "@/lib/cuadrillas";
import { armarParte } from "@/lib/partes";
import { PREFIJO_CACHE_PUBLICA } from "@/lib/cacheLocal";
import type { Tarea } from "@/lib/servicios";

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
const mockAvisos = jest.fn();
const mockCuadrilla = jest.fn();
jest.mock("@/lib/servicios", () => ({
  ...jest.requireActual("@/lib/servicios"),
  api: {
    tareas: (...a: unknown[]) => mockTareas(...a),
    avisosCuadrilla: (...a: unknown[]) => mockAvisos(...a),
    cuadrilla: (...a: unknown[]) => mockCuadrilla(...a),
    partesDeTarea: jest.fn(async () => ({ items: [] })),
    actualizarTarea: jest.fn(),
    solicitudes: jest.fn(),
  },
}));

const mockElegirAdjunto = jest.fn();
jest.mock("@/lib/dispositivo", () => ({
  ...jest.requireActual("@/lib/dispositivo"),
  elegirAdjunto: (...a: unknown[]) => mockElegirAdjunto(...a),
}));

jest.mock("@/components/SoloRol", () => ({ SoloRol: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("@/components/EnlaceBrujula", () => ({ EnlaceBrujula: () => null }));
jest.mock("@/lib/compartirPosicion", () => ({ useCompartirPosicion: () => ({ fase: "sin_tarea", pendiente: false }) }));
jest.mock("@/components/FormCierre", () => ({ FormCierre: () => null }));

type Instancia = { props: Record<string, any>; postMessage: jest.Mock };
const webview = require("react-native-webview") as { __ultima: () => Instancia; __reiniciar: () => void };
const enviadosAlMapa = (): { n: number; m: any }[] => webview.__ultima().postMessage.mock.calls.map((c) => JSON.parse(c[0]));
const paginaLista = () => act(() => webview.__ultima().props.onMessage({ nativeEvent: { data: JSON.stringify({ t: "listo" }) } }));

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
  cuadrilla_id: 2,
  ...extra,
});

const aviso = (extra: Partial<AvisoCuadrilla> = {}): AvisoCuadrilla => ({
  id: 1,
  cuadrilla_id: 2,
  tipo: "instruccion",
  texto: "Salir antes de las 14",
  items: null,
  geometria: null,
  tarea_id: null,
  creado_en: "2026-11-20T15:00:00Z",
  leido_en: null,
  leido_por_rol: null,
  ...extra,
});

const DESVIO = aviso({
  id: 2,
  tipo: "desvio",
  texto: "El puente está cortado: tomen el camino de ripio",
  geometria: {
    type: "LineString",
    coordinates: [
      [-58.17, -26.18],
      [-58.16, -26.17],
      [-58.15, -26.17],
    ],
  },
  creado_en: "2026-11-20T15:30:00Z",
});
const EQUIPO = aviso({ id: 3, tipo: "equipamiento", texto: "Cargar antes de salir", items: ["Ruedas de auxilio", "Palas", "Sogas"], creado_en: "2026-11-20T15:10:00Z" });
const LEIDO = aviso({ id: 4, tipo: "seguridad", texto: "Chalecos puestos en la zona anegada", leido_en: "2026-11-20T15:20:00Z", leido_por_rol: "defensa_civil", creado_en: "2026-11-20T16:00:00Z" });

const itemCola = (datos: DatosAvisoLeido | DatosParte, estado: "pendiente" | "rechazada" | "enviada" = "pendiente", extra: Record<string, unknown> = {}) => ({
  id: 60,
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
  webview.__reiniciar();
  mockAlmacen.clear();
  mockItems = [];
  mockEnviar.mockResolvedValue({ enviadaYa: true, fotoPendiente: false, rechazada: null, resultado: null, itemId: 60 });
  mockTareas.mockResolvedValue({ tareas: [tarea()] });
  mockAvisos.mockResolvedValue({ items: [LEIDO, EQUIPO, DESVIO, aviso()] });
  mockCuadrilla.mockResolvedValue({
    id: 2,
    nombre: "Cuadrilla Río Norte",
    tipo_operativo: "familias",
    cantidad_integrantes: 3,
    vehiculo: "4x4",
    equipamiento: ["Ruedas de auxilio", "Palas"],
    estado: "disponible",
    integrantes: [
      { id: 1, usuario_id: 7, rol_operativo: "defensa_civil", profesion: "medicina", es_encargado: false },
      { id: 2, usuario_id: 8, rol_operativo: "coordinador_sector", profesion: "logistica", es_encargado: true, nombre_visible: "Nombre Que No Debe Verse" },
    ],
    creado_en: "2026-11-20T10:00:00Z",
  });
});

describe("avisos: lógica pura", () => {
  it("ordena sin leer primero y, dentro de cada grupo, el más nuevo arriba", () => {
    const orden = ordenarAvisos([LEIDO, EQUIPO, DESVIO, aviso()]).map((a) => a.id);
    expect(orden).toEqual([2, 3, 1, 4]);
    // Una marca local pendiente de envío cuenta como leído.
    expect(ordenarAvisos([EQUIPO, DESVIO], new Set([2])).map((a) => a.id)).toEqual([3, 2]);
    expect(contarSinLeer([LEIDO, EQUIPO, DESVIO], new Set([3]))).toBe(1);
  });

  it("solo notifica los avisos nuevos sin leer", () => {
    expect(avisosNuevos(new Set([1, 3]), [aviso(), EQUIPO, DESVIO, LEIDO]).map((a) => a.id)).toEqual([2]);
  });

  it("el desvío se convierte en una línea con inicio y fin; una geometría rota se descarta", () => {
    const c = capasDeDesvio(DESVIO);
    expect(c.lineas).toHaveLength(1);
    expect(c.lineas[0].coordenadas).toHaveLength(3);
    expect(c.puntos.map((p) => p.forma)).toEqual(["circulo", "cuadrado"]);
    expect(c.encuadre).toHaveLength(3);
    expect(capasDeDesvio({ id: 5, geometria: { type: "LineString", coordinates: [[1, 2]] } }).lineas).toHaveLength(0);
    expect(capasDeDesvio({ id: 5, geometria: { type: "LineString", coordinates: [[999, 2], [1, 2]] } }).lineas).toHaveLength(0);
    expect(capasDeDesvio({ id: 5, geometria: { type: "Point", coordinates: [-58.1, -26.1] } }).puntos).toHaveLength(1);
    expect(capasDeDesvio({ id: 5, geometria: null })).toEqual({ lineas: [], puntos: [], encuadre: [] });
  });
});

describe("pantalla de la cuadrilla: avisos del operativo", () => {
  const abrir = async () => {
    const Cuadrilla = require("@/app/(app)/cuadrilla").default;
    await render(conSafe(<Cuadrilla />));
    await screen.findByText("Evacuar familia del paraje");
  };

  it("muestra los avisos arriba, sin leer primero, con el contador", async () => {
    await abrir();
    await screen.findByText("Tenés 3 avisos sin leer del operativo.");
    const textos = screen.getAllByRole("header").map((h) => h.props.children);
    // Desvío (más nuevo sin leer), Qué llevar, Instrucción, y recién después el aviso leído.
    const orden = ["Desvío", "Qué llevar", "Instrucción", "Seguridad"].map((t) => textos.indexOf(t));
    expect(orden.every((i) => i >= 0)).toBe(true);
    expect([...orden].sort((a, b) => a - b)).toEqual(orden);
    expect(screen.getAllByText("Marcar como leído")).toHaveLength(3);
  });

  it("«Marcar como leído» entra en la cola (sin señal queda pendiente) y el aviso pasa a leído", async () => {
    mockEnviar.mockResolvedValue({ enviadaYa: false, fotoPendiente: false, rechazada: null, resultado: null, itemId: 60 });
    await abrir();
    await screen.findByText("Salir antes de las 14");
    // El del medio de la lista es la instrucción: se busca su botón por la posición entre las sin leer.
    const botones = screen.getAllByText("Marcar como leído");
    await fireEvent.press(botones[2]);
    await waitFor(() => expect(mockEnviar).toHaveBeenCalledWith({ clase: "aviso_leido", aviso_id: 1, cuadrilla_id: 2 }, null));
  });

  it("una marca pendiente en la cola cuenta como leída y avisa que se enviará", async () => {
    mockItems = [itemCola({ clase: "aviso_leido", aviso_id: 1, cuadrilla_id: 2 })];
    await abrir();
    await screen.findByText("Tenés 2 avisos sin leer del operativo.");
    expect(screen.getByText(/Marcado como leído en este teléfono/)).toBeTruthy();
  });

  it("el desvío se dibuja en el mapa abierto: manda la línea y los puntos al WebView", async () => {
    await abrir();
    await fireEvent.press(await screen.findByText("Ver el desvío en el mapa"));
    await paginaLista();
    const capas = enviadosAlMapa().filter((e) => e.m.t === "capas").pop()!.m;
    expect(capas.lineas).toHaveLength(1);
    expect(capas.lineas[0].coordenadas).toEqual([
      [-58.17, -26.18],
      [-58.16, -26.17],
      [-58.15, -26.17],
    ]);
    expect(capas.puntos).toHaveLength(2);
    const encuadre = enviadosAlMapa().find((e) => e.m.t === "encuadre")!.m;
    expect(encuadre.puntos).toHaveLength(3);
    expect(screen.getByText(/Desvío marcado en el mapa: recorrido de 3 puntos/)).toBeTruthy();
  });

  it("sin conexión muestra la última copia guardada con su fecha", async () => {
    const Cuadrilla = require("@/app/(app)/cuadrilla").default;
    // Lo que quedó guardado de una apertura anterior con red (las claves son personales, no públicas).
    const { claveAvisos, claveIdCuadrilla } = require("@/lib/useCuadrilla");
    expect(claveAvisos(7, 2).startsWith(PREFIJO_CACHE_PUBLICA)).toBe(false);
    mockAlmacen.set(claveAvisos(7, 2), { valor: [aviso()], guardadoEn: Date.parse("2026-11-20T18:00:00Z") });
    mockAlmacen.set(claveIdCuadrilla(7), { valor: 2, guardadoEn: 1 });

    mockAvisos.mockRejectedValue(new ErrorApi(0, "sin_conexion", "Sin conexión"));
    mockTareas.mockRejectedValue(new ErrorApi(0, "sin_conexion", "Sin conexión"));
    await render(conSafe(<Cuadrilla />));
    await screen.findByText(/Sin conexión: se muestra lo último guardado, actualizado el/);
    expect(screen.getByText("Salir antes de las 14")).toBeTruthy();
  });

  it("«Mi cuadrilla» muestra la función propia y el encargado por rol, sin nombres", async () => {
    await abrir();
    await screen.findByText("Cuadrilla Río Norte");
    expect(screen.getByText("Tu función: Defensa civil · Medicina.")).toBeTruthy();
    expect(screen.getByText("Encargado: Coordinador sector · Logística.")).toBeTruthy();
    expect(screen.getByText("Camioneta 4x4")).toBeTruthy();
    expect(screen.getByText("Evacuación de familias")).toBeTruthy();
    expect(screen.getAllByText("Ruedas de auxilio").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Nombre Que No Debe Verse/)).toBeNull();
  });

  it("sin cuadrilla en las tareas ni copia guardada no muestra avisos", async () => {
    mockTareas.mockResolvedValue({ tareas: [tarea({ cuadrilla_id: null })] });
    await abrir();
    expect(mockAvisos).not.toHaveBeenCalled();
    expect(screen.queryByText("Avisos del operativo")).toBeNull();
  });
});

describe("«qué llevar»: tildado persistente", () => {
  const { ChecklistEquipo } = require("@/components/AvisosOperativo") as typeof import("@/components/AvisosOperativo");

  it("tilda un ítem, lo guarda en el teléfono y lo recupera al volver a montar", async () => {
    const primera = await render(<ChecklistEquipo aviso={EQUIPO} />);
    expect(screen.getByText("Qué llevar: 0 de 3 cargados")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Palas"));
    await screen.findByText("Qué llevar: 1 de 3 cargados");
    const clave = [...mockAlmacen.keys()].find((k) => k.startsWith("equipo:7:"));
    expect(clave).toBeDefined();
    expect(clave!.startsWith(PREFIJO_CACHE_PUBLICA)).toBe(false);
    expect(mockAlmacen.get(clave!)!.valor).toEqual(["Palas"]);
    await primera.unmount();

    await render(<ChecklistEquipo aviso={EQUIPO} />);
    await screen.findByText("Qué llevar: 1 de 3 cargados");
    expect(screen.getByLabelText("Palas").props.accessibilityState.checked).toBe(true);
    await fireEvent.press(screen.getByLabelText("Palas"));
    await screen.findByText("Qué llevar: 0 de 3 cargados");
    expect(mockAlmacen.get(clave!)!.valor).toEqual([]);
  });
});

describe("cola: aviso leído sin señal", () => {
  it("queda pendiente sin red y al volver hace POST /avisos/{id}/leido; un 409 cuenta como hecho", async () => {
    const { enviarItem } = jest.requireActual<typeof import("@/lib/servicios")>("@/lib/servicios");
    mockPeticion.mockResolvedValue({ leido_en: "2026-11-20T17:00:00Z" });
    const red = { hay: false };
    const cola = new ColaOffline({ repo: new RepositorioMemoria(), hayRed: async () => red.hay, enviar: enviarItem, subirFoto: async () => ({ ok: true }) });
    const datos: DatosAvisoLeido = { clase: "aviso_leido", aviso_id: 5, cuadrilla_id: 2 };
    expect(esAvisoLeido(datos)).toBe(true);
    await cola.encolar(7, datos, null);

    expect(await cola.vaciar(7)).toMatchObject({ sinRed: true, pendientes: 1 });
    expect(mockPeticion).not.toHaveBeenCalled();

    red.hay = true;
    expect(await cola.vaciar(7)).toMatchObject({ enviadas: 1, pendientes: 0 });
    expect(mockPeticion).toHaveBeenCalledWith("/avisos/5/leido", { metodo: "POST" });

    mockPeticion.mockRejectedValueOnce(new ErrorApi(409, "conflicto", "Ya estaba leído"));
    await cola.encolar(7, { clase: "aviso_leido", aviso_id: 6 }, null);
    expect(await cola.vaciar(7, true)).toMatchObject({ enviadas: 1, rechazadas: 0 });
  });
});

describe("evidencia en los partes", () => {
  const imagen = (n: number, bytes: number | null = 100_000): AdjuntoLocal => ({ uri: `file:///foto${n}.jpg`, tipo: "imagen", mime: "image/jpeg", bytes });
  const video = (bytes: number | null = 3_000_000): AdjuntoLocal => ({ uri: "file:///clip.mp4", tipo: "video", mime: "video/mp4", bytes });

  it("límites: imagen JPEG/PNG/WebP hasta 5 MB, video MP4 hasta 20 MB, máximo 5 por parte", () => {
    expect(validarAdjunto(imagen(1), 0)).toEqual({ ok: true });
    expect(validarAdjunto(imagen(1, MAX_IMAGEN_BYTES), 0).ok).toBe(true);
    expect(validarAdjunto(imagen(1, MAX_IMAGEN_BYTES + 1), 0)).toMatchObject({ ok: false });
    expect(validarAdjunto({ ...imagen(1), mime: "image/gif" }, 0)).toMatchObject({ ok: false, mensaje: expect.stringMatching(/JPEG, PNG o WebP/) });
    expect(validarAdjunto(video(MAX_VIDEO_BYTES), 0).ok).toBe(true);
    expect(validarAdjunto(video(MAX_VIDEO_BYTES + 1), 0)).toMatchObject({ ok: false, mensaje: expect.stringMatching(/20,0 MB/) });
    expect(validarAdjunto({ ...video(), mime: "video/quicktime" }, 0)).toMatchObject({ ok: false, mensaje: expect.stringMatching(/MP4/) });
    expect(validarAdjunto(imagen(1, null), 0).ok).toBe(true); // tamaño desconocido: valida el servidor
    expect(validarAdjunto(imagen(1), MAX_ADJUNTOS_PARTE)).toMatchObject({ ok: false, mensaje: expect.stringMatching(/hasta 5 archivos/) });
  });

  it("armarParte incluye los adjuntos solo si hay y rechaza más de 5", () => {
    const base = { tareaId: 9, tipo: "avance" as const, resultado: null, observacion: "" };
    expect(armarParte(base)).toEqual({ ok: true, datos: { clase: "parte", tarea_id: 9, tipo: "avance" } });
    const con = armarParte({ ...base, adjuntos: [imagen(1), video()] });
    expect(con.ok && con.datos.adjuntos).toHaveLength(2);
    expect(armarParte({ ...base, adjuntos: [1, 2, 3, 4, 5, 6].map((n) => imagen(n)) })).toMatchObject({ ok: false });
  });

  it("dos tiempos: primero el parte y después cada archivo; sin red no sube nada y un corte no repite el parte", async () => {
    const { enviarItem, subirFotoItem } = jest.requireActual<typeof import("@/lib/servicios")>("@/lib/servicios");
    mockPeticion.mockImplementation(async (ruta: string) => (ruta === "/tareas/9/partes" ? { id: 31 } : {}));
    // Los archivos siguen en el teléfono (si no, un corte de red se tomaría por archivo perdido).
    jest.spyOn(Image, "getSize").mockImplementation(((_u: string, ok: (w: number, h: number) => void) => ok(1, 1)) as never);
    const red = { hay: false };
    const cola = new ColaOffline({ repo: new RepositorioMemoria(), hayRed: async () => red.hay, enviar: enviarItem, subirFoto: subirFotoItem, generarClave: () => "clave" });
    const r = armarParte({ tareaId: 9, tipo: "dificultad", resultado: null, observacion: "Camino cortado", adjuntos: [imagen(1), video()] });
    if (!r.ok) throw new Error("debería ser válido");
    await cola.encolar(7, r.datos, null);

    expect(await cola.vaciar(7)).toMatchObject({ sinRed: true, pendientes: 1 });
    expect(mockPeticion).not.toHaveBeenCalled();

    // Vuelve la red, el parte llega y la subida del primer archivo falla por red: queda pendiente con el parte ya enviado.
    red.hay = true;
    mockPeticion.mockImplementation(async (ruta: string) => {
      if (ruta === "/tareas/9/partes") return { id: 31 };
      throw new ErrorApi(0, "sin_conexion", "Sin conexión");
    });
    expect(await cola.vaciar(7, true)).toMatchObject({ enviadas: 0, pendientes: 1 });
    const [pend] = await cola.listar(7);
    expect(pend).toMatchObject({ estado: "pendiente", servidorId: 31 });

    // Reintento: no se vuelve a crear el parte; se suben las dos evidencias a /tareas/9/partes/31/adjuntos.
    mockPeticion.mockClear();
    mockPeticion.mockResolvedValue({});
    const anexados: unknown[] = [];
    jest.spyOn(FormData.prototype, "append").mockImplementation(((_k: string, v: unknown) => void anexados.push(v)) as never);
    expect(await cola.vaciar(7, true)).toMatchObject({ enviadas: 1, pendientes: 0 });
    const rutas = mockPeticion.mock.calls.map((c) => c[0]);
    expect(rutas).toEqual(["/tareas/9/partes/31/adjuntos", "/tareas/9/partes/31/adjuntos"]);
    expect(anexados).toEqual([
      { uri: "file:///foto1.jpg", name: "evidencia.jpg", type: "image/jpeg" },
      { uri: "file:///clip.mp4", name: "evidencia.mp4", type: "video/mp4" },
    ]);
    const [fin] = await cola.listar(7);
    expect(fin.datos).toMatchObject({ adjuntos: [] });
  });

  it("un archivo que el servidor rechaza no bloquea la cola y se informa", async () => {
    const { enviarItem, subirFotoItem } = jest.requireActual<typeof import("@/lib/servicios")>("@/lib/servicios");
    mockPeticion.mockImplementation(async (ruta: string) => {
      if (ruta === "/tareas/9/partes") return { id: 31 };
      throw new ErrorApi(422, "validacion", "Tipo de archivo no permitido");
    });
    const cola = new ColaOffline({ repo: new RepositorioMemoria(), hayRed: async () => true, enviar: enviarItem, subirFoto: subirFotoItem });
    await cola.encolar(7, { clase: "parte", tarea_id: 9, tipo: "avance", adjuntos: [imagen(1)] }, null);
    expect(await cola.vaciar(7)).toMatchObject({ enviadas: 1, pendientes: 0 });
    const [item] = await cola.listar(7);
    expect(item.ultimoError).toBe("El parte se envió, pero el servidor no aceptó el archivo: Tipo de archivo no permitido");
  });

  describe("formulario del parte", () => {
    const abrirForm = async () => {
      const { FormParte } = require("@/components/FormParte");
      await render(<FormParte tareaId={9} tipo="avance" alEnviado={jest.fn()} alCerrar={jest.fn()} alPedirConstancia={jest.fn()} />);
    };

    it("agrega fotos y video, rechaza un video de más de 20 MB y manda los adjuntos con el parte", async () => {
      await abrirForm();
      mockElegirAdjunto.mockResolvedValueOnce({ ok: true, adjunto: video(MAX_VIDEO_BYTES + 5) });
      await fireEvent.press(screen.getByText("Sacar foto o video"));
      await screen.findByText(/El video pesa .* el máximo es 20,0 MB/);
      expect(screen.getByText(/fotos o videos \(0 de 5\)/)).toBeTruthy();

      mockElegirAdjunto.mockResolvedValueOnce({ ok: true, adjunto: imagen(1) });
      await fireEvent.press(screen.getByText("Elegir de la galería"));
      mockElegirAdjunto.mockResolvedValueOnce({ ok: true, adjunto: video() });
      await screen.findByText("Foto 1 · 98 KB");
      await fireEvent.press(screen.getByText("Sacar foto o video"));
      await screen.findByText("Video 2 · 2,9 MB");
      expect(screen.getByText(/fotos o videos \(2 de 5\)/)).toBeTruthy();

      await fireEvent.press(screen.getByText("Enviar parte"));
      await waitFor(() =>
        expect(mockEnviar).toHaveBeenCalledWith({ clase: "parte", tarea_id: 9, tipo: "avance", adjuntos: [imagen(1), video()] }, null),
      );
    });

    it("al llegar a 5 archivos ya no ofrece agregar más y se puede quitar uno", async () => {
      await abrirForm();
      for (let n = 1; n <= 5; n++) {
        mockElegirAdjunto.mockResolvedValueOnce({ ok: true, adjunto: imagen(n) });
        await fireEvent.press(screen.getByText("Elegir de la galería"));
        await screen.findByText(new RegExp(`fotos o videos \\(${n} de 5\\)`));
      }
      expect(screen.queryByText("Elegir de la galería")).toBeNull();
      await fireEvent.press(screen.getByText("Quitar foto 5"));
      await screen.findByText(/fotos o videos \(4 de 5\)/);
      expect(screen.getByText("Elegir de la galería")).toBeTruthy();
    });

    it("sin permiso de cámara lo dice y no agrega nada", async () => {
      await abrirForm();
      mockElegirAdjunto.mockResolvedValueOnce({ ok: false, motivo: "permiso" });
      await fireEvent.press(screen.getByText("Sacar foto o video"));
      await screen.findByText(/Sin permiso de cámara/);
    });

    it("si el parte llegó y los archivos esperan, lo dice", async () => {
      mockEnviar.mockResolvedValue({ enviadaYa: false, fotoPendiente: true, rechazada: null, resultado: null, itemId: 60 });
      await abrirForm();
      await fireEvent.press(screen.getByText("Enviar parte"));
      await screen.findByText(/El parte ya llegó\. Las fotos y los videos esperan su turno/);
    });
  });
});
