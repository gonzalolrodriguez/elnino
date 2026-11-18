import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Checkbox,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Input,
  ListItem,
  UnorderedList,
} from "@chakra-ui/react";
import type { ReactNode } from "react";

import { ApiError } from "../lib/api";

type CampoProps = {
  id: string;
  etiqueta: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  ayuda?: string;
  type?: string;
  placeholder?: string;
  inputMode?: "numeric" | "decimal" | "text";
  autoComplete?: string;
  isRequired?: boolean;
};

export function Campo({ id, etiqueta, error, ayuda, isRequired, ...entrada }: CampoProps) {
  return (
    <FormControl isInvalid={!!error} isRequired={isRequired}>
      <FormLabel htmlFor={id}>{etiqueta}</FormLabel>
      <Input id={id} name={id} bg="white" {...entrada} />
      {error ? <FormErrorMessage>{error}</FormErrorMessage> : ayuda ? <FormHelperText>{ayuda}</FormHelperText> : null}
    </FormControl>
  );
}

/** Muestra el sobre de error del backend: mensaje y detalle por campo. */
export function AlertaError({ error }: { error: unknown }) {
  if (!error) return null;
  const api = error instanceof ApiError ? error : null;
  const mensaje = api ? api.message : error instanceof Error ? error.message : "Ocurrió un error inesperado.";
  return (
    <Alert status="error" alignItems="flex-start" role="alert">
      <AlertIcon />
      <Box>
        <AlertTitle>{mensaje}</AlertTitle>
        {api && api.detalle.length > 0 && (
          <AlertDescription>
            <UnorderedList mt={1}>
              {api.detalle.map((d, i) => (
                <ListItem key={i}>
                  {d.campo ? `${d.campo.replace(/^body\./, "")}: ` : ""}
                  {d.mensaje}
                </ListItem>
              ))}
            </UnorderedList>
          </AlertDescription>
        )}
        {api && api.codigo !== "error" && (
          <AlertDescription fontSize="xs" mt={1}>
            Código: {api.codigo}
          </AlertDescription>
        )}
      </Box>
    </Alert>
  );
}

export function Consentimiento({
  marcado,
  onChange,
  error,
}: {
  marcado: boolean;
  onChange: (v: boolean) => void;
  error?: string;
}): ReactNode {
  return (
    <FormControl isInvalid={!!error}>
      <Checkbox id="consentimiento" isChecked={marcado} onChange={(e) => onChange(e.target.checked)} alignItems="flex-start">
        Doy mi consentimiento informado: autorizo el tratamiento de mis datos personales con la única finalidad de planificar y asistir
        emergencias por crecidas. Sé que puedo pedir el acceso, la rectificación y la supresión de mis datos (Ley 25.326). El teléfono y
        los datos de salud se guardan cifrados.
      </Checkbox>
      {error && <FormErrorMessage>{error}</FormErrorMessage>}
    </FormControl>
  );
}
