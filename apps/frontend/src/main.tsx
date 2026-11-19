import { ChakraProvider } from "@chakra-ui/react";
import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/atkinson-hyperlegible-next";

import App from "./App";
import "./estilo/base.css";
import { aplicarRespaldos } from "./lib/compat";
import { theme } from "./theme";

aplicarRespaldos();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <App />
    </ChakraProvider>
  </React.StrictMode>,
);
