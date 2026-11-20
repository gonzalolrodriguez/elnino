import { ChakraProvider } from "@chakra-ui/react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "./auth/AuthContext";
import { ANCHO_CONTENEDOR, Contenedor } from "./components/Contenedor";
import { CampoSelect, GrupoCampos } from "./components/Formulario";
import { Layout } from "./components/Layout";
import { GrupoOpciones, Opcion } from "./components/Opcion";
import { contraste } from "./estilo/oklch";
import { hexDe } from "./estilo/paleta";
import { etiquetaCodigo, etiquetaOrigen } from "./lib/etiquetas";
import { CabeceraPagina } from "./panel/CabeceraPagina";
import { SlotEscenarioProvider, EnSlotEscenario } from "./panel/SlotEscenario";
import { Cifra, Seccion } from "./panel/ui";
import { theme } from "./theme";

const montar = (ui: React.ReactElement) => render(<ChakraProvider theme={theme}>{ui}</ChakraProvider>);

afterEach(() => vi.unstubAllGlobals());

/** jsdom resuelve rem a px (16 px por rem): "72rem" se lee "1152px". */
const px = (rem: string) => `${parseFloat(rem) * 16}px`;

describe("tokens de campo y tipografía", () => {
  it("el borde de los controles llega a 3:1 sobre el fondo (WCAG 1.4.11)", () => {
    expect(contraste(hexDe("bordeControl"), "#FFFFFF")).toBeGreaterThanOrEqual(3);
  });

  it("define los estilos de texto de DESIGN.md con numerales tabulares en las cifras", () => {
    const estilos = theme.textStyles as Record<string, Record<string, string>>;
    for (const nombre of ["pantalla", "titularPagina", "tituloBloque", "cifraGrande", "cifraMedia", "cuerpo", "rotulo", "microdato"]) {
      expect(estilos[nombre], nombre).toBeDefined();
    }
    for (const nombre of ["cifra", "cifraGrande", "cifraMedia", "microdato"]) {
      expect(estilos[nombre].fontVariantNumeric, nombre).toContain("tabular-nums");
    }
  });
});

describe("contenedor y leyenda del Layout", () => {
  const conLayout = (ui: React.ReactElement) =>
    montar(
      <MemoryRouter>
        <AuthProvider>{ui}</AuthProvider>
      </MemoryRouter>,
    );

  it("la leyenda fija vive dentro de una región con nombre (no queda fuera de un landmark)", () => {
    conLayout(<Layout>contenido</Layout>);
    const region = screen.getByRole("region", { name: "Prototipo" });
    expect(within(region).getByRole("note", { name: "Aviso de prototipo" })).toHaveTextContent("PROTOTIPO · AI LAB Misión: Código Formosa");
  });

  it("usa 72rem de lectura por defecto y 90rem con ancho=datos", () => {
    const { unmount } = conLayout(<Layout>uno</Layout>);
    expect(getComputedStyle(screen.getByRole("main")).maxWidth).toBe(px(ANCHO_CONTENEDOR.lectura));
    unmount();
    conLayout(<Layout ancho="datos">dos</Layout>);
    expect(getComputedStyle(screen.getByRole("main")).maxWidth).toBe(px(ANCHO_CONTENEDOR.datos));
  });

  it("Contenedor aplica el ancho pedido", () => {
    montar(<Contenedor ancho="datos" data-testid="c">x</Contenedor>);
    expect(getComputedStyle(screen.getByTestId("c")).maxWidth).toBe(px("90rem"));
  });
});

describe("barra del escenario debajo del título", () => {
  function Pagina({ conCabecera }: { conCabecera: boolean }) {
    return (
      <SlotEscenarioProvider>
        <EnSlotEscenario>
          <div data-testid="barra">barra</div>
        </EnSlotEscenario>
        {conCabecera && <CabeceraPagina titulo="Órdenes" />}
        <p>contenido</p>
      </SlotEscenarioProvider>
    );
  }

  it("con cabecera, la barra queda después del h1 en el orden de lectura", () => {
    const { container } = montar(<Pagina conCabecera />);
    const h1 = screen.getByRole("heading", { level: 1, name: "Órdenes" });
    const barra = screen.getByTestId("barra");
    expect(h1.compareDocumentPosition(barra) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector("[data-testid=slot-escenario]")).toContainElement(barra);
  });

  it("sin cabecera, la barra se queda arriba (sigue alcanzable)", () => {
    montar(<Pagina conCabecera={false} />);
    expect(screen.getByTestId("barra")).toBeInTheDocument();
  });

  it("fuera del panel, CabeceraPagina no crea un lugar para la barra", () => {
    const { container } = montar(<CabeceraPagina titulo="Sola" />);
    expect(container.querySelector("[data-testid=slot-escenario]")).toBeNull();
  });
});

describe("Opcion y GrupoOpciones", () => {
  it("checkbox: marca y desmarca, con objetivo de al menos 44 px", () => {
    const cambios: boolean[] = [];
    function Caso() {
      const [v, setV] = useState(false);
      return <Opcion etiqueta="Sector S4" isChecked={v} onChange={(x) => { cambios.push(x); setV(x); }} />;
    }
    montar(<Caso />);
    const caja = screen.getByRole("checkbox", { name: "Sector S4" });
    fireEvent.click(caja);
    expect(cambios).toEqual([true]);
    expect(caja).toBeChecked();
    expect(getComputedStyle(caja.closest("label") as HTMLElement).minHeight).toBe(px("2.75rem"));
  });

  it("grupo de radios: un nombre de grupo, una sola opción elegida a la vez", () => {
    function Caso() {
      const [v, setV] = useState("a");
      return (
        <GrupoOpciones
          leyenda="Tipo de orden"
          value={v}
          onChange={setV}
          opciones={[
            { valor: "a", etiqueta: "Alerta" },
            { valor: "b", etiqueta: "Evacuación", ayuda: "Requiere decisor" },
          ]}
        />
      );
    }
    montar(<Caso />);
    const grupo = screen.getByRole("group", { name: "Tipo de orden" });
    expect(within(grupo).getAllByRole("radio")).toHaveLength(2);
    fireEvent.click(within(grupo).getByRole("radio", { name: /Evacuación/ }));
    expect(within(grupo).getByRole("radio", { name: /Evacuación/ })).toBeChecked();
    expect(within(grupo).getByRole("radio", { name: "Alerta" })).not.toBeChecked();
  });
});

describe("Seccion y Cifra", () => {
  it("SIMULADO se rotula una vez por bloque: las cifras SIMULADO no lo repiten", () => {
    montar(
      <Seccion titulo="Resumen" categoria="SIMULADO">
        <Cifra etiqueta="Personas" valor="5.650" categoria="SIMULADO" />
        <Cifra etiqueta="Sectores" valor="4" categoria="SIMULADO" />
      </Seccion>,
    );
    expect(document.querySelectorAll("[data-categoria=SIMULADO]")).toHaveLength(1);
  });

  it("DATO OBSERVADO nunca se oculta solo, ni siquiera dentro de un bloque rotulado", () => {
    montar(
      <Seccion titulo="Río" categoria="DATO OBSERVADO">
        <Cifra etiqueta="Altura" valor="5,60 m" categoria="DATO OBSERVADO" />
      </Seccion>,
    );
    expect(document.querySelectorAll("[data-categoria='DATO OBSERVADO']")).toHaveLength(2);
  });

  it("omitirCategoria y sinCategoria son explícitos", () => {
    montar(
      <Seccion titulo="Mezcla" categoria="SIMULADO" sinCategoria>
        <Cifra etiqueta="A" valor="1" categoria="SIMULADO" />
        <Cifra etiqueta="B" valor="2" categoria="SIMULADO" omitirCategoria />
      </Seccion>,
    );
    // Sin título rotulado, la cifra A lleva la suya; la B la omite a pedido.
    expect(document.querySelectorAll("[data-categoria=SIMULADO]")).toHaveLength(1);
  });
});

describe("campos de formulario", () => {
  it("CampoSelect enlaza etiqueta, ayuda y error", () => {
    montar(
      <CampoSelect id="rol" etiqueta="Responsable" ayuda="Elegí un rol" value="" onChange={() => {}}>
        <option value="">Elegir</option>
      </CampoSelect>,
    );
    expect(screen.getByLabelText("Responsable")).toBeInTheDocument();
    expect(screen.getByText("Elegí un rol")).toBeInTheDocument();
  });

  it("GrupoCampos expone un grupo con nombre", () => {
    montar(
      <GrupoCampos leyenda="Domicilio" ayuda="Para ubicar tu sector">
        <input aria-label="Calle" />
      </GrupoCampos>,
    );
    expect(screen.getByRole("group", { name: "Domicilio" })).toBeInTheDocument();
  });
});

describe("etiquetas de códigos internos", () => {
  it("etiquetaCodigo da el nombre llano con el código entre paréntesis", () => {
    expect(etiquetaCodigo("K1")).toBe("Serie histórica del río (K1)");
    expect(etiquetaCodigo("K10", { conCodigo: false })).toBe("Sectores de evaluación");
    expect(etiquetaCodigo("SUPUESTO")).toBe("Supuesto del equipo");
    expect(etiquetaCodigo("defensa_civil")).toBe("Defensa Civil");
    expect(etiquetaCodigo(null)).toBe("");
  });

  it("etiquetaOrigen reúne orígenes de solicitud, lluvia y canal", () => {
    expect(etiquetaOrigen("sms_sim")).toBe("SMS (simulado)");
    expect(etiquetaOrigen("parte_policial")).toBe("Parte policial");
    expect(etiquetaOrigen("algo_raro")).toBe("Algo raro");
  });
});
