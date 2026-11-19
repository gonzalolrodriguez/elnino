import { Opcion, Opciones, Subtitulo } from "@/components/ui";
import { ESPECIES_SOS, type EspecieSOS } from "@/lib/sos";

const ETIQUETA: Record<EspecieSOS, string> = {
  bovinos: "Vacas / bovinos",
  ovinos: "Ovejas",
  caprinos: "Cabras",
  porcinos: "Cerdos",
  equinos: "Caballos",
  colmenas: "Colmenas",
};

/** Elección de la especie de los animales (viaja en el detalle de BOV del SMS). */
export function SelectorEspecie({
  valor,
  alCambiar,
}: {
  valor: EspecieSOS;
  alCambiar: (e: EspecieSOS) => void;
}) {
  return (
    <>
      <Subtitulo>¿Qué animales son?</Subtitulo>
      <Opciones>
        {ESPECIES_SOS.map((e) => (
          <Opcion key={e} titulo={ETIQUETA[e]} elegida={valor === e} onPress={() => alCambiar(e)} />
        ))}
      </Opciones>
    </>
  );
}
