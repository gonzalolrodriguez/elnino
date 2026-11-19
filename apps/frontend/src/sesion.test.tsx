import { render, screen, waitFor } from "@testing-library/react";
import { StrictMode, useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "./auth/AuthContext";
import { fijarToken, reintentosRefresh, solicitar } from "./lib/api";
import { llamadas, sesion, simularFetch } from "./test/utils";

const ESPERAS = [...reintentosRefresh.esperasMs];

beforeEach(() => {
  window.localStorage.clear();
  fijarToken(null);
  reintentosRefresh.esperasMs = [0, 0];
});
afterEach(() => {
  vi.unstubAllGlobals();
  reintentosRefresh.esperasMs = ESPERAS;
});

function Sonda() {
  const { estado } = useAuth();
  return <p>estado:{estado}</p>;
}

describe("renovación de sesión", () => {
  it("el doble montaje de StrictMode hace un solo POST /auth/refresh", async () => {
    window.localStorage.setItem("e3_sesion", "1");
    const f = simularFetch({ "POST /auth/refresh": () => sesion("ciudadano") });
    render(
      <StrictMode>
        <AuthProvider>
          <Sonda />
        </AuthProvider>
      </StrictMode>,
    );
    expect(await screen.findByText("estado:autenticado")).toBeInTheDocument();
    expect(llamadas(f, "POST /auth/refresh")).toHaveLength(1);
  });

  it("un 5xx al renovar no cierra la sesión ni borra la marca", async () => {
    window.localStorage.setItem("e3_sesion", "1");
    const f = simularFetch({
      "POST /auth/refresh": () => ({ estado: 503, json: { error: { codigo: "no_disponible", mensaje: "caído", detalle: [] } } }),
    });
    render(
      <AuthProvider>
        <Sonda />
      </AuthProvider>,
    );
    await waitFor(() => expect(llamadas(f, "POST /auth/refresh")).toHaveLength(3)); // 1 + 2 reintentos
    expect(await screen.findByText("estado:anonimo")).toBeInTheDocument();
    expect(window.localStorage.getItem("e3_sesion")).toBe("1");
  });

  it("un 401 al renovar sí cierra la sesión", async () => {
    window.localStorage.setItem("e3_sesion", "1");
    simularFetch({
      "POST /auth/refresh": () => ({ estado: 401, json: { error: { codigo: "no_autenticado", mensaje: "no", detalle: [] } } }),
    });
    render(
      <AuthProvider>
        <Sonda />
      </AuthProvider>,
    );
    await waitFor(() => expect(window.localStorage.getItem("e3_sesion")).toBeNull());
    expect(await screen.findByText("estado:anonimo")).toBeInTheDocument();
  });

  it("ante un 401 con sesión renueva el token y repite el pedido una vez", async () => {
    let intentos = 0;
    window.localStorage.setItem("e3_sesion", "1");
    const f = simularFetch({
      "POST /auth/refresh": () => sesion("ciudadano"),
      "GET /mi/sector": () => {
        intentos += 1;
        return intentos === 1
          ? { estado: 401, json: { error: { codigo: "no_autenticado", mensaje: "vencido", detalle: [] } } }
          : { estado: 200, json: { ok: true } };
      },
    });
    function Consulta() {
      const { estado } = useAuth();
      const [r, setR] = useState("");
      useEffect(() => {
        if (estado === "autenticado") void solicitar<{ ok: boolean }>("/mi/sector", { autenticado: true }).then((x) => setR(String(x.ok)));
      }, [estado]);
      return <p>resultado:{r}</p>;
    }
    render(
      <AuthProvider>
        <Consulta />
      </AuthProvider>,
    );
    expect(await screen.findByText("resultado:true")).toBeInTheDocument();
    expect(intentos).toBe(2);
    expect(llamadas(f, "POST /auth/refresh")).toHaveLength(2); // inicial + el provocado por el 401
  });
});
