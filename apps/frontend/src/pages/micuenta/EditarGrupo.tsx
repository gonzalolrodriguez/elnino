import { Box, Button, Flex, Heading, Text, VStack } from "@chakra-ui/react";
import { useState, type FormEvent } from "react";

import { AvisoFueraDeFormosa } from "../../components/BotonUbicacion";
import { Contador } from "../../components/Contador";
import { AlertaError, Campo } from "../../components/Formulario";
import { IconoLapiz, IconoMascota, IconoMayor, IconoMenor, IconoPersonas, IconoTilde } from "../../components/iconos/Iconos";
import { SelectorUbicacion } from "../../components/SelectorUbicacion";
import { Plegable } from "../../components/Plegable";
import { solicitar } from "../../lib/api";
import { coordenadaATexto, decimal, enfocarPrimerError, enRango, entero, validarCoordenadas, type Errores } from "../../lib/validacion";

export type Grupo = {
  integrantes?: number;
  menores?: number;
  mayores?: number;
  mascotas?: number;
  telefono?: string | null;
  salud?: string | null;
  vulnerabilidad?: string | null;
  lon?: number | null;
  lat?: number | null;
};

const txt = (n: number | null | undefined, porDefecto: string) => (n === null || n === undefined ? porDefecto : String(n));

/**
 * «Editar mi grupo familiar»: PUT /mi/grupo-familiar. El PUT reemplaza todo el registro, así que los campos
 * que esta pantalla no muestra (salud, vulnerabilidad) se reenvían tal como vinieron del servidor.
 */
export function EditarGrupo({ grupo, alGuardar, abrirMapa = 0 }: { grupo: Grupo | null; alGuardar: () => void; abrirMapa?: number }) {
  const [v, setV] = useState({
    integrantes: txt(grupo?.integrantes, "1"),
    menores: txt(grupo?.menores, "0"),
    mayores: txt(grupo?.mayores, "0"),
    mascotas: txt(grupo?.mascotas, "0"),
    telefono: grupo?.telefono ?? "",
    lon: grupo?.lon != null ? coordenadaATexto(grupo.lon) : "",
    lat: grupo?.lat != null ? coordenadaATexto(grupo.lat) : "",
  });
  const [errores, setErrores] = useState<Errores>({});
  const [enviando, setEnviando] = useState(false);
  const [errorApi, setErrorApi] = useState<unknown>(null);
  const [guardado, setGuardado] = useState(false);

  const poner = (k: keyof typeof v, valor: string) => {
    setGuardado(false);
    setV((x) => ({ ...x, [k]: valor }));
  };
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => poner(k, e.target.value);
  const lon = decimal(v.lon);
  const lat = decimal(v.lat);
  const puntoValido = lon !== null && lat !== null && !Number.isNaN(lon) && !Number.isNaN(lat);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErrorApi(null);
    const integrantes = entero(v.integrantes);
    const menores = entero(v.menores);
    const mayores = entero(v.mayores);
    const mascotas = entero(v.mascotas);
    const err: Errores = {};
    if (!enRango(integrantes, 1, 40)) err.integrantes = "Entre 1 y 40 integrantes.";
    if (!enRango(menores, 0, 40)) err.menores = "Entre 0 y 40.";
    if (!enRango(mayores, 0, 40)) err.mayores = "Entre 0 y 40.";
    if (!enRango(mascotas, 0, 100)) err.mascotas = "Entre 0 y 100.";
    if (!err.integrantes && !err.menores && !err.mayores && menores! + mayores! > integrantes!) {
      err.menores = "Los menores y las personas mayores no pueden superar a los integrantes.";
    }
    if (v.telefono.length > 30) err.telefono = "Máximo 30 caracteres.";
    Object.assign(err, validarCoordenadas(v.lon, v.lat, false));
    if ((v.lon.trim() === "") !== (v.lat.trim() === "")) err.lat = "Completá longitud y latitud, o dejá ambas vacías.";
    setErrores(err);
    if (Object.keys(err).length) {
      enfocarPrimerError();
      return;
    }
    const cuerpo: Record<string, unknown> = {
      integrantes,
      menores,
      mayores,
      mascotas,
      telefono: v.telefono.trim() || null,
      salud: grupo?.salud ?? null,
      vulnerabilidad: grupo?.vulnerabilidad ?? null,
    };
    if (v.lon.trim() && v.lat.trim()) {
      cuerpo.lon = lon;
      cuerpo.lat = lat;
    }
    setEnviando(true);
    try {
      await solicitar("/mi/grupo-familiar", { autenticado: true, metodo: "PUT", cuerpo });
      setGuardado(true);
      alGuardar();
    } catch (x) {
      setErrorApi(x);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Plegable
      titulo={
        <Flex as="span" align="center" gap={2} color="primarioHover">
          <IconoLapiz />
          <span>Editar mi grupo familiar</span>
        </Flex>
      }
      abiertoInicial={!grupo}
    >
      <form onSubmit={(e) => void enviar(e)} noValidate aria-label="Editar mi grupo familiar">
        <VStack spacing={6} align="stretch" pt={3} pb={2}>
          <AlertaError error={errorApi} />
          <Box as="fieldset" border="0" p={0} m={0} minW={0}>
            <Heading as="h3" size="sm" mb={3}>
              Quiénes son
            </Heading>
            <Box display="grid" gridTemplateColumns={{ base: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }} gap={4} alignItems="end">
              <Contador id="g-integrantes" etiqueta="Integrantes" icono={<IconoPersonas />} min={1} max={40} value={v.integrantes} onChange={(t) => poner("integrantes", t)} error={errores.integrantes} />
              <Contador id="g-menores" etiqueta="Menores" icono={<IconoMenor />} max={40} value={v.menores} onChange={(t) => poner("menores", t)} error={errores.menores} />
              <Contador id="g-mayores" etiqueta="Personas mayores" icono={<IconoMayor />} max={40} value={v.mayores} onChange={(t) => poner("mayores", t)} error={errores.mayores} />
              <Contador id="g-mascotas" etiqueta="Mascotas" icono={<IconoMascota />} max={100} value={v.mascotas} onChange={(t) => poner("mascotas", t)} error={errores.mascotas} />
            </Box>
          </Box>
          <Box maxW="22rem">
            <Campo id="g-telefono" etiqueta="Teléfono (opcional)" type="tel" value={v.telefono} onChange={set("telefono")} error={errores.telefono} ayuda="Se guarda cifrado." autoComplete="tel" />
          </Box>
          <Box>
            <Heading as="h3" size="sm" mb={1}>
              Domicilio (opcional)
            </Heading>
            <Text fontSize="sm" color="textoSuave" mb={3}>
              Con tu domicilio sabemos en qué sector estás y a qué centro te corresponde ir.
            </Text>
            <SelectorUbicacion
              id="domicilio-selector"
              idBase="g"
              lon={v.lon}
              lat={v.lat}
              inicial={grupo?.lon != null && grupo?.lat != null ? "mapa" : "ubicacion"}
              abrirMapa={abrirMapa}
              errorLon={errores.lon}
              errorLat={errores.lat}
              onPunto={(lo, la) => {
                setGuardado(false);
                setV((x) => ({ ...x, lon: coordenadaATexto(lo), lat: coordenadaATexto(la) }));
              }}
              onTexto={(campo, valor) => poner(campo, valor)}
            />
          </Box>
          <AvisoFueraDeFormosa lon={puntoValido ? lon : null} lat={puntoValido ? lat : null} />
          <Flex align="center" gap={4} wrap="wrap">
            <Button type="submit" isLoading={enviando} loadingText="Guardando" minH="2.75rem">
              Guardar cambios
            </Button>
            {guardado && (
              <Flex role="status" align="center" gap={1.5} fontSize="sm" fontWeight={600} color="verde.800">
                <IconoTilde />
                Cambios guardados.
              </Flex>
            )}
          </Flex>
        </VStack>
      </form>
    </Plegable>
  );
}
