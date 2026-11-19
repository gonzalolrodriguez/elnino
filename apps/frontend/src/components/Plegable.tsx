import { Box } from "@chakra-ui/react";
import { useState, type ReactNode } from "react";

/**
 * Bloque plegable (details/summary nativo): lo secundario queda cerrado y accesible con teclado.
 * `abierto` permite abrirlo desde fuera (p. ej. un enlace con ancla); el usuario puede seguir plegándolo.
 */
export function Plegable({
  titulo,
  children,
  id,
  abiertoInicial = false,
  abierto,
  tono = "claro",
  ...resto
}: {
  titulo: ReactNode;
  children: ReactNode;
  id?: string;
  abiertoInicial?: boolean;
  abierto?: boolean;
  tono?: "claro" | "oscuro";
  "data-testid"?: string;
}) {
  const [interno, setInterno] = useState(abiertoInicial);
  const open = abierto ?? interno;
  const oscuro = tono === "oscuro";
  return (
    <Box
      as="details"
      id={id}
      open={open}
      onToggle={(e: React.SyntheticEvent<HTMLDetailsElement>) => setInterno(e.currentTarget.open)}
      sx={{
        "& > summary": { listStyle: "none" },
        "& > summary::-webkit-details-marker": { display: "none" },
        "&[open] > summary .plegable-flecha": { transform: "rotate(180deg)" },
      }}
      {...resto}
    >
      <Box
        as="summary"
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap={3}
        minH="2.75rem"
        py={2}
        cursor="pointer"
        fontWeight={600}
        color={oscuro ? "oscuro.fg" : "texto"}
        borderRadius="md"
      >
        <span>{titulo}</span>
        <Box
          as="svg"
          className="plegable-flecha"
          width="18px"
          height="18px"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          flex="none"
          transition="transform 200ms var(--ease-out)"
        >
          <path d="M5 8l5 5 5-5" />
        </Box>
      </Box>
      {children}
    </Box>
  );
}
