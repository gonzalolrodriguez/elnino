import { TableContainer, type TableContainerProps } from "@chakra-ui/react";
import type { ReactNode } from "react";

/**
 * Tabla ancha que se desplaza dentro de su propio contenedor (la página nunca se desplaza en horizontal).
 * Es una región con nombre y enfocable con el teclado, y muestra una sombra en el borde donde queda contenido oculto.
 */
export function TablaDesplazable({ etiqueta, children, ...props }: { etiqueta: string; children: ReactNode } & Pick<TableContainerProps, "mb" | "maxH" | "overflowY">) {
  return (
    <TableContainer className="desplazable" role="region" tabIndex={0} aria-label={`${etiqueta}: tabla con desplazamiento horizontal`} data-scroll-ok="" {...props}>
      {children}
    </TableContainer>
  );
}
