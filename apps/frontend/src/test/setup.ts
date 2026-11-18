import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// Las páginas se cargan con React.lazy: bajo carga el chunk puede tardar más que el 1 s por defecto.
configure({ asyncUtilTimeout: 5000 });
