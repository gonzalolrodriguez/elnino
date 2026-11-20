import { Box, FormControl, FormErrorMessage, FormLabel, IconButton, Input } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { IconoMas, IconoMenos } from "./iconos/Iconos";

type Props = {
  id: string;
  etiqueta: string;
  /** Texto del campo (la validación vive en el formulario). */
  value: string;
  onChange: (valor: string) => void;
  min?: number;
  max?: number;
  error?: string;
  icono?: ReactNode;
};

const aEntero = (t: string): number | null => (/^\d+$/.test(t.trim()) ? Number(t.trim()) : null);

/**
 * Cantidad con botones − y +: pensado para pantalla táctil (objetivos de 44 px) sin perder el campo numérico
 * escribible. Los topes los valida el formulario; los botones solo respetan `min` y `max`.
 */
export function Contador({ id, etiqueta, value, onChange, min = 0, max = 999, error, icono }: Props) {
  const n = aEntero(value);
  const mover = (d: number) => onChange(String(Math.min(max, Math.max(min, (n ?? min) + d))));
  return (
    <FormControl isInvalid={!!error}>
      <FormLabel htmlFor={id} display="flex" alignItems="center" gap={2}>
        {icono && (
          <Box as="span" aria-hidden="true" display="inline-flex" color="textoSuave">
            {icono}
          </Box>
        )}
        {etiqueta}
      </FormLabel>
      <Box display="flex" alignItems="center" bg="superficie" border="1px solid" borderColor={error ? "escala.evacuacion" : "bordeControl"} borderRadius="xl" p={1} gap={1}>
        <IconButton type="button" variant="outline" aria-label={`Menos: ${etiqueta.toLowerCase()}`} icon={<IconoMenos />} onClick={() => mover(-1)} isDisabled={n !== null && n <= min} borderRadius="lg" />
        <Input
          id={id}
          name={id}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          variant="unstyled"
          textAlign="center"
          fontWeight={700}
          fontSize="lg"
          sx={{ fontVariantNumeric: "tabular-nums" }}
          h="2.75rem"
          minW={0}
        />
        <IconButton type="button" variant="outline" aria-label={`Más: ${etiqueta.toLowerCase()}`} icon={<IconoMas />} onClick={() => mover(1)} isDisabled={n !== null && n >= max} borderRadius="lg" />
      </Box>
      {error && <FormErrorMessage>{error}</FormErrorMessage>}
    </FormControl>
  );
}
