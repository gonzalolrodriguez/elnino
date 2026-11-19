/// <reference types="vitest/config" />
import legacy from "@vitejs/plugin-legacy";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Navegadores admitidos (igual que "browserslist" de package.json). El paquete moderno se sirve a los que soportan módulos ES. */
const NAVEGADORES = ["chrome >= 70", "safari >= 12", "ios >= 12", "firefox >= 78", "edge >= 79", "samsung >= 10"];

export default defineConfig({
  plugins: [
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
  },
});
