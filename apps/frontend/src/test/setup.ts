import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// Las páginas se cargan con React.lazy: bajo carga el chunk puede tardar más que el 1 s por defecto.
configure({ asyncUtilTimeout: 5000 });

// Node 25 o superior trae un `localStorage` global experimental que, sin `--localstorage-file`, no
// tiene métodos y tapa al de jsdom. Se usa el almacenamiento del documento de jsdom.
const almacenamientoJsdom = (globalThis as { jsdom?: { window: Window } }).jsdom?.window;
if (almacenamientoJsdom && typeof globalThis.localStorage?.clear !== "function") {
  for (const nombre of ["localStorage", "sessionStorage"] as const) {
    Object.defineProperty(globalThis, nombre, { value: almacenamientoJsdom[nombre], configurable: true, writable: true });
  }
}
