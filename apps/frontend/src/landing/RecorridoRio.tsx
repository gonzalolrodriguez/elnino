import { Box, Button, chakra, Flex, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { CHIPS_RECORRIDO, hitoMasCercano, textoValor, type ControlCuenca, type EstadoRecorrido, type IdHito } from "./recorrido";

type Props = {
  /** Controles que publica la escena 3D (null mientras no está lista o en el respaldo 2D). */
  control: React.MutableRefObject<ControlCuenca | null>;
  /** Hay escena 3D lista: habilita la barra, reproducir, explorar y volver. Sin ella solo quedan los atajos. */
  disponible3D: boolean;
  reducido: boolean;
  /** Atajo activo en el respaldo 2D (se resalta en el esquema). */
  resaltado: IdHito | null;
  alResaltar: (id: IdHito) => void;
  /** Texto de ayuda visible (p. ej. «Usá Ctrl + rueda…»). */
  pista: boolean;
};

const MINIMO = "2.75rem"; // 44 px de lado mínimo en todo lo tocable
const Rango = chakra("input");

/**
 * «Recorrer el río»: barra de avance (0 a 100 %), reproducir y pausar, atajos a los hitos, explorar el mapa
 * y volver a la vista inicial. Todo es HTML accesible; la escena solo recibe órdenes por `ControlCuenca`.
 * La barra se actualiza por DOM directo (la escena emite a 10 Hz), sin estado de React por cuadro.
 */
export function RecorridoRio({ control, disponible3D, reducido, resaltado, alResaltar, pista }: Props) {
  const barra = useRef<HTMLInputElement>(null);
  const arrastrando = useRef(false);
  const [estado, setEstado] = useState<Pick<EstadoRecorrido, "modo" | "reproduciendo">>({ modo: "intro", reproduciendo: false });
  const [cercano, setCercano] = useState<IdHito | null>(null);

  const aplicar = useCallback((e: EstadoRecorrido) => {
    const c = control.current;
    const input = barra.current;
    if (input) {
      if (!arrastrando.current) input.value = String(Math.round(e.p * 100));
      input.setAttribute("aria-valuetext", textoValor(e.p, c?.hitos ?? []));
    }
    const h = c ? hitoMasCercano(e.p, c.hitos.filter((x) => x.id !== "matogrosso")) : null;
    setCercano((h?.id as IdHito | undefined) ?? null);
    setEstado((a) => (a.modo === e.modo && a.reproduciendo === e.reproduciendo ? a : { modo: e.modo, reproduciendo: e.reproduciendo }));
  }, [control]);

  useEffect(() => {
    const c = control.current;
    if (!disponible3D || !c) return;
    aplicar(c.estado());
    return c.suscribir(aplicar);
  }, [disponible3D, control, aplicar]);

  // Esc sale del modo explorar.
  useEffect(() => {
    if (estado.modo !== "libre") return;
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") control.current?.explorar(false);
    };
    document.addEventListener("keydown", f);
    return () => document.removeEventListener("keydown", f);
  }, [estado.modo, control]);

  const alMoverBarra = (valor: number) => control.current?.irA(valor / 100, { instantaneo: reducido });
  const libre = estado.modo === "libre";
  const activoChip = disponible3D ? cercano : resaltado;

  return (
    <Box
      role="group"
      aria-labelledby="recorrido-titulo"
      data-evitar-etiquetas=""
      data-testid="recorrido-rio"
      position={{ base: "relative", lg: "absolute" }}
      bottom={{ lg: 6 }}
      left={{ lg: "calc(2rem + 19rem + 1rem)" }}
      right={{ lg: 8 }}
      maxW={{ lg: "46rem" }}
      zIndex={3}
      mx={{ base: 4, md: 8, lg: 0 }}
      mt={{ base: 3, lg: 0 }}
      mb={{ base: 4, lg: 0 }}
      p={3}
      bg="rgba(14,27,44,0.78)"
      border="1px solid"
      borderColor="oscuro.linea"
      borderRadius="2xl"
      pointerEvents="auto"
      style={{ backdropFilter: "blur(10px)" }}
    >
      <Flex align="center" gap={3} wrap="wrap">
        <Text id="recorrido-titulo" fontWeight={700} fontSize="sm">
          Recorrer el río
        </Text>
        {disponible3D && (
          <>
            <Button
              type="button"
              size="sm"
              variant="sobreOscuro"
              minW={MINIMO}
              minH={MINIMO}
              onClick={() => (estado.reproduciendo ? control.current?.pausar() : control.current?.jugar())}
              aria-label={estado.reproduciendo ? "Pausar el recorrido" : "Reproducir el recorrido"}
              aria-pressed={estado.reproduciendo}
              data-testid="recorrido-reproducir"
            >
              {estado.reproduciendo ? "Pausa" : "Reproducir"}
            </Button>
            <Rango
              ref={barra}
              type="range"
              min={0}
              max={100}
              step={1}
              defaultValue={0}
              flex="1 1 10rem"
              minW="9rem"
              h={MINIMO}
              aria-label="Avance del recorrido del río, de Mato Grosso a la confluencia con el Paraná"
              aria-valuetext="0 %"
              style={{ accentColor: "#8FD3F4", touchAction: "pan-y" }}
              _focusVisible={{ outline: "3px solid", outlineColor: "papel", outlineOffset: "2px" }}
              data-testid="recorrido-barra"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => alMoverBarra(Number(e.target.value))}
              onPointerDown={() => {
                arrastrando.current = true;
              }}
              onPointerUp={() => {
                arrastrando.current = false;
              }}
              onBlur={() => {
                arrastrando.current = false;
              }}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                // «+» y «-» mueven de a 5 puntos; las flechas, Inicio y Fin ya los resuelve el control nativo.
                if (e.key === "+" || e.key === "=" || e.key === "-") {
                  e.preventDefault();
                  const actual = Number(e.currentTarget.value);
                  const nuevo = Math.min(100, Math.max(0, actual + (e.key === "-" ? -5 : 5)));
                  e.currentTarget.value = String(nuevo);
                  alMoverBarra(nuevo);
                }
              }}
            />
          </>
        )}
      </Flex>

      <Flex gap={2} wrap="wrap" mt={2} role="group" aria-label="Ir a un punto del recorrido">
        {CHIPS_RECORRIDO.map((c) => (
          <Button
            key={c.id}
            type="button"
            size="sm"
            variant="sobreOscuro"
            minH={MINIMO}
            aria-pressed={activoChip === c.id}
            bg={activoChip === c.id ? "rgba(255,255,255,0.3)" : undefined}
            onClick={() => (disponible3D ? control.current?.irAHito(c.id, { instantaneo: reducido }) : alResaltar(c.id))}
            data-testid={`recorrido-hito-${c.id}`}
          >
            {c.nombre}
          </Button>
        ))}
      </Flex>

      {disponible3D && (
        <Flex gap={2} wrap="wrap" mt={2} align="center">
          {libre ? (
            <Button type="button" size="sm" variant="acento" minH={MINIMO} onClick={() => control.current?.explorar(false)} data-testid="recorrido-salir">
              Salir del mapa (Esc)
            </Button>
          ) : (
            <Button type="button" size="sm" variant="sobreOscuro" minH={MINIMO} onClick={() => control.current?.explorar(true)} data-testid="recorrido-explorar">
              Explorar el mapa
            </Button>
          )}
          <Button type="button" size="sm" variant="sobreOscuro" minH={MINIMO} onClick={() => control.current?.volverInicio()} data-testid="recorrido-volver">
            Volver a la vista inicial
          </Button>
        </Flex>
      )}

      <Text role="status" aria-live="polite" fontSize="xs" color="oscuro.suave" mt={2} minH="1.1em">
        {libre
          ? "Arrastrá para moverte, rueda o pellizco para acercar, clic derecho o dos dedos para girar."
          : pista
            ? "Usá Ctrl + rueda para hacer zoom"
            : ""}
      </Text>
    </Box>
  );
}
