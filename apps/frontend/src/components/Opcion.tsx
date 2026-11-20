import { Box, Checkbox, Radio, RadioGroup, Text, VisuallyHidden, Wrap, WrapItem } from "@chakra-ui/react";
import type { ReactNode } from "react";

/**
 * Opción seleccionable del sistema (DESIGN.md, Formularios): objetivo de 44 px, recuadro de línea fina y relleno
 * `suave` al elegirla. Reemplaza a los `<input type="checkbox|radio">` nativos y a los radios chicos en fila.
 *  - `tipo="checkbox"`: booleano o multiselección (controlada con `isChecked` / `onChange`).
 *  - `tipo="radio"`: excluyente; va dentro de `GrupoOpciones` (o de un `RadioGroup`) y lleva `valor`.
 */
const MARCO = {
  display: "flex",
  alignItems: "center",
  minH: "2.75rem",
  w: "100%",
  px: 3,
  py: 2,
  border: "1px solid",
  borderColor: "bordeControl",
  borderRadius: "md",
  bg: "superficie",
  transition: "background-color 160ms var(--ease-out), border-color 160ms var(--ease-out)",
  _checked: { bg: "suave", borderColor: "primario" },
  _disabled: { opacity: 0.6, cursor: "not-allowed" },
  sx: { "@media (hover: hover) and (pointer: fine)": { "&:hover:not([data-disabled])": { borderColor: "primario" } } },
};

type Comun = {
  etiqueta: ReactNode;
  /** Línea de ayuda debajo de la etiqueta (13 px). */
  ayuda?: ReactNode;
  isDisabled?: boolean;
  isInvalid?: boolean;
  id?: string;
  name?: string;
};

export type OpcionProps =
  | (Comun & { tipo?: "checkbox"; isChecked: boolean; onChange: (marcado: boolean) => void })
  | (Comun & { tipo: "radio"; valor: string });

export function Opcion(props: OpcionProps) {
  const { etiqueta, ayuda, isDisabled, isInvalid, id, name } = props;
  const cuerpo = (
    <Box as="span" display="block" minW={0}>
      <Text as="span" display="block" fontWeight={600} lineHeight={1.3}>
        {etiqueta}
      </Text>
      {ayuda && (
        <Text as="span" display="block" textStyle="microdato">
          {ayuda}
        </Text>
      )}
    </Box>
  );
  if (props.tipo === "radio") {
    return (
      <Radio value={props.valor} id={id} name={name} isDisabled={isDisabled} isInvalid={isInvalid} {...MARCO}>
        {cuerpo}
      </Radio>
    );
  }
  return (
    <Checkbox
      id={id}
      name={name}
      isChecked={props.isChecked}
      isDisabled={isDisabled}
      isInvalid={isInvalid}
      onChange={(e) => props.onChange(e.target.checked)}
      {...MARCO}
    >
      {cuerpo}
    </Checkbox>
  );
}

/**
 * Grupo excluyente de opciones en fila (se ajusta a varias líneas en pantallas angostas). `leyenda` es el nombre del
 * grupo para lectores de pantalla y se ve encima.
 */
export function GrupoOpciones({
  leyenda,
  value,
  onChange,
  opciones,
  ocultarLeyenda,
  minAncho = "12rem",
}: {
  leyenda: string;
  value: string;
  onChange: (valor: string) => void;
  opciones: { valor: string; etiqueta: ReactNode; ayuda?: ReactNode; isDisabled?: boolean }[];
  ocultarLeyenda?: boolean;
  minAncho?: string;
}) {
  return (
    <Box as="fieldset" border="none" m={0} p={0} minW={0}>
      {ocultarLeyenda ? (
        <VisuallyHidden as="legend">{leyenda}</VisuallyHidden>
      ) : (
        <Text as="legend" textStyle="rotulo" color="texto" mb={1.5}>
          {leyenda}
        </Text>
      )}
      <RadioGroup value={value} onChange={onChange}>
        <Wrap spacing={2} role="presentation">
          {opciones.map((o) => (
            <WrapItem key={o.valor} flex={`1 1 ${minAncho}`} maxW="100%">
              <Opcion tipo="radio" valor={o.valor} etiqueta={o.etiqueta} ayuda={o.ayuda} isDisabled={o.isDisabled} />
            </WrapItem>
          ))}
        </Wrap>
      </RadioGroup>
    </Box>
  );
}
