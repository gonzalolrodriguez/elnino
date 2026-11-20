/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";

import legacy, { cspHashes } from "@vitejs/plugin-legacy";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

import { politicaCsp } from "./src/lib/csp";

/** Navegadores admitidos (igual que "browserslist" de package.json). El paquete moderno se sirve a los que soportan módulos ES. */
const NAVEGADORES = ["chrome >= 70", "safari >= 12", "ios >= 12", "firefox >= 78", "edge >= 79", "samsung >= 10"];

/** Inserta la Content-Security-Policy en el index.html del build (no en `vite dev`, ver src/lib/csp.ts). */
function csp(apiUrl: string): Plugin {
  return {
    name: "evacuaciones-csp",
    apply: "build",
    // "post": después de que plugin-legacy agregue sus scripts, para que el <meta> quede primero en <head>.
    transformIndexHtml: {
      order: "post",
      handler: () => [
        { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: politicaCsp(apiUrl, cspHashes) }, injectTo: "head-prepend" },
      ],
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    csp(loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "VITE_").VITE_API_URL ?? "http://localhost:8000"),
    react(),
    legacy({
      targets: NAVEGADORES,
      // Polyfills (core-js) también para el paquete moderno, solo los que usa el código y faltan en estos navegadores.
      modernPolyfills: true,
      modernTargets: ["chrome >= 80", "safari >= 14", "ios >= 14", "firefox >= 78", "edge >= 80", "samsung >= 13"],
    }),
  ],
  // El CSS se compila para el mismo piso de navegadores (esbuild baja `inset`, colores modernos, etc.).
  build: { cssTarget: ["chrome70", "safari12", "firefox78"] },
  server: { port: 5173 },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // Las páginas se cargan con React.lazy y los tests de integración montan toda la app: con la máquina cargada superan 5 s.
    testTimeout: 20_000,
  },
}));
