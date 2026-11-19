import { LEYENDA } from "@evacuaciones/shared";
import { render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { MarcoApp } from "@/components/MarcoApp";
import { EnPestanasContext, Pantalla } from "@/components/ui";
import { ANCHO_MAX, calcularDiseno, fuenteAcotada, TOQUE_MIN } from "@/lib/responsive";

// --- Dimensiones de ventana simuladas -------------------------------------------------------
type Dim = { width: number; height: number; fontScale: number; scale: number };
let mockDim: Dim = { width: 360, height: 640, fontScale: 1, scale: 2 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockDim,
}));

jest.mock("expo-router", () => ({
  Redirect: () => null,
  useRouter: () => ({ push: jest.fn() }),
  Tabs: () => null,
  Stack: () => null,
}));

let mockRol = "ciudadano";
const mockUsuario = () => ({
  id: 1,
  email: "demo@ejemplo.test",
  nombre_visible: "Demo",
  rol: mockRol,
  rol_operativo: null,
  estado: "activo",
});
jest.mock("@/lib/SesionContext", () => ({
  ...jest.requireActual("@/lib/SesionContext"),
  useSesion: () => ({
    estado: mockRol === "anonimo" ? { tipo: "anonimo" } : { tipo: "autenticado", usuario: mockUsuario() },
    entrar: jest.fn(),
    salir: jest.fn(),
    salirLocal: jest.fn(),
  }),
  useUsuario: () => mockUsuario(),
}));

jest.mock("@/lib/ColaContext", () => ({
  useCola: () => ({
    items: [],
    pendientes: 0,
    otroServidor: [],
    sinRed: false,
    enviar: jest.fn(),
    reintentar: jest.fn(),
    descartar: jest.fn(),
    borrarLocal: jest.fn(),
  }),
}));

const notificacion = (id: number) => ({
  id,
  orden_id: id,
  mensaje: `Orden de prueba ${id}`,
  leida: false,
  creada_en: "2026-11-18T10:00:00Z",
});
jest.mock("@/lib/AlertasContext", () => ({
  ...jest.requireActual("@/lib/AlertasContext"),
  useAlertas: () => ({
    estado: { tipo: "ok" },
    notificaciones: [notificacion(1), notificacion(2), notificacion(3)],
    noLeidas: 3,
    canal: "conectado",
    recargar: jest.fn(),
    marcarLeida: jest.fn(),
  }),
}));

jest.mock("@/lib/dispositivo", () => ({
  obtenerUbicacion: jest.fn(),
  tomarFotoComprimida: jest.fn(),
}));

const sectorDemo = {
  sectores: [
    {
      id: "S4",
      nombre: "Sector Rural Este",
      estado: "en_riesgo",
      aislado: false,
      altura_compromiso_m: 7.5,
      margen_a_compromiso_m: 1.9,
      accesos: [],
      alertas: [],
      categoria: "SIMULADO",
      fuente: "K10",
      geometria: { type: "Polygon", coordinates: [[[-58.15, -26.19], [-58.13, -26.19], [-58.13, -26.17], [-58.15, -26.19]]] },
    },
  ],
  altura_referencia: { altura_m: 5.6, fecha: "2026-10-31", categoria: "DATO OBSERVADO", fuente: "K1" },
  centro_asignado: null,
  nota: "Nota de prueba",
};
jest.mock("@/lib/servicios", () => ({
  ...jest.requireActual("@/lib/servicios"),
  api: {
    solicitudes: jest.fn(async () => ({ solicitudes: [] })),
    miSector: jest.fn(async () => sectorDemo),
    tareas: jest.fn(async () => ({ tareas: [] })),
    grupo: jest.fn(async () => {
      throw new (jest.requireActual("@/lib/api").ErrorApi)(404, "no_encontrado", "sin grupo");
    }),
    establecimientos: jest.fn(async () => ({ establecimientos: [] })),
  },
}));

// --- Utilidades -------------------------------------------------------------------------------
function enMarco(hijo: React.ReactNode, d: Dim) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: d.width, height: d.height },
        insets: { top: 24, left: 0, right: 0, bottom: 16 },
      }}
    >
      <MarcoApp>{hijo}</MarcoApp>
    </SafeAreaProvider>
  );
}

/** Recorre el árbol renderizado y junta todos los valores de una propiedad de estilo. */
function valoresDeEstilo(propiedad: string): unknown[] {
  const salida: unknown[] = [];
  const visitar = (nodo: unknown) => {
    if (!nodo || typeof nodo !== "object") return;
    const n = nodo as { props?: { style?: unknown; contentContainerStyle?: unknown }; children?: unknown[] };
    const aplanar = (e: unknown): void => {
      if (Array.isArray(e)) e.forEach(aplanar);
      else if (e && typeof e === "object" && propiedad in (e as object)) salida.push((e as Record<string, unknown>)[propiedad]);
    };
    aplanar(n.props?.style);
    aplanar(n.props?.contentContainerStyle);
    (n.children ?? []).forEach(visitar);
  };
  const arbol = screen.toJSON() as unknown;
  (Array.isArray(arbol) ? arbol : [arbol]).forEach(visitar);
  return salida;
}

/** Estilo del contenido del ScrollView de la pantalla (tiene maxWidth). */
function estiloContenido(): Record<string, unknown> | null {
  const visitar = (nodo: unknown): Record<string, unknown> | null => {
    if (!nodo || typeof nodo !== "object") return null;
    const n = nodo as { props?: { style?: unknown; contentContainerStyle?: unknown }; children?: unknown[] };
    const plano: Record<string, unknown> = {};
    const aplanar = (e: unknown): void => {
      if (Array.isArray(e)) e.forEach(aplanar);
      else if (e && typeof e === "object") Object.assign(plano, e);
    };
    aplanar(n.props?.style);
    aplanar(n.props?.contentContainerStyle);
    if ("maxWidth" in plano) return plano;
    for (const h of n.children ?? []) {
      const r = visitar(h);
      if (r) return r;
    }
    return null;
  };
  const arbol = screen.toJSON() as unknown;
  for (const a of Array.isArray(arbol) ? arbol : [arbol]) {
    const r = visitar(a);
    if (r) return r;
  }
  return null;
}

const CHICO: Dim = { width: 320, height: 568, fontScale: 2, scale: 1.5 };
const TABLET_APAISADA: Dim = { width: 1024, height: 768, fontScale: 1, scale: 2 };
const TELEFONO_APAISADO: Dim = { width: 844, height: 390, fontScale: 1.3, scale: 3 };

type Caso = { nombre: string; rol: string; cargar: () => React.ComponentType; principal: string | RegExp };
const PANTALLAS: Caso[] = [
  { nombre: "bienvenida", rol: "anonimo", cargar: () => require("@/app/index").default, principal: "Ingresar" },
  { nombre: "login", rol: "anonimo", cargar: () => require("@/app/login").default, principal: "Ingresar" },
  { nombre: "registro", rol: "anonimo", cargar: () => require("@/app/registro").default, principal: "Crear cuenta" },
  { nombre: "asistencia", rol: "ciudadano", cargar: () => require("@/app/(app)/asistencia").default, principal: "Enviar solicitud" },
  { nombre: "solicitudes", rol: "ciudadano", cargar: () => require("@/app/(app)/solicitudes").default, principal: "Actualizar" },
  { nombre: "alertas", rol: "ciudadano", cargar: () => require("@/app/(app)/alertas").default, principal: "Alertas y órdenes" },
  { nombre: "sector", rol: "ciudadano", cargar: () => require("@/app/(app)/sector").default, principal: "Actualizar" },
  { nombre: "perfil", rol: "ciudadano", cargar: () => require("@/app/(app)/perfil").default, principal: "Cerrar sesión" },
  { nombre: "cuadrilla", rol: "cuadrilla", cargar: () => require("@/app/(app)/cuadrilla").default, principal: "Actualizar" },
];

beforeEach(() => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ estado: "ok", servicio: "x", version: "1", base_de_datos: "ok" }),
  }) as unknown as typeof fetch;
});

// --- Kit de diseño (puro) -----------------------------------------------------------------
describe("calcularDiseno", () => {
  it("clasifica los dispositivos por ancho y lado corto", () => {
    expect(calcularDiseno(320, 568, 1).clase).toBe("compacto");
    expect(calcularDiseno(360, 640, 1).clase).toBe("normal");
    expect(calcularDiseno(390, 844, 1).clase).toBe("normal");
    expect(calcularDiseno(412, 915, 1).clase).toBe("normal");
    expect(calcularDiseno(600, 960, 1).clase).toBe("tablet");
    // Un teléfono apaisado no es una tablet aunque su ancho supere 840 dp.
    const apaisado = calcularDiseno(915, 412, 1);
    expect(apaisado.clase).toBe("normal");
    expect(apaisado.apaisado).toBe(true);
    expect(apaisado.columnas).toBe(1);
  });

  it("usa una columna hasta 840 dp y dos columnas en tablet ancha", () => {
    expect(calcularDiseno(600, 960, 1).columnas).toBe(1);
    expect(calcularDiseno(800, 1280, 1).columnas).toBe(1);
    expect(calcularDiseno(1024, 768, 1).columnas).toBe(2);
    expect(calcularDiseno(1280, 800, 1).columnas).toBe(2);
  });

  it("limita el ancho del contenido y descuenta márgenes e insets", () => {
    expect(calcularDiseno(320, 568, 1).anchoContenido).toBe(320 - 24);
    expect(calcularDiseno(800, 1280, 1).anchoContenido).toBe(ANCHO_MAX.una);
    expect(calcularDiseno(1280, 800, 1).anchoContenido).toBe(ANCHO_MAX.dos);
    const conRecorte = calcularDiseno(844, 390, 1, { top: 0, bottom: 0, left: 48, right: 48 });
    expect(conRecorte.anchoContenido).toBe(ANCHO_MAX.una);
    expect(calcularDiseno(360, 640, 1, { top: 0, bottom: 0, left: 30, right: 30 }).anchoContenido).toBe(360 - 60 - 32);
  });

  it("separa más los bloques con fuente grande, con tope", () => {
    expect(calcularDiseno(360, 640, 1).paso).toBe(14);
    expect(calcularDiseno(360, 640, 2).paso).toBe(21);
    expect(calcularDiseno(360, 640, 3).paso).toBe(21);
  });

  it("acota la fuente de elementos de alto fijo sin desactivar la escala", () => {
    expect(fuenteAcotada(11, 1, 1.3)).toBe(11);
    expect(Math.abs(fuenteAcotada(11, 1.15, 1.3) - 12.65)).toBeLessThanOrEqual(0.1);
    expect(fuenteAcotada(11, 2, 1.3)).toBe(14.3);
    expect(fuenteAcotada(11, 0.8, 1.3)).toBe(11);
  });

  it("el mapa tiene un alto razonable en cada formato", () => {
    for (const [w, h] of [[320, 568], [360, 640], [412, 915], [844, 390], [1024, 768], [600, 960]] as const) {
      const alto = calcularDiseno(w, h, 1).altoMapa;
      expect(alto).toBeGreaterThanOrEqual(200);
      expect(alto).toBeLessThanOrEqual(440);
    }
  });
});

// --- Pantalla (contenedor) --------------------------------------------------------------------
describe("Pantalla", () => {
  const Cuerpo = () => (
    <Pantalla>
      <></>
    </Pantalla>
  );

  it("suma la zona segura inferior fuera de la barra de pestañas y no dentro", async () => {
    mockDim = { width: 360, height: 640, fontScale: 1, scale: 2 };
    const { unmount } = await render(enMarco(<Cuerpo />, mockDim));
    expect(estiloContenido()?.paddingBottom).toBe(16 + 16);
    await unmount();

    await render(
      enMarco(
        <EnPestanasContext.Provider value>
          <Cuerpo />
        </EnPestanasContext.Provider>,
        mockDim,
      ),
    );
    expect(estiloContenido()?.paddingBottom).toBe(16);
  });

  it("centra el contenido con ancho máximo en una tablet", async () => {
    mockDim = { width: 800, height: 1280, fontScale: 1, scale: 2 };
    await render(enMarco(<Cuerpo />, mockDim));
    const e = estiloContenido();
    expect(e?.maxWidth).toBe(ANCHO_MAX.una + 24 * 2);
    expect(e?.alignSelf).toBe("center");
  });
});

// --- Pantallas en los casos extremos ----------------------------------------------------------
describe.each(PANTALLAS)("$nombre", ({ rol, cargar, principal }) => {
  const mostrar = async (dim: Dim) => {
    mockDim = dim;
    mockRol = rol;
    const Pantalla = cargar();
    await render(enMarco(<Pantalla />, dim));
  };

  it("en un teléfono chico (320x568) con fuente al 200% mantiene leyenda y acción principal", async () => {
    await mostrar(CHICO);
    expect(screen.getByText(LEYENDA)).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText(principal).length).toBeGreaterThan(0));
    // La leyenda acota su fuente para no comerse la pantalla.
    expect(screen.getByText(LEYENDA).props.maxFontSizeMultiplier).toBe(1.5);
    // El contenido nunca supera el ancho de la ventana.
    const e = estiloContenido();
    if (e) expect(e.maxWidth).toBeGreaterThanOrEqual(CHICO.width);
  });

  it("en una tablet apaisada (1024x768) mantiene leyenda y acción principal", async () => {
    await mostrar(TABLET_APAISADA);
    expect(screen.getByText(LEYENDA)).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText(principal).length).toBeGreaterThan(0));
  });

  it("en un teléfono apaisado (844x390, fuente 130%) mantiene leyenda y acción principal", async () => {
    await mostrar(TELEFONO_APAISADO);
    expect(screen.getByText(LEYENDA)).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText(principal).length).toBeGreaterThan(0));
  });
});

// --- Diseño de tablet donde se implementó dos columnas --------------------------------------
describe("tablet: ancho máximo y dos columnas", () => {
  it("las alertas usan una columna a todo el ancho en teléfono y dos en tablet ancha", async () => {
    mockRol = "ciudadano";
    const Alertas = require("@/app/(app)/alertas").default;

    mockDim = { width: 360, height: 640, fontScale: 1, scale: 2 };
    const { unmount } = await render(enMarco(<Alertas />, mockDim));
    expect(valoresDeEstilo("width").filter((w) => w === "100%").length).toBeGreaterThanOrEqual(3);
    expect(estiloContenido()?.maxWidth).toBe(ANCHO_MAX.una + 16 * 2);
    await unmount();

    mockDim = TABLET_APAISADA;
    await render(enMarco(<Alertas />, mockDim));
    const columna = Math.floor((ANCHO_MAX.dos - 14) / 2);
    expect(valoresDeEstilo("width").filter((w) => w === columna).length).toBe(3);
    expect(estiloContenido()?.maxWidth).toBe(ANCHO_MAX.dos + 24 * 2);
  });

  it("una tablet en vertical (800x1280) sigue en una columna de 640 dp", async () => {
    mockRol = "ciudadano";
    mockDim = { width: 800, height: 1280, fontScale: 1, scale: 2 };
    const Alertas = require("@/app/(app)/alertas").default;
    await render(enMarco(<Alertas />, mockDim));
    expect(valoresDeEstilo("width").filter((w) => typeof w === "number" && w > 300 && w < 700)).toHaveLength(0);
    expect(estiloContenido()?.maxWidth).toBe(ANCHO_MAX.una + 24 * 2);
  });

  it("el perfil coloca el servidor junto a los formularios en tablet ancha", async () => {
    mockRol = "ciudadano";
    mockDim = TABLET_APAISADA;
    const Perfil = require("@/app/(app)/perfil").default;
    await render(enMarco(<Perfil />, mockDim));
    await waitFor(() => expect(screen.getAllByText("Guardar").length).toBeGreaterThan(0));
    const columna = Math.floor((ANCHO_MAX.dos - 14) / 2);
    expect(valoresDeEstilo("width").filter((w) => w === columna).length).toBeGreaterThanOrEqual(2);
  });

  it("el sector muestra mapa y detalle lado a lado en tablet ancha", async () => {
    mockRol = "ciudadano";
    mockDim = TABLET_APAISADA;
    const Sector = require("@/app/(app)/sector").default;
    await render(enMarco(<Sector />, mockDim));
    await waitFor(() => expect(screen.getByText("Actualizar")).toBeTruthy());
    expect(screen.getByLabelText("Mapa del sector")).toBeTruthy();
    expect(valoresDeEstilo("flexDirection")).toContain("row");
  });
});

// --- Toques y legibilidad ---------------------------------------------------------------------
describe("elementos táctiles", () => {
  it("los botones y campos miden al menos 48 dp", async () => {
    mockRol = "anonimo";
    mockDim = CHICO;
    const Login = require("@/app/login").default;
    await render(enMarco(<Login />, mockDim));
    const alturas = valoresDeEstilo("minHeight");
    expect(TOQUE_MIN).toBe(48);
    expect(alturas.filter((h) => h === TOQUE_MIN).length).toBeGreaterThanOrEqual(3);
  });
});
